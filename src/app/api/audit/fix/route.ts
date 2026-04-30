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

type Mode = "preview" | "apply";

type TextChange = { key: string; fieldLabel: string; before: string; after: string };
type AltChange = { widgetId: string; imageUrl: string; before: string; after: string };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      pageId?: number;
      mode?: Mode;
      textUpdates?: Record<string, string>;
      altUpdates?: Record<string, string>;
    };
    const { pageId, mode = "preview" } = body;
    if (!pageId) {
      return NextResponse.json({ error: "pageId required" }, { status: 400 });
    }

    if (mode === "apply") {
      return await applyFix(Number(pageId), body.textUpdates || {}, body.altUpdates || {});
    }

    return await previewFix(Number(pageId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

async function previewFix(pageId: number) {
  const page = await getPageWithMeta(pageId);
  const rawData = page.meta?._elementor_data;
  if (!rawData) {
    return NextResponse.json({ error: "No Elementor data on this page" }, { status: 404 });
  }

  const elementorData: ElementorElement[] =
    typeof rawData === "string" ? JSON.parse(rawData) : rawData;

  const titleRaw = page.title?.raw || page.title?.rendered || page.slug || "";
  const brief = String(titleRaw).replace(/<[^>]*>/g, "").trim();

  const allTextWidgets = extractTextWidgets(elementorData);
  const textTargets = allTextWidgets.filter((w) => w.isPlaceholder);

  const allImages = extractImageWidgets(elementorData);
  const altTargets = allImages.filter((i) => i.imageUrl && !i.altText.trim());

  if (textTargets.length === 0 && altTargets.length === 0) {
    return NextResponse.json({
      success: true,
      pageId,
      pageTitle: brief,
      pageSlug: page.slug,
      textChanges: [],
      altChanges: [],
      totalChanges: 0,
    });
  }

  const textChanges: TextChange[] = [];
  if (textTargets.length > 0) {
    const aiPayload = textTargets.map((w) => ({
      widgetId: w.key,
      widgetType: w.widgetType,
      sectionIndex: w.sectionIndex,
      currentText: w.currentText,
      fieldLabel: w.fieldLabel,
    }));
    const result = await generateElementorContent(brief, aiPayload, "tr");
    const aiByKey: Record<string, string> = {};
    for (const item of result.widgets || []) {
      if (item.widgetId && typeof item.text === "string") aiByKey[item.widgetId] = item.text;
    }
    for (const w of textTargets) {
      const after = aiByKey[w.key];
      if (typeof after === "string" && after !== w.currentText) {
        textChanges.push({
          key: w.key,
          fieldLabel: w.fieldLabel,
          before: w.currentText,
          after,
        });
      }
    }
  }

  const altChanges: AltChange[] = [];
  if (altTargets.length > 0) {
    const result = await generateAltTexts(
      altTargets.map((i) => ({ widgetId: i.widgetId, imageUrl: i.imageUrl })),
      brief,
      "tr"
    );
    const aiByWidget: Record<string, string> = {};
    for (const item of result.images || []) {
      if (item.widgetId && typeof item.altText === "string") aiByWidget[item.widgetId] = item.altText;
    }
    for (const img of altTargets) {
      const after = aiByWidget[img.widgetId];
      if (typeof after === "string" && after.trim()) {
        altChanges.push({
          widgetId: img.widgetId,
          imageUrl: img.imageUrl,
          before: img.altText,
          after,
        });
      }
    }
  }

  return NextResponse.json({
    success: true,
    pageId,
    pageTitle: brief,
    pageSlug: page.slug,
    textChanges,
    altChanges,
    totalChanges: textChanges.length + altChanges.length,
  });
}

async function applyFix(
  pageId: number,
  textUpdates: Record<string, string>,
  altUpdates: Record<string, string>
) {
  const page = await getPageWithMeta(pageId);
  const rawData = page.meta?._elementor_data;
  if (!rawData) {
    return NextResponse.json({ error: "No Elementor data" }, { status: 404 });
  }

  const elementorData: ElementorElement[] =
    typeof rawData === "string" ? JSON.parse(rawData) : rawData;

  let updated = elementorData;
  if (Object.keys(textUpdates).length > 0) updated = applyTextUpdates(updated, textUpdates);
  if (Object.keys(altUpdates).length > 0) updated = applyImageAltUpdates(updated, altUpdates);

  const updatedJson = JSON.stringify(updated);
  const renderedContent = renderContentFromElementor(updated);

  await updateElementorData(pageId, "pages", updatedJson, renderedContent);

  const refreshed = await getPageWithMeta(pageId);
  const newAudit = auditPage(refreshed);

  return NextResponse.json({
    success: true,
    fixed: Object.keys(textUpdates).length + Object.keys(altUpdates).length,
    audit: newAudit,
  });
}
