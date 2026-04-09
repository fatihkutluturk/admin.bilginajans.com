import { NextRequest, NextResponse } from "next/server";
import { getTemplateWithMeta } from "@/lib/wordpress";
import { extractTextWidgets, extractImageWidgets, applyTextUpdates, applyImageAltUpdates, renderContentFromElementor } from "@/lib/elementor";
import { ElementorElement } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const template = await getTemplateWithMeta(Number(id));

    const rawData = template.meta?._elementor_data;
    if (!rawData) {
      return NextResponse.json(
        { error: "No Elementor data found for this template" },
        { status: 404 }
      );
    }

    const elementorData: ElementorElement[] =
      typeof rawData === "string" ? JSON.parse(rawData) : rawData;
    const widgets = extractTextWidgets(elementorData);
    const images = extractImageWidgets(elementorData);

    return NextResponse.json({
      pageId: Number(id),
      title: template.title?.raw || template.title?.rendered || "",
      templateType: template.meta?._elementor_template_type || "unknown",
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
    const templateId = Number(id);
    const { updates } = (await req.json()) as {
      updates: Record<string, string>;
    };

    const template = await getTemplateWithMeta(templateId);
    const rawData = template.meta?._elementor_data;
    if (!rawData) {
      return NextResponse.json(
        { error: "No Elementor data found" },
        { status: 404 }
      );
    }

    const elementorData: ElementorElement[] =
      typeof rawData === "string" ? JSON.parse(rawData) : rawData;

    const updated = applyTextUpdates(elementorData, updates);
    const updatedJson = JSON.stringify(updated);
    const renderedContent = renderContentFromElementor(updated);

    // Save Elementor data + rendered content for templates
    const base = process.env.WP_URL!.replace(/\/$/, "");
    const credentials = Buffer.from(
      `${process.env.WP_USERNAME!}:${process.env.WP_APP_PASSWORD!}`
    ).toString("base64");

    const res = await fetch(`${base}/wp-json/wp/v2/elementor_library/${templateId}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: renderedContent,
        meta: {
          _elementor_data: updatedJson,
          _elementor_edit_mode: "builder",
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`WP API error (${res.status}): ${err}`);
    }

    return NextResponse.json({
      success: true,
      updatedWidgets: Object.keys(updates).length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
