import { NextRequest, NextResponse } from "next/server";
import { getKeywords, analyzeKeywords } from "@/lib/serpbear";

export async function POST(req: NextRequest) {
  try {
    const { domain } = await req.json();
    if (!domain) {
      return NextResponse.json({ error: "domain required" }, { status: 400 });
    }
    const keywords = await getKeywords(domain);
    const insights = analyzeKeywords(keywords);
    return NextResponse.json({ insights, totalKeywords: keywords.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
