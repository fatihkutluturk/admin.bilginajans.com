import { NextRequest, NextResponse } from "next/server";
import { getKeyword } from "@/lib/serpbear";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id parameter required" }, { status: 400 });
    }
    const keyword = await getKeyword(Number(id));
    return NextResponse.json({ keyword });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
