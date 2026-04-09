import { NextRequest, NextResponse } from "next/server";
import { getPromptConfig, getSettings, saveSettings } from "@/lib/prompts";
import { promptDefaults } from "@/lib/prompt-defaults";

export async function GET() {
  try {
    const config = getPromptConfig();
    const settings = getSettings();
    return NextResponse.json({
      config,
      defaults: promptDefaults,
      apiKeys: {
        geminiApiKey: settings.apiKeys?.geminiApiKey || process.env.GEMINI_API_KEY || "",
        unsplashAccessKey: settings.apiKeys?.unsplashAccessKey || process.env.UNSPLASH_ACCESS_KEY || "",
      },
      wordpress: {
        url: settings.wordpress?.url || process.env.WP_URL || "",
        username: settings.wordpress?.username || process.env.WP_USERNAME || "",
        appPassword: settings.wordpress?.appPassword || process.env.WP_APP_PASSWORD || "",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { config, apiKeys, wordpress } = await req.json();
    const existing = getSettings();
    saveSettings({
      ...existing,
      prompts: config || existing.prompts,
      apiKeys: apiKeys || existing.apiKeys,
      wordpress: wordpress || existing.wordpress,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
