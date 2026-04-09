import "server-only";
import { SiteConfig } from "./types";
import { getCached, setCache, invalidateCache } from "./cache";

function getDefaultSite(): SiteConfig {
  return {
    url: process.env.WP_URL!,
    username: process.env.WP_USERNAME!,
    appPassword: process.env.WP_APP_PASSWORD!,
  };
}

async function wpFetch(
  endpoint: string,
  options?: RequestInit & { site?: SiteConfig; skipCache?: boolean }
) {
  const site = options?.site ?? getDefaultSite();
  const { site: _, skipCache, ...fetchOptions } = options ?? {};
  const base = site.url.replace(/\/$/, "");
  const url = `${base}/wp-json${endpoint}`;
  const method = fetchOptions?.method?.toUpperCase() || "GET";

  // Cache GET requests
  if (method === "GET" && !skipCache) {
    const cached = getCached(url);
    if (cached) return cached;
  }

  const credentials = Buffer.from(
    `${site.username}:${site.appPassword}`
  ).toString("base64");

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
      ...fetchOptions?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WP API error (${response.status}): ${error}`);
  }

  const data = await response.json();

  // Cache GET responses
  if (method === "GET") {
    setCache(url, data);
  }

  // Invalidate cache on writes
  if (method === "POST" || method === "PUT" || method === "DELETE") {
    // Invalidate list caches when an item is modified
    const resourceType = endpoint.match(/\/wp\/v2\/(\w+)/)?.[1];
    if (resourceType) {
      invalidateCache(`/wp/v2/${resourceType}`);
    }
  }

  return data;
}

// ---- Posts ----

export async function listPosts(params?: Record<string, unknown>) {
  const query = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.set(key, String(value));
    }
  }
  const qs = query.toString();
  return wpFetch(`/wp/v2/posts${qs ? `?${qs}` : ""}`);
}

export async function getPost(id: number) {
  return wpFetch(`/wp/v2/posts/${id}`);
}

export async function createPost(data: Record<string, unknown>) {
  return wpFetch("/wp/v2/posts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePost(id: number, data: Record<string, unknown>) {
  return wpFetch(`/wp/v2/posts/${id}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deletePost(id: number, force?: boolean) {
  return wpFetch(`/wp/v2/posts/${id}${force ? "?force=true" : ""}`, {
    method: "DELETE",
  });
}

// ---- Pages ----

export async function listPages(params?: Record<string, unknown>) {
  const query = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.set(key, String(value));
    }
  }
  const qs = query.toString();
  return wpFetch(`/wp/v2/pages${qs ? `?${qs}` : ""}`);
}

export async function getPage(id: number) {
  return wpFetch(`/wp/v2/pages/${id}`);
}

export async function createPage(data: Record<string, unknown>) {
  return wpFetch("/wp/v2/pages", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePage(id: number, data: Record<string, unknown>) {
  return wpFetch(`/wp/v2/pages/${id}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deletePage(id: number, force?: boolean) {
  return wpFetch(`/wp/v2/pages/${id}${force ? "?force=true" : ""}`, {
    method: "DELETE",
  });
}

// ---- Categories ----

export async function listCategories(params?: Record<string, unknown>) {
  const query = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.set(key, String(value));
    }
  }
  const qs = query.toString();
  return wpFetch(`/wp/v2/categories${qs ? `?${qs}` : ""}`);
}

export async function getCategory(id: number) {
  return wpFetch(`/wp/v2/categories/${id}`);
}

// ---- Tags ----

export async function listTags(params?: Record<string, unknown>) {
  const query = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.set(key, String(value));
    }
  }
  const qs = query.toString();
  return wpFetch(`/wp/v2/tags${qs ? `?${qs}` : ""}`);
}

export async function getTag(id: number) {
  return wpFetch(`/wp/v2/tags/${id}`);
}

// ---- Media ----

export async function uploadMedia(
  imageUrl: string,
  title?: string,
  altText?: string
) {
  const site = getDefaultSite();
  const base = site.url.replace(/\/$/, "");

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image from ${imageUrl}`);
  }

  const contentType =
    imageResponse.headers.get("content-type") || "image/jpeg";
  const buffer = await imageResponse.arrayBuffer();
  const filename =
    imageUrl.split("/").pop()?.split("?")[0] || "upload.jpg";

  const credentials = Buffer.from(
    `${site.username}:${site.appPassword}`
  ).toString("base64");

  const response = await fetch(`${base}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
    body: Buffer.from(buffer),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Media upload failed (${response.status}): ${error}`);
  }

  const media = await response.json();

  if (altText || title) {
    return wpFetch(`/wp/v2/media/${media.id}`, {
      method: "POST",
      body: JSON.stringify({
        ...(title && { title }),
        ...(altText && { alt_text: altText }),
      }),
    });
  }

  return media;
}

// ---- Elementor ----

export async function getPageWithMeta(id: number) {
  return wpFetch(`/wp/v2/pages/${id}?context=edit`);
}

export async function updateElementorData(id: number, elementorData: string) {
  return wpFetch(`/wp/v2/pages/${id}`, {
    method: "POST",
    body: JSON.stringify({
      meta: { _elementor_data: elementorData },
    }),
  });
}

export async function getPostWithMeta(id: number) {
  return wpFetch(`/wp/v2/posts/${id}?context=edit`);
}

export async function updatePostElementorData(id: number, elementorData: string) {
  return wpFetch(`/wp/v2/posts/${id}`, {
    method: "POST",
    body: JSON.stringify({
      meta: { _elementor_data: elementorData },
    }),
  });
}

// ---- Elementor Library (Templates) ----

export async function listTemplates(params?: Record<string, unknown>) {
  const query = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.set(key, String(value));
    }
  }
  const qs = query.toString();
  return wpFetch(`/wp/v2/elementor_library${qs ? `?${qs}` : ""}`);
}

export async function getTemplateWithMeta(id: number) {
  return wpFetch(`/wp/v2/elementor_library/${id}?context=edit`);
}

export async function updateTemplateElementorData(id: number, elementorData: string) {
  return wpFetch(`/wp/v2/elementor_library/${id}`, {
    method: "POST",
    body: JSON.stringify({
      meta: { _elementor_data: elementorData },
    }),
  });
}

// ---- Site Info ----

export async function getSiteInfo() {
  return wpFetch("");
}
