import { NextRequest, NextResponse } from "next/server";
import { generateImageSearchTerms } from "@/lib/gemini";
import { getUnsplashKey } from "@/lib/prompts";
import { uploadMedia } from "@/lib/wordpress";

type ImageInput = {
  widgetId: string;
  sectionIndex: number;
  currentAlt: string;
};

type ImageResult = {
  widgetId: string;
  searchTerm: string;
  wpMediaId: number;
  wpUrl: string;
  alt: string;
  error?: string;
};

export async function POST(req: NextRequest) {
  try {
    const { pageBrief, images, language } = (await req.json()) as {
      pageBrief: string;
      images: ImageInput[];
      language?: string;
    };

    if (!pageBrief || !images?.length) {
      return NextResponse.json({ error: "pageBrief and images required" }, { status: 400 });
    }

    const unsplashKey = getUnsplashKey();
    if (!unsplashKey) {
      return NextResponse.json({ error: "Unsplash API anahtarı gerekli. Ayarlar'dan ekleyin." }, { status: 400 });
    }

    // Step 1: Generate search terms via Gemini
    const { images: searchTerms } = await generateImageSearchTerms(
      pageBrief,
      images,
      language || "tr"
    );

    // Step 2 & 3: For each image, search Unsplash and upload first result
    const results: ImageResult[] = [];

    for (const img of images) {
      const termEntry = searchTerms.find((t) => t.widgetId === img.widgetId);
      const searchTerm = termEntry?.searchTerm || pageBrief.split(" ").slice(0, 3).join(" ");

      try {
        // Search Unsplash
        const searchUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchTerm)}&per_page=1&orientation=landscape`;
        const searchRes = await fetch(searchUrl, {
          headers: { Authorization: `Client-ID ${unsplashKey}` },
        });

        if (!searchRes.ok) {
          results.push({ widgetId: img.widgetId, searchTerm, wpMediaId: 0, wpUrl: "", alt: "", error: `Unsplash ${searchRes.status}` });
          continue;
        }

        const searchData = await searchRes.json();
        const photo = searchData.results?.[0];

        if (!photo) {
          results.push({ widgetId: img.widgetId, searchTerm, wpMediaId: 0, wpUrl: "", alt: "", error: "Sonuç bulunamadı" });
          continue;
        }

        // Upload to WordPress
        const uploaded = await uploadMedia(photo.urls.regular, searchTerm, photo.alt_description || searchTerm);

        results.push({
          widgetId: img.widgetId,
          searchTerm,
          wpMediaId: uploaded.id,
          wpUrl: uploaded.source_url || uploaded.guid?.rendered || "",
          alt: photo.alt_description || searchTerm,
        });

        // Trigger Unsplash download tracking (required by API terms)
        if (photo.links?.download_location) {
          fetch(photo.links.download_location, {
            headers: { Authorization: `Client-ID ${unsplashKey}` },
          }).catch(() => {});
        }
      } catch (err) {
        results.push({
          widgetId: img.widgetId,
          searchTerm,
          wpMediaId: 0,
          wpUrl: "",
          alt: "",
          error: err instanceof Error ? err.message : "Upload failed",
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
