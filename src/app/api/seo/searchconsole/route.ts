import { NextRequest, NextResponse } from "next/server";
import { getSearchConsole } from "@/lib/serpbear";

export async function GET(req: NextRequest) {
  try {
    const domain = req.nextUrl.searchParams.get("domain");
    if (!domain) {
      return NextResponse.json({ error: "domain parameter required" }, { status: 400 });
    }
    const data = await getSearchConsole(domain);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
