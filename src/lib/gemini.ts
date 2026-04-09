import "server-only";
import { GoogleGenAI, Type, Content, FunctionDeclaration } from "@google/genai";
import { getChatSystemPrompt, getElementorContentPrompt, getAltTextPrompt, getContentIdeasPrompt, getGeminiApiKey } from "./prompts";

function getAI() {
  return new GoogleGenAI({ apiKey: getGeminiApiKey() });
}

export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "list_posts",
    description:
      "List recent WordPress posts. Returns titles, IDs, dates, statuses.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        per_page: {
          type: Type.NUMBER,
          description: "Number of posts (default 10, max 100)",
        },
        page: { type: Type.NUMBER, description: "Page number for pagination" },
        search: { type: Type.STRING, description: "Search term to filter by title/content" },
        slug: { type: Type.STRING, description: "Filter by exact URL slug (e.g. 'usb-bellek-baski')" },
        status: {
          type: Type.STRING,
          description: "Post status: publish, draft, pending, private, trash",
        },
        orderby: {
          type: Type.STRING,
          description: "Sort by: date, title, modified, id",
        },
        order: { type: Type.STRING, description: "Sort order: asc or desc" },
      },
    },
  },
  {
    name: "get_post",
    description:
      "Get a single WordPress post by ID. Returns full content, title, status, categories, tags.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.NUMBER, description: "The post ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "create_post",
    description: "Create a new WordPress post.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Post title" },
        content: { type: Type.STRING, description: "Post content (HTML)" },
        status: {
          type: Type.STRING,
          description:
            "Post status: draft (default), publish, pending, private",
        },
        excerpt: { type: Type.STRING, description: "Post excerpt" },
        categories: {
          type: Type.ARRAY,
          items: { type: Type.NUMBER },
          description: "Array of category IDs",
        },
        tags: {
          type: Type.ARRAY,
          items: { type: Type.NUMBER },
          description: "Array of tag IDs",
        },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "update_post",
    description: "Update an existing WordPress post.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.NUMBER, description: "The post ID to update" },
        title: { type: Type.STRING, description: "New title" },
        content: { type: Type.STRING, description: "New content (HTML)" },
        status: { type: Type.STRING, description: "New status" },
        excerpt: { type: Type.STRING, description: "New excerpt" },
        categories: {
          type: Type.ARRAY,
          items: { type: Type.NUMBER },
          description: "Array of category IDs",
        },
        tags: {
          type: Type.ARRAY,
          items: { type: Type.NUMBER },
          description: "Array of tag IDs",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_post",
    description:
      "Delete a WordPress post (moves to trash, or force deletes).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.NUMBER, description: "The post ID to delete" },
        force: {
          type: Type.BOOLEAN,
          description: "If true, permanently delete instead of trashing",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "list_pages",
    description: "List WordPress pages.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        per_page: { type: Type.NUMBER, description: "Number of pages" },
        page: { type: Type.NUMBER, description: "Page number" },
        search: { type: Type.STRING, description: "Search term" },
        status: { type: Type.STRING, description: "Page status" },
        orderby: { type: Type.STRING, description: "Sort by" },
        order: { type: Type.STRING, description: "Sort order" },
      },
    },
  },
  {
    name: "get_page",
    description: "Get a single WordPress page by ID.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.NUMBER, description: "The page ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "create_page",
    description: "Create a new WordPress page.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Page title" },
        content: { type: Type.STRING, description: "Page content (HTML)" },
        status: { type: Type.STRING, description: "Page status" },
        parent: { type: Type.NUMBER, description: "Parent page ID" },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "update_page",
    description: "Update an existing WordPress page.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.NUMBER, description: "The page ID to update" },
        title: { type: Type.STRING, description: "New title" },
        content: { type: Type.STRING, description: "New content (HTML)" },
        status: { type: Type.STRING, description: "New status" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_page",
    description: "Delete a WordPress page.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.NUMBER, description: "The page ID to delete" },
        force: { type: Type.BOOLEAN, description: "Permanently delete" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_categories",
    description: "List WordPress categories.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        per_page: { type: Type.NUMBER },
        search: { type: Type.STRING },
      },
    },
  },
  {
    name: "get_category",
    description: "Get a single category by ID.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.NUMBER, description: "Category ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_tags",
    description: "List WordPress tags.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        per_page: { type: Type.NUMBER },
        search: { type: Type.STRING },
      },
    },
  },
  {
    name: "get_tag",
    description: "Get a single tag by ID.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.NUMBER, description: "Tag ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "upload_media",
    description: "Upload a media file to WordPress from a URL.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description: "Public URL of the image/file to upload",
        },
        title: { type: Type.STRING, description: "Title for the media item" },
        alt_text: {
          type: Type.STRING,
          description: "Alt text for the image",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "get_site_info",
    description:
      "Get WordPress site information: name, description, URL, timezone.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
];

export async function chatWithGemini(
  history: Content[],
  userMessage: string
) {
  const response = await getAI().models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      ...history,
      { role: "user", parts: [{ text: userMessage }] },
    ],
    config: {
      systemInstruction: getChatSystemPrompt(),
      tools: [{ functionDeclarations: toolDeclarations }],
    },
  });

  return response;
}

export async function chatWithToolResult(
  history: Content[],
) {
  const response = await getAI().models.generateContent({
    model: "gemini-2.5-flash",
    contents: history,
    config: {
      systemInstruction: getChatSystemPrompt(),
      tools: [{ functionDeclarations: toolDeclarations }],
    },
  });

  return response;
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
  return JSON.parse(text);
}
