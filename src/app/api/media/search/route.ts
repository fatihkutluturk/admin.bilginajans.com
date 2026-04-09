import { NextRequest, NextResponse } from "next/server";

export type UnsplashPhoto = {
  id: string;
  urls: { small: string; regular: string; full: string; thumb: string };
  alt_description: string | null;
  description: string | null;
  user: { name: string; links: { html: string } };
  width: number;
  height: number;
  links: { download_location: string };
};

export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get("q");
    const page = req.nextUrl.searchParams.get("page") || "1";
    const perPage = req.nextUrl.searchParams.get("per_page") || "12";

    if (!query) {
      return NextResponse.json({ error: "q parameter required" }, { status: 400 });
    }

    const { getUnsplashKey } = await import("@/lib/prompts");
    const apiKey = getUnsplashKey();

    // Use Unsplash API (with key) or the public search endpoint
    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", query);
    url.searchParams.set("page", page);
    url.searchParams.set("per_page", perPage);
    url.searchParams.set("orientation", "landscape");

    const headers: Record<string, string> = {
      "Accept-Version": "v1",
    };

    if (apiKey) {
      headers["Authorization"] = `Client-ID ${apiKey}`;
    } else {
      // Demo/public access — very limited rate
      headers["Authorization"] = `Client-ID demo`;
    }

    const res = await fetch(url.toString(), { headers });

    if (!res.ok) {
      const errText = await res.text();
      // If rate limited or no key, return empty results with a message
      if (res.status === 403 || res.status === 401) {
        return NextResponse.json({
          results: [],
          total: 0,
          message: "Unsplash API anahtarı gerekli. .env.local dosyasına UNSPLASH_ACCESS_KEY ekleyin.",
        });
      }
      throw new Error(`Unsplash API error (${res.status}): ${errText}`);
    }

    const data = await res.json();

    const results = (data.results || []).map((photo: UnsplashPhoto) => ({
      id: photo.id,
      thumb: photo.urls.thumb,
      small: photo.urls.small,
      regular: photo.urls.regular,
      full: photo.urls.full,
      alt: photo.alt_description || photo.description || "",
      photographer: photo.user.name,
      photographerUrl: photo.user.links.html,
      width: photo.width,
      height: photo.height,
      downloadUrl: photo.links.download_location,
    }));

    return NextResponse.json({
      results,
      total: data.total || 0,
      totalPages: data.total_pages || 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 }
    );
  }
}
