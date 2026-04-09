import { ElementorElement, ExtractedWidget, ExtractedImage } from "./types";

// Map widget type → array of { fieldKey, label }
const WIDGET_TEXT_FIELDS: Record<string, { fieldKey: string; label: string }[]> = {
  heading: [{ fieldKey: "title", label: "Heading" }],
  "text-editor": [{ fieldKey: "editor", label: "Text" }],
  button: [{ fieldKey: "text", label: "Button" }],
  "icon-box": [
    { fieldKey: "title_text", label: "Icon Box Title" },
    { fieldKey: "description_text", label: "Icon Box Description" },
  ],
  counter: [{ fieldKey: "title", label: "Counter Label" }],
  "icon-list": [{ fieldKey: "__icon_list", label: "Icon List" }],
  "call-to-action": [
    { fieldKey: "title", label: "CTA Title" },
    { fieldKey: "description", label: "CTA Description" },
    { fieldKey: "button", label: "CTA Button" },
  ],
  "price-table": [
    { fieldKey: "heading", label: "Price Heading" },
    { fieldKey: "sub_heading", label: "Price Subheading" },
    { fieldKey: "button_text", label: "Price Button" },
  ],
  testimonial: [
    { fieldKey: "testimonial_content", label: "Testimonial" },
    { fieldKey: "testimonial_name", label: "Testimonial Name" },
    { fieldKey: "testimonial_job", label: "Testimonial Job" },
  ],
  "image-box": [
    { fieldKey: "title_text", label: "Image Box Title" },
    { fieldKey: "description_text", label: "Image Box Description" },
  ],
  tabs: [{ fieldKey: "__tabs", label: "Tabs" }],
  accordion: [{ fieldKey: "__accordion", label: "Accordion" }],
  toggle: [{ fieldKey: "__toggle", label: "Toggle" }],
  alert: [
    { fieldKey: "alert_title", label: "Alert Title" },
    { fieldKey: "alert_description", label: "Alert Description" },
  ],
};

export function makeKey(widgetId: string, fieldKey: string): string {
  return `${widgetId}:${fieldKey}`;
}

export function parseKey(key: string): { widgetId: string; fieldKey: string } {
  const idx = key.indexOf(":");
  return { widgetId: key.slice(0, idx), fieldKey: key.slice(idx + 1) };
}

export function extractTextWidgets(
  elements: ElementorElement[],
  sectionIndex = 0
): ExtractedWidget[] {
  const result: ExtractedWidget[] = [];

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const isSection = el.elType === "section" || el.elType === "container";
    const currentSection = isSection ? sectionIndex + 1 : sectionIndex;

    if (el.elType === "widget" && el.widgetType) {
      const fields = WIDGET_TEXT_FIELDS[el.widgetType];
      if (fields) {
        for (const { fieldKey, label } of fields) {
          // Handle special repeater fields
          if (fieldKey === "__icon_list") {
            const items = el.settings.icon_list as Array<{ text?: string }> | undefined;
            if (items?.length) {
              const text = items.map((item) => item.text || "").join("\n");
              if (text.trim()) {
                result.push({
                  widgetId: el.id,
                  fieldKey: "icon_list",
                  key: makeKey(el.id, "icon_list"),
                  widgetType: el.widgetType,
                  fieldLabel: label,
                  sectionIndex: currentSection,
                  currentText: text,
                  isPlaceholder: detectPlaceholder(text),
                });
              }
            }
            continue;
          }

          if (fieldKey === "__tabs" || fieldKey === "__accordion" || fieldKey === "__toggle") {
            const listKey = fieldKey.replace("__", "");
            const items = el.settings[listKey] as Array<{ tab_title?: string; tab_content?: string; title?: string; content?: string }> | undefined;
            if (items?.length) {
              const text = items
                .map((item) => `${item.tab_title || item.title || ""}: ${item.tab_content || item.content || ""}`)
                .join("\n---\n");
              if (text.trim()) {
                result.push({
                  widgetId: el.id,
                  fieldKey: listKey,
                  key: makeKey(el.id, listKey),
                  widgetType: el.widgetType,
                  fieldLabel: label,
                  sectionIndex: currentSection,
                  currentText: text,
                  isPlaceholder: detectPlaceholder(text),
                });
              }
            }
            continue;
          }

          // Standard text field
          const currentText = String(el.settings[fieldKey] ?? "");

          // For headings, capture the HTML tag (h1, h2, h3, div, span, etc.)
          const headingTag =
            el.widgetType === "heading"
              ? String(el.settings.header_size || "h2")
              : undefined;
          const tagLabel =
            headingTag && headingTag !== "h2"
              ? `${label} (${headingTag.toUpperCase()})`
              : headingTag
                ? `${label} (H2)`
                : label;

          // Include empty text-editor widgets — Elementor shows
          // "Lorem ipsum" as default when editor field is empty
          const isEmpty = !currentText.trim();
          const isEmptyTextEditor =
            isEmpty && el.widgetType === "text-editor";

          if (currentText.trim() || isEmptyTextEditor) {
            result.push({
              widgetId: el.id,
              fieldKey,
              key: makeKey(el.id, fieldKey),
              widgetType: el.widgetType,
              fieldLabel: isEmptyTextEditor
                ? `${tagLabel} (EMPTY — shows Lorem on site)`
                : tagLabel,
              headingTag,
              sectionIndex: currentSection,
              currentText: isEmptyTextEditor
                ? ""
                : currentText,
              isPlaceholder: isEmptyTextEditor || detectPlaceholder(currentText),
            });
          }
        }
      }
    }

    if (el.elements?.length) {
      result.push(...extractTextWidgets(el.elements, currentSection));
    }
  }

  return result;
}

