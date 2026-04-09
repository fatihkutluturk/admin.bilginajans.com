import "server-only";
import * as wp from "./wordpress";

const WRITE_TOOLS = new Set([
  "create_post",
  "update_post",
  "delete_post",
  "create_page",
  "update_page",
  "delete_page",
  "upload_media",
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
      return wp.getPost(args.id as number);
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
      return wp.getPage(args.id as number);
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
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
