import { NextResponse } from "next/server";
import { getSiteInfo } from "@/lib/wordpress";

export async function GET() {
  try {
    const data = await getSiteInfo();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