export function applyTextUpdates(
  elements: ElementorElement[],
  updates: Record<string, string> // keyed by composite key "widgetId:fieldKey"
): ElementorElement[] {
  // Build a map of widgetId → { fieldKey → newText }
  const widgetUpdates = new Map<string, Map<string, string>>();
  for (const [compositeKey, text] of Object.entries(updates)) {
    const { widgetId, fieldKey } = parseKey(compositeKey);
    if (!widgetUpdates.has(widgetId)) widgetUpdates.set(widgetId, new Map());
    widgetUpdates.get(widgetId)!.set(fieldKey, text);
  }

  return applyUpdatesRecursive(elements, widgetUpdates);
}

function applyUpdatesRecursive(
  elements: ElementorElement[],
  widgetUpdates: Map<string, Map<string, string>>
): ElementorElement[] {
  return elements.map((el) => {
    const newEl = { ...el };

    if (el.elType === "widget" && widgetUpdates.has(el.id)) {
      const fieldUpdates = widgetUpdates.get(el.id)!;
      const newSettings = { ...el.settings };

      for (const [fieldKey, newText] of fieldUpdates) {
        // Handle icon_list repeater
        if (fieldKey === "icon_list") {
          const items = (el.settings.icon_list as Array<Record<string, unknown>>) || [];
          const newLines = newText.split("\n").filter((l) => l.trim());
          newSettings.icon_list = items.map((item, i) => ({
            ...item,
            text: newLines[i] || item.text || "",
          }));
          continue;
        }

        // Handle tabs/accordion/toggle repeaters
        if (fieldKey === "tabs" || fieldKey === "accordion" || fieldKey === "toggle") {
          const items = (el.settings[fieldKey] as Array<Record<string, unknown>>) || [];
          const newSections = newText.split("\n---\n");
          newSettings[fieldKey] = items.map((item, i) => {
            if (!newSections[i]) return item;
            const parts = newSections[i].split(": ");
            const title = parts[0] || "";
            const content = parts.slice(1).join(": ") || "";
            const titleKey = "tab_title" in item ? "tab_title" : "title";
            const contentKey = "tab_content" in item ? "tab_content" : "content";
            return { ...item, [titleKey]: title, [contentKey]: content };
          });
          continue;
        }

        // Standard field
        newSettings[fieldKey] = newText;
      }

      newEl.settings = newSettings;
    }

    if (el.elements?.length) {
      newEl.elements = applyUpdatesRecursive(el.elements, widgetUpdates);
    }

    return newEl;
  });
}

/**
 * Generate basic rendered HTML from Elementor data for the WP content field.
 * This ensures the live site shows updated content even without Elementor re-rendering.
 */
