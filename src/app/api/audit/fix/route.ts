import { NextRequest, NextResponse } from "next/server";
import { getPageWithMeta, updateElementorData } from "@/lib/wordpress";
import {
  extractTextWidgets,
  extractImageWidgets,
  applyTextUpdates,
  applyImageAltUpdates,
  renderContentFromElementor,
} from "@/lib/elementor";
import { generateElementorContent, generateAltTexts } from "@/lib/gemini";
import { auditPage } from "@/lib/audit";
import { ElementorElement } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { pageId } = (await req.json()) as { pageId?: number };
    if (!pageId) {
      return NextResponse.json({ error: "pageId required" }, { status: 400 });
    }

    const page = await getPageWithMeta(Number(pageId));
    const rawData = page.meta?._elementor_data;
    if (!rawData) {
      return NextResponse.json(
        { error: "No Elementor data on this page" },
        { status: 404 }
      );
    }

    const elementorData: ElementorElement[] =
      typeof rawData === "string" ? JSON.parse(rawData) : rawData;

    const titleRaw = page.title?.raw || page.title?.rendered || page.slug || "";
    const brief = String(titleRaw).replace(/<[^>]*>/g, "").trim();

    const allTextWidgets = extractTextWidgets(elementorData);
    const textTargets = allTextWidgets.filter((w) => w.isPlaceholder);

    const allImages = extractImageWidgets(elementorData);
    const altTargets = allImages.filter(
      (i) => i.imageUrl && !i.altText.trim()
    );

    if (textTargets.length === 0 && altTargets.length === 0) {
      return NextResponse.json({ success: true, fixed: 0, message: "Nothing to fix" });
    }

    const textUpdates: Record<string, string> = {};
    if (textTargets.length > 0) {
      const aiPayload = textTargets.map((w) => ({
        widgetId: w.key,
        widgetType: w.widgetType,
        sectionIndex: w.sectionIndex,
        currentText: w.currentText,
        fieldLabel: w.fieldLabel,
      }));
      const result = await generateElementorContent(brief, aiPayload, "tr");
      for (const item of result.widgets || []) {
        if (item.widgetId && typeof item.text === "string") {
          textUpdates[item.widgetId] = item.text;
        }
      }
    }

    const altUpdates: Record<string, string> = {};
    if (altTargets.length > 0) {
      const result = await generateAltTexts(
        altTargets.map((i) => ({ widgetId: i.widgetId, imageUrl: i.imageUrl })),
        brief,
        "tr"
      );
      for (const item of result.images || []) {
        if (item.widgetId && typeof item.altText === "string") {
          altUpdates[item.widgetId] = item.altText;
        }
      }
    }

    let updated = elementorData;
    if (Object.keys(textUpdates).length > 0) {
      updated = applyTextUpdates(updated, textUpdates);
    }
    if (Object.keys(altUpdates).length > 0) {
      updated = applyImageAltUpdates(updated, altUpdates);
    }

    const updatedJson = JSON.stringify(updated);
    const renderedContent = renderContentFromElementor(updated);

    await updateElementorData(Number(pageId), "pages", updatedJson, renderedContent);

    const refreshed = await getPageWithMeta(Number(pageId));
    const newAudit = auditPage(refreshed);

    return NextResponse.json({
      success: true,
      fixed: Object.keys(textUpdates).length + Object.keys(altUpdates).length,
      audit: newAudit,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
