import "server-only";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { promptDefaults, PromptConfig } from "./prompt-defaults";

const OVERRIDES_PATH = join(process.cwd(), ".settings.json");

export type AppSettings = {
  prompts?: Partial<PromptConfig>;
  apiKeys?: {
    geminiApiKey?: string;
    unsplashAccessKey?: string;
  };
};

function loadSettings(): AppSettings {
  try {
    if (existsSync(OVERRIDES_PATH)) {
      const raw = readFileSync(OVERRIDES_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch {
    // Ignore invalid JSON
  }
  return {};
}

export function saveSettings(settings: AppSettings) {
  const { writeFileSync } = require("fs");
  writeFileSync(OVERRIDES_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

export function getSettings(): AppSettings {
  return loadSettings();
}

export function getGeminiApiKey(): string {
  const settings = loadSettings();
  return settings.apiKeys?.geminiApiKey || process.env.GEMINI_API_KEY || "";
}

export function getUnsplashKey(): string {
  const settings = loadSettings();
  return settings.apiKeys?.unsplashAccessKey || process.env.UNSPLASH_ACCESS_KEY || "";
}

export function getPromptConfig(): PromptConfig {
  const overrides = loadSettings().prompts || {};
  return {
    chat: { ...promptDefaults.chat, ...overrides.chat },
    elementorContent: { ...promptDefaults.elementorContent, ...overrides.elementorContent },
    altText: { ...promptDefaults.altText, ...overrides.altText },
    contentIdeas: { ...promptDefaults.contentIdeas, ...overrides.contentIdeas },
  };
}

// ---- Assembled prompts with locked structural parts ----

const LOCKED_CHAT_SUFFIX = `
IMPORTANT - Resolving names to IDs:
- When a user refers to a post or page by name/title/slug instead of ID, you MUST first use the search parameter of list_posts or list_pages to find it. NEVER ask the user for an ID — look it up yourself.
- For example, if user says "show me the usb-bellek-baski page", call list_pages with search="usb-bellek-baski" to find the ID, then call get_page with that ID.
- Similarly for categories and tags — use the search parameter to find them by name.
- Always chain these lookups automatically without asking the user.`;

export function getChatSystemPrompt(): string {
  const c = getPromptConfig().chat;
  return `${c.role}

Guidelines:
${c.guidelines}
${LOCKED_CHAT_SUFFIX}`;
}

const LOCKED_ELEMENTOR_RULES = `
- For "Heading" fields: write concise, compelling headings (plain text, no HTML)
- For "Text" / "Paragraph" fields: write well-structured HTML content using <p>, <strong>, <em>, <ul>/<li> tags only. Write 2-4 paragraphs of substantial content.
- For "Button" fields: write short CTA text (1-3 words, plain text)
- For "Icon Box Title" fields: write a short, catchy title (3-6 words, plain text)
- For "Icon Box Description" fields: write a brief description (1-2 sentences, plain text)
- For "Counter Label" fields: write a short metric description IN THE SAME LANGUAGE as the page (plain text). Never leave English placeholder text — translate to the page language.
- For "CTA" fields: write compelling call-to-action text appropriate to the field type
- For "Testimonial" fields: write realistic testimonial content appropriate to the field`;

const LOCKED_ELEMENTOR_HEADING = `
SEO HEADING HIERARCHY (CRITICAL):
- The field labels include the heading tag level (H1, H2, H3, DIV, etc.)
- There should be exactly ONE H1 per page — the main page title
- H2 headings are for main sections
- H3 headings are for subsections within H2 sections
- NEVER write an H1 heading that is a subsection. NEVER write an H2 heading more important than the H1.
- The heading text should match the importance of its tag level:
  - H1: The primary topic/title of the entire page
  - H2: Major section themes
  - H3: Supporting subtopics
- If a heading tag is "DIV" or "SPAN", write it as a tagline or subtitle (not a main heading)`;

const LOCKED_ELEMENTOR_RETURN = `
Return a JSON object with a "widgets" array. Each item must have "widgetId" (matching the input) and "text" (the new content).`;

export function getElementorContentPrompt(
  brief: string,
  widgetDescriptions: string,
  language: string
): string {
  const c = getPromptConfig().elementorContent;
  const lang = language === "tr" ? "Turkish" : language;
  return `${c.role}

TOPIC/BRIEF: ${brief}
LANGUAGE: ${lang}

Below are the text widgets on the page. For each widget, generate appropriate replacement text.

WIDGETS:
${widgetDescriptions}

FIELD FORMAT RULES (DO NOT CHANGE):
${LOCKED_ELEMENTOR_RULES}

CONTENT STYLE:
${c.contentRules}

- Write in ${lang}

${c.seoGuidance}
${LOCKED_ELEMENTOR_HEADING}
${LOCKED_ELEMENTOR_RETURN}`;
}

const LOCKED_ALT_RETURN = `
Return a JSON object with an "images" array. Each item must have "widgetId" (matching input) and "altText".`;

export function getAltTextPrompt(
  pageBrief: string,
  imageDescriptions: string,
  language: string
): string {
  const c = getPromptConfig().altText;
  const lang = language === "tr" ? "Turkish" : language;
  return `${c.role}

PAGE CONTEXT: ${pageBrief || "General business website"}
LANGUAGE: ${lang}

IMAGES:
${imageDescriptions}

For each image, write descriptive alt text (10-20 words) in ${lang}:
${c.guidance}
${LOCKED_ALT_RETURN}`;
}

const LOCKED_IDEAS_FIELDS = `
For each idea, provide:
- title: A compelling, SEO-optimized page/post title in Turkish
- contentType: One of "blog", "service", "landing", "about", "faq", "other"
- targetKeyword: The primary keyword to target (in Turkish)
- searchVolumeHint: Estimated search interest ("Yüksek", "Orta", or "Düşük (niş)")
- description: 2-3 sentence description of what the content should cover
- alignment: Why this topic aligns with the website's existing content and business
- suggestedTemplateType: Which template type would work best

Generate unique IDs (format: idea-1, idea-2, etc.)`;

export function getContentIdeasPrompt(
  siteContext: string,
  topicLine: string,
  templatesLine: string
): string {
  const c = getPromptConfig().contentIdeas;
  return `${c.role}

Generate ${c.ideaCount} content ideas.

WEBSITE CONTENT SUMMARY:
${siteContext}
${topicLine}
${templatesLine}

${LOCKED_IDEAS_FIELDS}

Focus on:
${c.focusAreas}`;
}