export function renderContentFromElementor(elements: ElementorElement[]): string {
  const parts: string[] = [];

  for (const el of elements) {
    if (!el || typeof el !== "object") continue;

    if (el.elType === "widget") {
      const settings = el.settings || {};
      const wtype = el.widgetType || "";

      switch (wtype) {
        case "heading": {
          const tag = String(settings.header_size || "h2");
          const title = String(settings.title || "");
          if (title.trim()) parts.push(`<${tag}>${title}</${tag}>`);
          break;
        }
        case "text-editor": {
          const editor = String(settings.editor || "");
          if (editor.trim()) parts.push(editor);
          break;
        }
        case "button": {
          const text = String(settings.text || "");
          if (text.trim()) parts.push(`<p>${text}</p>`);
          break;
        }
        case "icon-box": {
          const title = String(settings.title_text || "");
          const desc = String(settings.description_text || "");
          if (title.trim()) parts.push(`<h3>${title}</h3>`);
          if (desc.trim()) parts.push(`<p>${desc}</p>`);
          break;
        }
        case "counter": {
          const title = String(settings.title || "");
          if (title.trim()) parts.push(`<p>${title}</p>`);
          break;
        }
      }
    }

    if (Array.isArray(el.elements) && el.elements.length) {
      const nested = renderContentFromElementor(el.elements);
      if (nested) parts.push(nested);
    }
  }

  return parts.join("\n");
}

function detectPlaceholder(text: string): boolean {
  const lower = text.toLowerCase().replace(/<[^>]*>/g, "").trim();
  if (lower.includes("lorem ipsum")) return true;
  if (lower.includes("dolor sit amet")) return true;
  if (/^(test|placeholder|dummy|sample|örnek|deneme)/i.test(lower)) return true;
  return false;
}

// ---- Image extraction ----

const IMAGE_WIDGET_TYPES = new Set(["image", "image-box", "image-carousel", "image-gallery"]);

const PLACEHOLDER_IMAGE_PATTERNS = [
  /placeholder/i, /stock[-_]?photo/i, /sample/i, /default/i,
  /page\d+\.png$/i, /img_?\d+\./i, /photo[-_]\d+/i,
  /mobile_app/i, /dinancial/i, /financial/i,
];

function isPlaceholderImage(url: string, alt: string): boolean {
  if (!alt || alt.trim() === "") return true;
  const filename = url.split("/").pop()?.split("?")[0] || "";
  return PLACEHOLDER_IMAGE_PATTERNS.some((p) => p.test(filename));
}

export function extractImageWidgets(
  elements: ElementorElement[],
  sectionIndex = 0
): ExtractedImage[] {
  const result: ExtractedImage[] = [];

  for (const el of elements) {
    if (!el || typeof el !== "object") continue;
    const isSection = el.elType === "section" || el.elType === "container";
    const currentSection = isSection ? sectionIndex + 1 : sectionIndex;

    if (el.elType === "widget" && el.widgetType && IMAGE_WIDGET_TYPES.has(el.widgetType)) {
      const settings = el.settings || {};
      const img = settings.image as { url?: string; id?: number; alt?: string } | undefined;

      if (img?.url) {
        result.push({
          widgetId: el.id,
          widgetType: el.widgetType,
          sectionIndex: currentSection,
          imageUrl: img.url,
          imageId: img.id || 0,
          altText: img.alt || "",
          isPlaceholder: isPlaceholderImage(img.url, img.alt || ""),
        });
      }
    }

    if (Array.isArray(el.elements) && el.elements.length) {
      result.push(...extractImageWidgets(el.elements, currentSection));
    }
  }

  return result;
}

export function applyImageAltUpdates(
  elements: ElementorElement[],
  updates: Record<string, string> // widgetId → new alt text
): ElementorElement[] {
  return elements.map((el) => {
    const newEl = { ...el };

    if (
      el.elType === "widget" &&
      el.widgetType &&
      IMAGE_WIDGET_TYPES.has(el.widgetType) &&
      updates[el.id] !== undefined
    ) {
      const img = (el.settings.image || {}) as Record<string, unknown>;
      newEl.settings = {
        ...el.settings,
        image: { ...img, alt: updates[el.id] },
      };
    }

    if (Array.isArray(el.elements) && el.elements.length) {
      newEl.elements = applyImageAltUpdates(el.elements, updates);
    }

    return newEl;
  });
}

export function applyImageUrlUpdates(
  elements: ElementorElement[],
  updates: Record<string, { url: string; id: number }> // widgetId → new image
): ElementorElement[] {
  return elements.map((el) => {
    const newEl = { ...el };

    if (
      el.elType === "widget" &&
      el.widgetType &&
      IMAGE_WIDGET_TYPES.has(el.widgetType) &&
      updates[el.id] !== undefined
    ) {
      const img = (el.settings.image || {}) as Record<string, unknown>;
      newEl.settings = {
        ...el.settings,
        image: { ...img, url: updates[el.id].url, id: updates[el.id].id },
      };
    }

    if (Array.isArray(el.elements) && el.elements.length) {
      newEl.elements = applyImageUrlUpdates(el.elements, updates);
    }

    return newEl;
  });
}
