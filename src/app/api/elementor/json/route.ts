import { NextRequest, NextResponse } from "next/server";
import { getPageWithMeta, updateElementorData, getTemplateWithMeta, updateTemplateElementorData } from "@/lib/wordpress";
import { extractJsonForAI, applyJsonPatches, renderContentFromElementor, type ElementorPatch } from "@/lib/elementor";
import { ElementorElement } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const id = Number(req.nextUrl.searchParams.get("id"));
    const type = req.nextUrl.searchParams.get("type") || "pages";
    if (!id) return NextResponse.json({ error: "id parameter required" }, { status: 400 });

    let rawData: unknown;
    let title = "";

    if (type === "templates") {
      const data = await getTemplateWithMeta(id);
      rawData = data.meta?._elementor_data;
      title = data.title?.rendered || "";
    } else {
      const data = await getPageWithMeta(id, type as "pages" | "posts");
      rawData = data.meta?._elementor_data;
      title = data.title?.rendered || data.title?.raw || "";
    }

    if (!rawData) return NextResponse.json({ title, elements: [] });

    const elements: ElementorElement[] = typeof rawData === "string" ? JSON.parse(rawData) : rawData as ElementorElement[];
    const aiJson = extractJsonForAI(elements);

    return NextResponse.json({ title, elements: aiJson });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, type, patches } = (await req.json()) as {
      id: number;
      type: string;
      patches: ElementorPatch[];
    };
    if (!id || !patches?.length) {
      return NextResponse.json({ error: "id and patches required" }, { status: 400 });
    }

    // Read current data
    let rawData: unknown;
    if (type === "templates") {
      const data = await getTemplateWithMeta(id);
      rawData = data.meta?._elementor_data;
    } else {
      const data = await getPageWithMeta(id, type as "pages" | "posts");
      rawData = data.meta?._elementor_data;
    }

    if (!rawData) return NextResponse.json({ error: "No Elementor data found" }, { status: 404 });
    const elements: ElementorElement[] = typeof rawData === "string" ? JSON.parse(rawData) : rawData as ElementorElement[];

    // Apply patches
    const updated = applyJsonPatches(elements, patches);

    // Generate content HTML
    const content = renderContentFromElementor(updated);

    // Save
    if (type === "templates") {
      await updateTemplateElementorData(id, JSON.stringify(updated), content);
    } else {
      await updateElementorData(id, type as "pages" | "posts", JSON.stringify(updated), content);
    }

    return NextResponse.json({
      success: true,
      patchesApplied: patches.length,
      summary: patches.map(p => `Element ${p.elementId}: ${Object.keys(p.settings).join(", ")}`),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
