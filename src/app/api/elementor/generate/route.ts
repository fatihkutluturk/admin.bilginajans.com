import { NextRequest, NextResponse } from "next/server";
import { generateElementorContent } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { brief, widgets, language } = await req.json();

    if (!brief || !widgets?.length) {
      return NextResponse.json(
        { error: "brief and widgets are required" },
        { status: 400 }
      );
    }

    const result = await generateElementorContent(brief, widgets, language);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
