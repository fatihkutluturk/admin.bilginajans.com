import { NextRequest, NextResponse } from "next/server";
import { getKeywords, addKeywords, deleteKeywords } from "@/lib/serpbear";

export async function GET(req: NextRequest) {
  try {
    const domain = req.nextUrl.searchParams.get("domain");
    if (!domain) {
      return NextResponse.json({ error: "domain parameter required" }, { status: 400 });
    }
    const keywords = await getKeywords(domain);
    return NextResponse.json({ keywords });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { keywords } = await req.json();
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: "keywords array required" }, { status: 400 });
    }
    const created = await addKeywords(keywords);
    return NextResponse.json({ keywords: created });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const idsParam = req.nextUrl.searchParams.get("ids");
    if (!idsParam) {
      return NextResponse.json({ error: "ids parameter required" }, { status: 400 });
    }
    const ids = idsParam.split(",").map(Number).filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ error: "valid ids required" }, { status: 400 });
    }
    await deleteKeywords(ids);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
