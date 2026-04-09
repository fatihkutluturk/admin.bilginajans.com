import { NextRequest, NextResponse } from "next/server";
import { getTemplateWithMeta, createPage, updateElementorData } from "@/lib/wordpress";

export async function POST(req: NextRequest) {
  try {
    const { templateId, title } = (await req.json()) as {
      templateId: number;
      title: string;
    };

    if (!templateId || !title) {
      return NextResponse.json(
        { error: "templateId and title are required" },
        { status: 400 }
      );
    }

    // 1. Fetch the template's Elementor data
    const template = await getTemplateWithMeta(templateId);
    const rawData = template.meta?._elementor_data;
    if (!rawData) {
      return NextResponse.json(
        { error: "Template has no Elementor data" },
        { status: 404 }
      );
    }

    // 2. Create a new blank page as draft
    const newPage = await createPage({
      title,
      status: "draft",
      content: "",
    });

    // 3. Copy the template's Elementor data to the new page
    await updateElementorData(newPage.id, typeof rawData === "string" ? rawData : JSON.stringify(rawData));

    // 4. Set Elementor edit mode so it renders from the data
    const base = process.env.WP_URL!.replace(/\/$/, "");
    const credentials = Buffer.from(
      `${process.env.WP_USERNAME!}:${process.env.WP_APP_PASSWORD!}`
    ).toString("base64");

    await fetch(`${base}/wp-json/wp/v2/pages/${newPage.id}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        meta: {
          _elementor_edit_mode: "builder",
          _elementor_template_type: "wp-page",
        },
      }),
    });

    return NextResponse.json({
      success: true,
      pageId: newPage.id,
      title,
      templateName: template.title?.raw || template.title?.rendered || "",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
