import { NextRequest, NextResponse } from "next/server";
import { listPages, listPosts, listCategories, listTemplates } from "@/lib/wordpress";
import { generateContentIdeas } from "@/lib/gemini";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const { customTopic } = (await req.json()) as { customTopic?: string };

    const [pages, posts, categories, templates] = await Promise.all([
      listPages({ per_page: "100" }).catch(() => []),
      listPosts({ per_page: "100" }).catch(() => []),
      listCategories({ per_page: "100" }).catch(() => []),
      listTemplates({ per_page: "50" }).catch(() => []),
    ]);

    type WPItem = { title: { rendered: string }; slug: string; excerpt: { rendered: string } };
    type WPCat = { name: string; count: number };
    type WPTemplate = { id: number; title: { rendered: string }; meta: { _elementor_template_type?: string } };

    const pagesSummary = (pages as WPItem[])
      .map((p) => `- Page: "${stripHtml(p.title.rendered)}" (/${p.slug}) — ${stripHtml(p.excerpt.rendered).slice(0, 100)}`)
      .join("\n");

    const postsSummary = (posts as WPItem[])
      .map((p) => `- Post: "${stripHtml(p.title.rendered)}" (/${p.slug}) — ${stripHtml(p.excerpt.rendered).slice(0, 100)}`)
      .join("\n");

    const categoriesSummary = (categories as WPCat[])
      .map((c) => `- Category: "${c.name}" (${c.count} posts)`)
      .join("\n");

    const templateNames = (templates as WPTemplate[])
      .filter((t) => t.meta?._elementor_template_type !== "kit")
      .map((t) => stripHtml(t.title.rendered));

    const siteContext = `PAGES:\n${pagesSummary || "None"}\n\nPOSTS:\n${postsSummary || "None"}\n\nCATEGORIES:\n${categoriesSummary || "None"}`;

    const result = await generateContentIdeas(siteContext, templateNames, customTopic);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
