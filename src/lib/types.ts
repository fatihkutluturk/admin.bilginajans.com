export type SiteConfig = {
  url: string;
  username: string;
  appPassword: string;
};

export type Message = {
  role: "user" | "assistant";
  content: string;
};

export type PendingAction = {
  functionCall: {
    name: string;
    args: Record<string, unknown>;
  };
  summary: string;
};

export type ChatRequest = {
  messages: Message[];
  pendingAction?: PendingAction & { approved: boolean };
};

// Elementor types

export type ElementorElement = {
  id: string;
  elType: "section" | "column" | "widget" | "container";
  widgetType?: string;
  settings: Record<string, unknown>;
  elements: ElementorElement[];
};

export type ExtractedWidget = {
  widgetId: string;
  fieldKey: string;
  /** Composite key: widgetId:fieldKey — used for lookups and updates */
  key: string;
  widgetType: string;
  fieldLabel: string;
  /** For headings: the HTML tag (h1, h2, h3, div, etc.) */
  headingTag?: string;
  sectionIndex: number;
  currentText: string;
  isPlaceholder: boolean;
};

// Content Creator types

export type ContentIdea = {
  id: string;
  title: string;
  contentType: "blog" | "service" | "landing" | "about" | "faq" | "other";
  targetKeyword: string;
  searchVolumeHint: string;
  description: string;
  alignment: string;
  suggestedTemplateType: string;
};

export type ContentPlan = {
  ideaId: string;
  templateId: number;
  templateName: string;
  title: string;
  brief: string;
  primaryKeyword: string;
};

// Image types

export type ExtractedImage = {
  widgetId: string;
  widgetType: string;
  sectionIndex: number;
  imageUrl: string;
  imageId: number;
  altText: string;
  isPlaceholder: boolean;
};

// Content Audit types

export type AuditIssue = {
  type: "error" | "warning" | "info";
  code: string;
  message: string;
  widgetId?: string;
};

export type PageAudit = {
  id: number;
  title: string;
  slug: string;
  link: string;
  status: string;
  score: number;
  wordCount: number;
  hasElementor: boolean;
  issues: AuditIssue[];
};

export type StreamChunk =
  | { type: "text"; content: string }
  | { type: "confirmation"; pendingAction: PendingAction }
  | { type: "result"; content: string }
  | { type: "error"; content: string };
