import { NextRequest, NextResponse } from "next/server";
import { getPageWithMeta } from "@/lib/wordpress";
import { extractTextWidgets, extractImageWidgets, applyTextUpdates, applyImageAltUpdates, applyImageUrlUpdates, renderContentFromElementor } from "@/lib/elementor";
import { ElementorElement } from "@/lib/types";

async function wpFetchDirect(endpoint: string, options?: RequestInit) {
  const base = process.env.WP_URL!.replace(/\/$/, "");
  const url = `${base}/wp-json${endpoint}`;
  const credentials = Buffer.from(
    `${process.env.WP_USERNAME!}:${process.env.WP_APP_PASSWORD!}`
  ).toString("base64");

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WP API error (${response.status}): ${error}`);
  }

  return response.json();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const page = await getPageWithMeta(Number(id));

    const rawData = page.meta?._elementor_data;
    if (!rawData) {
      return NextResponse.json(
        { error: "No Elementor data found for this page" },
        { status: 404 }
      );
    }

    const elementorData: ElementorElement[] =
      typeof rawData === "string" ? JSON.parse(rawData) : rawData;
    const widgets = extractTextWidgets(elementorData);
    const images = extractImageWidgets(elementorData);

    return NextResponse.json({
      pageId: Number(id),
      title: page.title?.raw || page.title?.rendered || "",
      totalSections: elementorData.length,
      widgets,
      images,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pageId = Number(id);
    const { updates, imageAltUpdates, imageUrlUpdates } = (await req.json()) as {
      updates?: Record<string, string>;
      imageAltUpdates?: Record<string, string>;
      imageUrlUpdates?: Record<string, { url: string; id: number }>;
    };

    // Fetch current Elementor data
    const page = await getPageWithMeta(pageId);
    const rawData = page.meta?._elementor_data;
    if (!rawData) {
      return NextResponse.json(
        { error: "No Elementor data found" },
        { status: 404 }
      );
    }

    const elementorData: ElementorElement[] =
      typeof rawData === "string" ? JSON.parse(rawData) : rawData;

    // Apply text updates
    let updated = updates ? applyTextUpdates(elementorData, updates) : elementorData;

    // Apply image alt updates
    if (imageAltUpdates && Object.keys(imageAltUpdates).length > 0) {
      updated = applyImageAltUpdates(updated, imageAltUpdates);
    }

    // Apply image URL replacements (from stock photos)
    if (imageUrlUpdates && Object.keys(imageUrlUpdates).length > 0) {
      updated = applyImageUrlUpdates(updated, imageUrlUpdates);
    }
    const updatedJson = JSON.stringify(updated);

    // Generate rendered HTML for the content field
    // This is what the live site uses to display the page
    const renderedContent = renderContentFromElementor(updated);

    // Save everything in one call: Elementor data + rendered content + meta
    await wpFetchDirect(`/wp/v2/pages/${pageId}`, {
      method: "POST",
      body: JSON.stringify({
        content: renderedContent,
        meta: {
          _elementor_data: updatedJson,
          _elementor_edit_mode: "builder",
        },
      }),
    });

    // Clear Elementor CSS cache
    try {
      await wpFetchDirect(`/wp/v2/pages/${pageId}`, {
        method: "POST",
        body: JSON.stringify({
          meta: { _elementor_css: "" },
        }),
      });
    } catch {
      // CSS cache clear is optional
    }

    return NextResponse.json({
      success: true,
      updatedWidgets: Object.keys(updates || {}).length + Object.keys(imageAltUpdates || {}).length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
