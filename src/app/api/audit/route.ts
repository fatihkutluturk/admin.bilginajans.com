import { NextRequest, NextResponse } from "next/server";
import { PageAudit, AuditIssue } from "@/lib/types";
import { auditPage } from "@/lib/audit";
import { tr } from "@/lib/tr";
import { getWordPressConfig } from "@/lib/prompts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const deep = body.deep === true;

    const wp = getWordPressConfig();
    const base = wp.url.replace(/\/$/, "");
    const credentials = Buffer.from(`${wp.username}:${wp.appPassword}`).toString("base64");
    const headers = { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" };

    // Fast fetch: basic fields + yoast (no Elementor data)
    const fields = deep
      ? "id,title,slug,link,status,yoast_head_json,meta,content"
      : "id,title,slug,link,status,yoast_head_json";

    const context = deep ? "&context=edit" : "";

    // Fetch all pages (paginated, 100 per request)
    type RawPage = {
      id: number;
      title: { rendered?: string; raw?: string };
      slug: string;
      link: string;
      status: string;
      yoast_head_json?: { description?: string; og_description?: string };
      meta?: { _elementor_edit_mode?: string; _elementor_data?: string };
      content?: { rendered?: string; raw?: string };
    };

    const allRawPages: RawPage[] = [];
    for (let page = 1; page <= 5; page++) {
      const res = await fetch(
        `${base}/wp-json/wp/v2/pages?per_page=100&page=${page}&_fields=${fields}${context}`,
        { headers }
      );
      if (!res.ok) break;
      const pages: RawPage[] = await res.json();
      if (!Array.isArray(pages) || pages.length === 0) break;
      allRawPages.push(...pages);
      const totalPages = parseInt(res.headers.get("X-WP-TotalPages") || "1");
      if (page >= totalPages) break;
    }

    // Audit each page
    const allPages: PageAudit[] = allRawPages.map((p) => {
      const issues: AuditIssue[] = [];
      const title = (p.title?.raw || p.title?.rendered || "").replace(/<[^>]*>/g, "").trim();

      // Check Yoast meta
      const metaDesc = p.yoast_head_json?.description || p.yoast_head_json?.og_description;
      if (!metaDesc && p.status === "publish") {
        issues.push({ type: "warning", code: "missing_meta", message: tr.audit.issues.missing_meta });
      }

      let wordCount = 0;
      let hasElementor = false;

      if (deep && p.meta?._elementor_data) {
        // Deep scan — full Elementor analysis
        return auditPage(p);
      }

      // Basic word count from content field if available
      if (p.content?.rendered || p.content?.raw) {
        const text = (p.content.rendered || p.content.raw || "").replace(/<[^>]*>/g, "").trim();
        wordCount = text.split(/\s+/).filter(Boolean).length;

        if (text.toLowerCase().includes("lorem ipsum")) {
          issues.push({ type: "error", code: "placeholder", message: tr.audit.issues.placeholder });
        }
      }

      if (wordCount < 300 && p.status === "publish") {
        issues.push({ type: "warning", code: "thin_content", message: tr.audit.issues.thin_content });
      }

      // Check if page has Elementor
      if (p.meta?._elementor_edit_mode === "builder") {
        hasElementor = true;
      }

      // Score
      let score = 100;
      for (const issue of issues) {
        if (issue.type === "error") score -= 20;
        if (issue.type === "warning") score -= 10;
        if (issue.type === "info") score -= 2;
      }
      score = Math.max(0, Math.min(100, score));

      return { id: p.id, title, slug: p.slug, link: p.link, status: p.status, score, wordCount, hasElementor, issues };
    });

    allPages.sort((a, b) => a.score - b.score);

    const siteScore = allPages.length > 0
      ? Math.round(allPages.reduce((sum, p) => sum + p.score, 0) / allPages.length)
      : 100;

    return NextResponse.json({
      pages: allPages,
      siteScore,
      totalPages: allPages.length,
      pagesWithIssues: allPages.filter((p) => p.issues.length > 0).length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
