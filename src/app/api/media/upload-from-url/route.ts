import { NextRequest, NextResponse } from "next/server";
import { uploadMedia } from "@/lib/wordpress";

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, title, altText } = await req.json();

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl required" }, { status: 400 });
    }

    const media = await uploadMedia(imageUrl, title, altText);

    return NextResponse.json({
      id: media.id,
      url: media.source_url || media.guid?.rendered,
      title: media.title?.rendered,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
