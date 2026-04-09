"use client";

import useSWR, { mutate } from "swr";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function usePages(search?: string) {
  const params = new URLSearchParams({ per_page: "50" });
  if (search) params.set("search", search);
  const key = `/api/pages?${params}`;

  const { data, error, isLoading } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });

  return { pages: data || [], error, isLoading };
}

export function usePosts(search?: string) {
  const params = new URLSearchParams({ per_page: "50" });
  if (search) params.set("search", search);
  const key = `/api/posts?${params}`;

  const { data, error, isLoading } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });

  return { posts: data || [], error, isLoading };
}

export function useTemplates() {
  const { data, error, isLoading } = useSWR("/api/templates?per_page=50", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  return { templates: data || [], error, isLoading };
}

export function usePageElementor(type: string, id: number) {
  const key = `/api/${type}/${id}/elementor`;

  const { data, error, isLoading } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });

  return { data, error, isLoading };
}

export function refreshPages() {
  mutate((key: string) => typeof key === "string" && key.startsWith("/api/pages"), undefined, { revalidate: true });
}

export function refreshPosts() {
  mutate((key: string) => typeof key === "string" && key.startsWith("/api/posts"), undefined, { revalidate: true });
}

export function refreshElementor(type: string, id: number) {
  mutate(`/api/${type}/${id}/elementor`);
}
