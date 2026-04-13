import { NextRequest, NextResponse } from "next/server";
import { listSnapshots, restoreSnapshot } from "@/lib/undo";
import { updateElementorData, updateTemplateElementorData } from "@/lib/wordpress";

export async function GET(req: NextRequest) {
  try {
    const pageId = Number(req.nextUrl.searchParams.get("pageId"));
    if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 });
    const snapshots = listSnapshots(pageId);
    return NextResponse.json({ snapshots });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { filename } = await req.json();
    if (!filename) return NextResponse.json({ error: "filename required" }, { status: 400 });

    const { pageId, type, elementorData } = restoreSnapshot(filename);

    if (type === "templates") {
      await updateTemplateElementorData(pageId, elementorData);
    } else {
      await updateElementorData(pageId, (type as "pages" | "posts") || "pages", elementorData);
    }

    return NextResponse.json({ success: true, pageId, restoredFrom: filename });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
