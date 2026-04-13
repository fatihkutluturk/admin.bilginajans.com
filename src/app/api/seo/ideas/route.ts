import { NextRequest, NextResponse } from "next/server";
import { getIdeas, fetchNewIdeas } from "@/lib/serpbear";

export async function GET(req: NextRequest) {
  try {
    const domain = req.nextUrl.searchParams.get("domain");
    if (!domain) {
      return NextResponse.json({ error: "domain parameter required" }, { status: 400 });
    }
    const ideas = await getIdeas(domain);
    return NextResponse.json({ ideas });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { domain, country, language, seedKeywords } = await req.json();
    if (!domain) {
      return NextResponse.json({ error: "domain required" }, { status: 400 });
    }
    const ideas = await fetchNewIdeas(
      domain,
      country || "TR",
      language || "tr",
      seedKeywords || []
    );
    return NextResponse.json({ ideas });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
