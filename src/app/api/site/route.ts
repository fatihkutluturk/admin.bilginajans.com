import { NextResponse } from "next/server";
import { getSiteInfo } from "@/lib/wordpress";
import { getPublicWpUrl } from "@/lib/prompts";

export async function GET() {
  try {
    const data = await getSiteInfo();
    return NextResponse.json({ ...data, wpUrl: getPublicWpUrl() });
  } catch (error) {
    // If WP is unreachable, still return the URL from settings
    return NextResponse.json({
      name: "",
      wpUrl: getPublicWpUrl(),
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
