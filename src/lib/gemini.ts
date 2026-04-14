import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { getElementorContentPrompt, getAltTextPrompt, getContentIdeasPrompt, getGeminiApiKey } from "./prompts";

function getAI() {
  return new GoogleGenAI({ apiKey: getGeminiApiKey() });
}

// ---- Structured content generation for Elementor ----

export async function generateElementorContent(
  brief: string,
  widgets: Array<{
    widgetId: string;
    widgetType: string;
    sectionIndex: number;
    currentText: string;
    fieldLabel?: string;
  }>,
  language: string = "tr"
) {
  const widgetDescriptions = widgets
    .map((w, i) => {
      const label = w.fieldLabel || w.widgetType;
      return `${i + 1}. [${label}] widgetId="${w.widgetId}" (Section ${w.sectionIndex})
   Current text: "${w.currentText.replace(/<[^>]*>/g, "").slice(0, 150)}"`;
    })
    .join("\n");

  const prompt = getElementorContentPrompt(brief, widgetDescriptions, language);

  const response = await getAI().models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          widgets: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                widgetId: { type: Type.STRING },
                text: { type: Type.STRING },
              },
              required: ["widgetId", "text"],
            },
          },
        },
        required: ["widgets"],
      },
    },
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Gemini");
  return JSON.parse(text) as { widgets: Array<{ widgetId: string; text: string }> };
}

// ---- Image Alt Text Generation ----

export async function generateAltTexts(
  images: Array<{ widgetId: string; imageUrl: string }>,
  pageBrief: string,
  language: string = "tr"
) {
  const imageDescriptions = images
    .map((img, i) => `${i + 1}. widgetId="${img.widgetId}" — URL: ${img.imageUrl}`)
    .join("\n");

  const prompt = getAltTextPrompt(pageBrief, imageDescriptions, language);

  const response = await getAI().models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          images: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                widgetId: { type: Type.STRING },
                altText: { type: Type.STRING },
              },
              required: ["widgetId", "altText"],
            },
          },
        },
        required: ["images"],
      },
    },
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Gemini");
  return JSON.parse(text) as { images: Array<{ widgetId: string; altText: string }> };
}

// ---- Image Search Term Generation ----

export async function generateImageSearchTerms(
  pageBrief: string,
  images: Array<{ widgetId: string; sectionIndex: number; currentAlt: string }>,
  language: string = "tr"
) {
  const imageList = images
    .map((img, i) => `${i + 1}. widgetId="${img.widgetId}" section=${img.sectionIndex} currentAlt="${img.currentAlt || "none"}"`)
    .join("\n");

  const prompt = `You are a stock photo search expert. Given a page topic and a list of image placeholders, generate the best Unsplash search query (in English) for each image.

PAGE TOPIC: ${pageBrief}
LANGUAGE: ${language}

IMAGES:
${imageList}

For each image, consider its section position and context on the page to suggest a relevant, specific search term.
Rules:
- Search terms MUST be in English (Unsplash works best with English)
- Be specific: "ankara office printing" not just "office"
- 2-4 words per search term
- Think about what visual would best represent this section of the page`;

  const response = await getAI().models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          images: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                widgetId: { type: Type.STRING },
                searchTerm: { type: Type.STRING },
              },
              required: ["widgetId", "searchTerm"],
            },
          },
        },
        required: ["images"],
      },
    },
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Gemini");
  return JSON.parse(text) as { images: Array<{ widgetId: string; searchTerm: string }> };
}

// ---- Content Creator: SEO Content Ideas ----

import { ContentIdea } from "./types";

export async function generateContentIdeas(
  siteContext: string,
  templateNames: string[],
  customTopic?: string
): Promise<{ ideas: ContentIdea[] }> {
  const topicLine = customTopic
    ? `\nThe user specifically wants ideas around this direction: "${customTopic}"`
    : "";

  const templatesLine = templateNames.length
    ? `\nAvailable Elementor templates: ${templateNames.join(", ")}`
    : "";

  const prompt = getContentIdeasPrompt(siteContext, topicLine, templatesLine);

  const response = await getAI().models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          ideas: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                contentType: { type: Type.STRING },
                targetKeyword: { type: Type.STRING },
                searchVolumeHint: { type: Type.STRING },
                description: { type: Type.STRING },
                alignment: { type: Type.STRING },
                suggestedTemplateType: { type: Type.STRING },
              },
              required: ["id", "title", "contentType", "targetKeyword", "searchVolumeHint", "description", "alignment", "suggestedTemplateType"],
            },
          },
        },
        required: ["ideas"],
      },
    },
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Gemini");
  return JSON.parse(text) as { ideas: ContentIdea[] };
}
