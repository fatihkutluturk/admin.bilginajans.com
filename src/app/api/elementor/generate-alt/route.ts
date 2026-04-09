import { NextRequest, NextResponse } from "next/server";
import { generateAltTexts } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { images, pageBrief, language } = await req.json();

    if (!images?.length) {
      return NextResponse.json(
        { error: "images array is required" },
        { status: 400 }
      );
    }

    const result = await generateAltTexts(images, pageBrief || "", language);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
