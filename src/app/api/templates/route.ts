import { NextRequest, NextResponse } from "next/server";
import { listTemplates } from "@/lib/wordpress";

export async function GET(req: NextRequest) {
  try {
    const params: Record<string, string> = {};
    const sp = req.nextUrl.searchParams;
    if (sp.get("per_page")) params.per_page = sp.get("per_page")!;
    if (sp.get("search")) params.search = sp.get("search")!;
    if (!params.per_page) params.per_page = "50";
    // context=edit needed for meta._elementor_data, but use _fields to limit payload
    params.context = "edit";
    params._fields = "id,title,status,meta";
    const data = await listTemplates(params);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
