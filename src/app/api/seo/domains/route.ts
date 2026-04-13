import { NextRequest, NextResponse } from "next/server";
import { getDomains, addDomain, deleteDomain } from "@/lib/serpbear";

export async function GET() {
  try {
    const domains = await getDomains();
    return NextResponse.json({ domains });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { domain } = await req.json();
    if (!domain || typeof domain !== "string") {
      return NextResponse.json({ error: "domain string required" }, { status: 400 });
    }
    const domains = await addDomain(domain.trim());
    return NextResponse.json({ domains });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const domain = req.nextUrl.searchParams.get("domain");
    if (!domain) {
      return NextResponse.json({ error: "domain parameter required" }, { status: 400 });
    }
    await deleteDomain(domain);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
