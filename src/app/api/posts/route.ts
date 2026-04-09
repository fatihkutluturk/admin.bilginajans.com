import { NextRequest, NextResponse } from "next/server";
import { listPosts, createPost } from "@/lib/wordpress";

export async function GET(req: NextRequest) {
  try {
    const params: Record<string, string> = {};
    const sp = req.nextUrl.searchParams;
    if (sp.get("per_page")) params.per_page = sp.get("per_page")!;
    if (sp.get("page")) params.page = sp.get("page")!;
    if (sp.get("search")) params.search = sp.get("search")!;
    if (sp.get("status")) params.status = sp.get("status")!;
    if (!params.per_page) params.per_page = "50";
    if (!params._fields) params._fields = "id,title,slug,status,date,link";
    const data = await listPosts(params);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await createPost(body);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
