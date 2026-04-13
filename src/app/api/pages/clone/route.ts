import { NextRequest, NextResponse } from "next/server";
import { getPageWithMeta, createPage, updateElementorData } from "@/lib/wordpress";
import { extractTextWidgets, applyTextUpdates } from "@/lib/elementor";
import { generateElementorContent } from "@/lib/gemini";
import { ElementorElement } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { sourcePageId, newTitle, brief, language = "tr" } = await req.json();

    if (!sourcePageId || !newTitle || !brief) {
      return NextResponse.json(
        { error: "sourcePageId, newTitle, and brief are required" },
        { status: 400 }
      );
    }

    // 1. Fetch source page with Elementor data
    const sourcePage = await getPageWithMeta(sourcePageId);
    const rawData = sourcePage.meta?._elementor_data;
    if (!rawData) {
      return NextResponse.json(
        { error: "Source page has no Elementor data" },
        { status: 404 }
      );
    }

    const elementorData: ElementorElement[] =
      typeof rawData === "string" ? JSON.parse(rawData) : rawData;

    // 2. Extract text widgets from template (using composite keys)
    const widgets = extractTextWidgets(elementorData);

    // 3. Generate new content — use composite key as widgetId so results map back
    const generated = await generateElementorContent(
      brief,
      widgets.map((w) => ({
        widgetId: w.key,
        widgetType: w.widgetType,
        sectionIndex: w.sectionIndex,
        currentText: w.currentText,
        fieldLabel: w.fieldLabel,
      })),
      language
    );

    // 4. Create the new page (as draft)
    const newPage = await createPage({
      title: newTitle,
      status: "draft",
      content: "",
    });

    // 5. Apply generated text to the cloned Elementor structure
    const updates: Record<string, string> = {};
    for (const w of generated.widgets) {
      updates[w.widgetId] = w.text; // widgetId here is the composite key
    }

    const updatedData = applyTextUpdates(elementorData, updates);

    // 6. Save the Elementor data to the new page
    await updateElementorData(newPage.id, "pages", JSON.stringify(updatedData));

    return NextResponse.json({
      success: true,
      pageId: newPage.id,
      title: newTitle,
      widgetsGenerated: generated.widgets.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
