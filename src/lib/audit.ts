import "server-only";
import { ElementorElement, AuditIssue, PageAudit } from "./types";
import { tr } from "./tr";

const PLACEHOLDER_PATTERNS = [
  /lorem ipsum/i,
  /dolor sit amet/i,
  /consectetur adipiscing/i,
  /let'?s make app/i,
  /hours of expertise/i,
  /retention rate/i,
  /average traffic increase/i,
  /calls generated/i,
];

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function countWords(text: string): number {
  const clean = stripHtml(text);
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

function isPlaceholder(text: string): boolean {
  const clean = stripHtml(text).toLowerCase();
  return PLACEHOLDER_PATTERNS.some((p) => p.test(clean));
}

export function auditPage(page: {
  id: number;
  title: { rendered?: string; raw?: string };
  slug: string;
  link: string;
  status: string;
  meta?: {
    _elementor_data?: string;
    _elementor_edit_mode?: string;
  };
  yoast_head_json?: {
    description?: string;
    og_description?: string;
  };
  content?: { rendered?: string; raw?: string };
}): PageAudit {
  const issues: AuditIssue[] = [];
  const title = stripHtml(page.title?.raw || page.title?.rendered || "");
  let totalWords = 0;
  let hasElementor = false;

  // Check Elementor data
  const rawElementor = page.meta?._elementor_data;
  if (rawElementor && rawElementor.length > 10) {
    hasElementor = true;
    try {
      const elements: ElementorElement[] =
        typeof rawElementor === "string" ? JSON.parse(rawElementor) : rawElementor;

      const headings: { tag: string; text: string }[] = [];

      function scanElements(els: ElementorElement[]) {
        for (const el of els) {
          if (!el || typeof el !== "object") continue;

          if (el.elType === "widget") {
            const settings = el.settings || {};
            const wtype = el.widgetType || "";

            // Collect text for word count
            const textFields: string[] = [];
            if (wtype === "heading") {
              const t = String(settings.title || "");
              textFields.push(t);
              headings.push({
                tag: String(settings.header_size || "h2"),
                text: t,
              });
            }
            if (wtype === "text-editor") {
              const t = String(settings.editor || "");
              textFields.push(t);
              // Check for empty text-editor (shows Lorem on frontend)
              if (!t.trim()) {
                issues.push({
                  type: "error",
                  code: "empty_widget",
                  message: tr.audit.issues.empty_widget,
                  widgetId: el.id,
                });
              }
            }
            if (wtype === "icon-box") {
              textFields.push(String(settings.title_text || ""));
              textFields.push(String(settings.description_text || ""));
            }
            if (wtype === "counter") {
              textFields.push(String(settings.title || ""));
            }
            if (wtype === "button") {
              textFields.push(String(settings.text || ""));
            }

            // Check image widgets for missing alt text
            if (["image", "image-box", "image-carousel", "image-gallery"].includes(wtype)) {
              const img = settings.image as { url?: string; alt?: string } | undefined;
              if (img?.url && (!img.alt || !img.alt.trim())) {
                issues.push({
                  type: "warning",
                  code: "missing_alt",
                  message: tr.audit.issues.missing_alt,
                  widgetId: el.id,
                });
              }
            }

            // Check for placeholder text
            for (const text of textFields) {
              if (text && isPlaceholder(text)) {
                issues.push({
                  type: "error",
                  code: "placeholder",
                  message: tr.audit.issues.placeholder,
                  widgetId: el.id,
                });
                break; // one per widget is enough
              }
              totalWords += countWords(text);
            }
          }

          if (Array.isArray(el.elements)) {
            scanElements(el.elements);
          }
        }
      }

      scanElements(elements);

      // Heading analysis
      const h1s = headings.filter((h) => h.tag === "h1");
      if (h1s.length === 0) {
        issues.push({
          type: "warning",
          code: "heading_h1_missing",
          message: tr.audit.issues.heading_h1_missing,
        });
      }
      if (h1s.length > 1) {
        issues.push({
          type: "warning",
          code: "heading_multiple_h1",
          message: tr.audit.issues.heading_multiple_h1,
        });
      }

      // Check for skipped heading levels
      const usedLevels = new Set(
        headings
          .map((h) => {
            const m = h.tag.match(/h(\d)/);
            return m ? parseInt(m[1]) : 0;
          })
          .filter((n) => n > 0)
      );
      const sortedLevels = [...usedLevels].sort();
      for (let i = 1; i < sortedLevels.length; i++) {
        if (sortedLevels[i] - sortedLevels[i - 1] > 1) {
          issues.push({
            type: "info",
            code: "heading_skipped",
            message: tr.audit.issues.heading_skipped,
          });
          break;
        }
      }
    } catch {
      // Invalid JSON — treat as no Elementor
      hasElementor = false;
    }
  } else {
    // No Elementor data — count words from content field
    const content = page.content?.rendered || page.content?.raw || "";
    totalWords = countWords(content);

    if (content && isPlaceholder(content)) {
      issues.push({
        type: "error",
        code: "placeholder",
        message: tr.audit.issues.placeholder,
      });
    }

    issues.push({
      type: "info",
      code: "no_elementor",
      message: tr.audit.issues.no_elementor,
    });
  }

  // Thin content check
  if (totalWords < 300 && page.status === "publish") {
    issues.push({
      type: "warning",
      code: "thin_content",
      message: tr.audit.issues.thin_content,
    });
  }

  // Yoast meta check
  const metaDesc =
    page.yoast_head_json?.description ||
    page.yoast_head_json?.og_description;
  if (!metaDesc && page.status === "publish") {
    issues.push({
      type: "warning",
      code: "missing_meta",
      message: tr.audit.issues.missing_meta,
    });
  }

  // Calculate score (0-100)
  let score = 100;
  for (const issue of issues) {
    if (issue.type === "error") score -= 20;
    if (issue.type === "warning") score -= 10;
    if (issue.type === "info") score -= 2;
  }
  score = Math.max(0, Math.min(100, score));

  return {
    id: page.id,
    title,
    slug: page.slug,
    link: page.link,
    status: page.status,
    score,
    wordCount: totalWords,
    hasElementor,
    issues,
  };
}
