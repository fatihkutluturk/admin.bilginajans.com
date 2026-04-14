import "server-only";
import * as wp from "./wordpress";
import { saveSnapshot } from "./undo";

const WRITE_TOOLS = new Set([
  "create_post",
  "update_post",
  "delete_post",
  "create_page",
  "update_page",
  "delete_page",
  "upload_media",
  "update_elementor_styles",
  "clone_element",
]);

const KNOWN_TOOLS = new Set([
  "list_posts",
  "get_post",
  "create_post",
  "update_post",
  "delete_post",
  "list_pages",
  "get_page",
  "create_page",
  "update_page",
  "delete_page",
  "list_categories",
  "get_category",
  "list_tags",
  "get_tag",
  "upload_media",
  "get_site_info",
  "get_elementor_json",
  "update_elementor_styles",
  "list_templates",
  "clone_element",
]);

export function classifyTool(name: string): "read" | "write" {
  return WRITE_TOOLS.has(name) ? "write" : "read";
}

export function isKnownTool(name: string): boolean {
  return KNOWN_TOOLS.has(name);
}

export function summarizeAction(
  name: string,
  args: Record<string, unknown>
): string {
  switch (name) {
    case "create_post":
      return `Create a ${args.status || "draft"} post titled "${args.title}"`;
    case "update_post":
      return `Update post #${args.id}${args.title ? ` — new title: "${args.title}"` : ""}${args.status ? ` — status: ${args.status}` : ""}`;
    case "delete_post":
      return `Delete post #${args.id}${args.force ? " permanently" : " (move to trash)"}`;
    case "create_page":
      return `Create a ${args.status || "draft"} page titled "${args.title}"`;
    case "update_page":
      return `Update page #${args.id}${args.title ? ` — new title: "${args.title}"` : ""}`;
    case "delete_page":
      return `Delete page #${args.id}${args.force ? " permanently" : " (move to trash)"}`;
    case "upload_media":
      return `Upload media from ${args.url}${args.title ? ` as "${args.title}"` : ""}`;
    case "update_elementor_styles": {
      const patches = args.patches as Array<{ elementId: string; settings: Record<string, unknown> }> | undefined;
      const count = patches?.length || 0;
      const keys = patches?.flatMap(p => Object.keys(p.settings || {})).slice(0, 5).join(", ") || "";
      return `Update Elementor styles on ${args.content_type} #${args.id} — ${count} element(s): ${keys}`;
    }
    case "clone_element": {
      const overrides = args.text_overrides as Record<string, string> | undefined;
      const label = overrides?.["heading:title:0"] || overrides?.["heading:title"] || "element";
      return `"${label}" elementini klonlayıp ${args.content_type} #${args.page_id} sayfasına ekle`;
    }
    default:
      return `Execute ${name}`;
  }
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "list_posts":
      return wp.listPosts(args);
    case "get_post":
      try {
        return await wp.getPost(args.id as number);
      } catch {
        // Fallback: might be a page, not a post
        return wp.getPage(args.id as number);
      }
    case "create_post":
      return wp.createPost(args);
    case "update_post": {
      const { id, ...data } = args;
      return wp.updatePost(id as number, data);
    }
    case "delete_post":
      return wp.deletePost(args.id as number, args.force as boolean);
    case "list_pages":
      return wp.listPages(args);
    case "get_page":
      try {
        return await wp.getPage(args.id as number);
      } catch {
        // Fallback: might be a post, not a page
        return wp.getPost(args.id as number);
      }
    case "create_page":
      return wp.createPage(args);
    case "update_page": {
      const { id, ...data } = args;
      return wp.updatePage(id as number, data);
    }
    case "delete_page":
      return wp.deletePage(args.id as number, args.force as boolean);
    case "list_categories":
      return wp.listCategories(args);
    case "get_category":
      return wp.getCategory(args.id as number);
    case "list_tags":
      return wp.listTags(args);
    case "get_tag":
      return wp.getTag(args.id as number);
    case "upload_media":
      return wp.uploadMedia(
        args.url as string,
        args.title as string | undefined,
        args.alt_text as string | undefined
      );
    case "get_site_info":
      return wp.getSiteInfo();

    // ---- Elementor JSON editing ----
    case "get_elementor_json": {
      const { extractJsonForAI } = await import("./elementor");
      const contentType = (args.content_type as string) || "pages";
      let rawData: unknown;
      let title = "";
      let resolvedType = contentType;
      if (contentType === "templates") {
        const data = await wp.getTemplateWithMeta(args.id as number);
        rawData = data.meta?._elementor_data;
        title = data.title?.rendered || "";
      } else {
        // Try the specified type first, fall back to the other if 404
        try {
          const data = await wp.getPageWithMeta(args.id as number, contentType as "pages" | "posts");
          rawData = data.meta?._elementor_data;
          title = data.title?.rendered || "";
        } catch {
          const fallback = contentType === "posts" ? "pages" : "posts";
          const data = await wp.getPageWithMeta(args.id as number, fallback as "pages" | "posts");
          rawData = data.meta?._elementor_data;
          title = data.title?.rendered || "";
          resolvedType = fallback;
        }
      }
      if (!rawData) return { title, elements: [], note: "No Elementor data found", resolvedType };
      const elements = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
      return { title, content_type: resolvedType, elements: extractJsonForAI(elements) };
    }

    case "update_elementor_styles": {
      const { applyJsonPatches, renderContentFromElementor } = await import("./elementor");
      let contentType = (args.content_type as string) || "pages";
      const patches = args.patches as Array<{ elementId: string; settings: Record<string, unknown> }>;

      let rawData: unknown;
      if (contentType === "templates") {
        const data = await wp.getTemplateWithMeta(args.id as number);
        rawData = data.meta?._elementor_data;
      } else {
        try {
          const data = await wp.getPageWithMeta(args.id as number, contentType as "pages" | "posts");
          rawData = data.meta?._elementor_data;
        } catch {
          contentType = contentType === "posts" ? "pages" : "posts";
          const data = await wp.getPageWithMeta(args.id as number, contentType as "pages" | "posts");
          rawData = data.meta?._elementor_data;
        }
      }
      if (!rawData) throw new Error("No Elementor data found");
      const elements = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
      saveSnapshot(args.id as number, contentType, typeof rawData === "string" ? rawData as string : JSON.stringify(rawData));
      const updated = applyJsonPatches(elements, patches);
      const content = renderContentFromElementor(updated);

      if (contentType === "templates") {
        await wp.updateTemplateElementorData(args.id as number, JSON.stringify(updated), content);
      } else {
        await wp.updateElementorData(args.id as number, contentType as "pages" | "posts", JSON.stringify(updated), content);
      }
      return {
        success: true,
        patchesApplied: patches.length,
        summary: patches.map(p => `Element ${p.elementId}: ${Object.keys(p.settings).join(", ")}`),
      };
    }

    case "list_templates": {
      const params: Record<string, unknown> = { per_page: args.per_page || 50 };
      const templates = await wp.listTemplates(params) as Array<Record<string, unknown>>;
      const templateType = args.template_type as string | undefined;
      if (templateType) {
        return templates.filter((t) => {
          const meta = t.meta as Record<string, string> | undefined;
          const metaType = meta?._elementor_template_type || "";
          const title = ((t.title as Record<string, string>)?.rendered || "").toLowerCase();
          // Match by meta type OR by title containing the type name
          if (metaType === templateType) return true;
          if (templateType === "header" && title.includes("header")) return true;
          if (templateType === "footer" && title.includes("footer")) return true;
          return false;
        });
      }
      // Filter out kit templates by default
      return templates.filter((t) => {
        const meta = t.meta as Record<string, string> | undefined;
        return meta?._elementor_template_type !== "kit";
      });
    }

    case "clone_element": {
      const { cloneElementWithContent, insertElement, renderContentFromElementor } = await import("./elementor");
      let contentType = (args.content_type as string) || "pages";
      const pageId = args.page_id as number;
      const sourceId = args.source_element_id as string;
      const textOverrides = args.text_overrides as Record<string, string> || {};
      const insertAfterId = args.insert_after_id as string;

      // Read current data (with fallback)
      let rawData: unknown;
      if (contentType === "templates") {
        const data = await wp.getTemplateWithMeta(pageId);
        rawData = data.meta?._elementor_data;
      } else {
        try {
          const data = await wp.getPageWithMeta(pageId, contentType as "pages" | "posts");
          rawData = data.meta?._elementor_data;
        } catch {
          contentType = contentType === "posts" ? "pages" : "posts";
          const data = await wp.getPageWithMeta(pageId, contentType as "pages" | "posts");
          rawData = data.meta?._elementor_data;
        }
      }
      if (!rawData) throw new Error("Elementor verisi bulunamadı");
      const elements = typeof rawData === "string" ? JSON.parse(rawData) : rawData;

      // Find the source element to clone
      const source = findElementById(elements, sourceId);
      if (!source) throw new Error(`Element ${sourceId} bulunamadı`);

      // Handle button links in text_overrides
      const buttonLinkUrl = textOverrides["button:link:url"];
      const cleanOverrides = { ...textOverrides };
      delete cleanOverrides["button:link:url"];

      // Clone with text overrides
      const cloned = cloneElementWithContent(source as import("./types").ElementorElement, cleanOverrides);

      // Set button link if provided
      if (buttonLinkUrl) {
        function setBtnLink(el: Record<string, unknown>) {
          if (el.widgetType === "button") {
            const s = { ...(el.settings as Record<string, unknown>) };
            s.link = { url: buttonLinkUrl, is_external: "", nofollow: "", custom_attributes: "" };
            el.settings = s;
          }
          const ch = el.elements as Array<Record<string, unknown>> | undefined;
          if (ch) ch.forEach(setBtnLink);
        }
        setBtnLink(cloned as unknown as Record<string, unknown>);
      }

      // Find where to insert: as sibling after insert_after_id
      const parentId = findParentId(elements, insertAfterId);
      saveSnapshot(pageId, contentType, typeof rawData === "string" ? rawData as string : JSON.stringify(rawData));
      const updated = insertElement(elements, cloned, parentId, "after", insertAfterId);

      // Save
      const content = renderContentFromElementor(updated);
      if (contentType === "templates") {
        await wp.updateTemplateElementorData(pageId, JSON.stringify(updated), content);
      } else {
        await wp.updateElementorData(pageId, contentType as "pages" | "posts", JSON.stringify(updated), content);
      }

      return {
        success: true,
        clonedFrom: sourceId,
        insertedAfter: insertAfterId,
        newElementId: cloned.id,
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Helper: recursively find an element by ID
function findElementById(elements: Array<Record<string, unknown>>, id: string): Record<string, unknown> | null {
  for (const el of elements) {
    if (el.id === id) return el;
    const children = el.elements as Array<Record<string, unknown>> | undefined;
    if (children?.length) {
      const found = findElementById(children, id);
      if (found) return found;
    }
  }
  return null;
}

// Helper: find the parent ID of an element
function findParentId(elements: Array<Record<string, unknown>>, childId: string, currentParent: string | null = null): string | null {
  for (const el of elements) {
    const children = el.elements as Array<Record<string, unknown>> | undefined;
    if (children?.some(c => c.id === childId)) return el.id as string;
    if (children?.length) {
      const found = findParentId(children, childId, el.id as string);
      if (found) return found;
    }
  }
  return currentParent;
}
