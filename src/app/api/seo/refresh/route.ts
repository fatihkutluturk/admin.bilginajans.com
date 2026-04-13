import { NextRequest, NextResponse } from "next/server";
import { refreshKeywords, triggerCron } from "@/lib/serpbear";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.all) {
      await triggerCron();
    } else if (body.ids && Array.isArray(body.ids)) {
      await refreshKeywords(body.ids);
    } else {
      return NextResponse.json({ error: "Provide { ids: number[] } or { all: true }" }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
