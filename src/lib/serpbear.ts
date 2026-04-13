import "server-only";
import { getSerpBearConfig } from "./prompts";

// ---- Types ----

export type SerpBearDomain = {
  ID: number;
  domain: string;
  slug: string;
  keywordCount: number;
  tags: string[];
  notification_interval: string;
  notification_emails: string;
  createdAt: string;
  updatedAt: string;
};

export type SerpBearKeywordHistory = Record<
  string, // date string "YYYY-MM-DD"
  number // position
>;

export type SerpResult = {
  position: number;
  url: string;
  title: string;
};

export type SerpBearKeyword = {
  ID: number;
  keyword: string;
  device: string;
  country: string;
  domain: string;
  position: number;
  url: string;
  tags: string[];
  history: SerpBearKeywordHistory;
  lastUpdated: string;
  updating: boolean;
  lastResult?: SerpResult[];
  // GSC enrichment (if configured in SerpBear)
  visits?: number;
  impressions?: number;
  ctr?: number;
  avgPosition?: number;
};

export type AddKeywordInput = {
  keyword: string;
  device: "desktop" | "mobile";
  country: string;
  domain: string;
  tags?: string;
};

// GSC types

export type SCKeywordEntry = {
  keyword: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  page: string;
  device?: string;
  country?: string;
};

export type SCPeriodData = {
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
};

export type SCRawData = {
  threeDays: SCKeywordEntry[];
  sevenDays: SCKeywordEntry[];
  thirtyDays: SCKeywordEntry[];
  stats?: Array<{
    date: string;
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
  }>;
  lastFetched?: string;
  lastFetchError?: string;
};

export type SCAggregated = {
  sevenDays: SCPeriodData;
  thirtyDays: SCPeriodData;
  stats: Array<{ date: string; impressions: number; clicks: number }>;
  hasData: boolean;
};

function aggregatePeriod(entries: SCKeywordEntry[]): SCPeriodData {
  if (!entries || entries.length === 0) return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const totalClicks = entries.reduce((s, e) => s + (e.clicks || 0), 0);
  const totalImpressions = entries.reduce((s, e) => s + (e.impressions || 0), 0);
  const avgPosition = entries.reduce((s, e) => s + (e.position || 0), 0) / entries.length;
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  return { clicks: totalClicks, impressions: totalImpressions, ctr: avgCtr, position: avgPosition };
}

export function aggregateSCData(raw: SCRawData | null): SCAggregated {
  if (!raw) return { sevenDays: { clicks: 0, impressions: 0, ctr: 0, position: 0 }, thirtyDays: { clicks: 0, impressions: 0, ctr: 0, position: 0 }, stats: [], hasData: false };
  const s7 = aggregatePeriod(raw.sevenDays || []);
  const s30 = aggregatePeriod(raw.thirtyDays || []);
  const hasData = s7.clicks > 0 || s7.impressions > 0 || s30.clicks > 0 || s30.impressions > 0;
  return { sevenDays: s7, thirtyDays: s30, stats: raw.stats || [], hasData };
}

export type InsightData = {
  pages: Array<{ page: string; clicks: number; impressions: number; ctr: number; position: number }>;
  keywords: Array<{ keyword: string; clicks: number; impressions: number; ctr: number; position: number }>;
  countries: Array<{ country: string; clicks: number; impressions: number }>;
};

export type IdeaKeyword = {
  keyword: string;
  domain: string;
  country: string;
  avgMonthlySearches: number;
  competition: string;
  competitionIndex: number;
  monthlySearchVolumes?: Record<string, number>;
  added?: string;
  updated?: string;
};

// ---- Config helpers ----

function getConfig() {
  const config = getSerpBearConfig();
  if (!config.url || !config.apiKey) {
    throw new Error("SerpBear URL ve API Key ayarlardan yapılandırılmalı");
  }
  return config;
}

function getWriteConfig() {
  const config = getSerpBearConfig();
  if (!config.url || !config.username || !config.password) {
    throw new Error("SerpBear yazma işlemleri için Kullanıcı Adı ve Şifre ayarlardan yapılandırılmalı");
  }
  return config;
}

// ---- Read client (API Key auth) ----

async function serpbearFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const { url, apiKey } = getConfig();
  const baseUrl = url.replace(/\/+$/, "");
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SerpBear API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ---- Write client (JWT cookie auth) ----

let cachedCookie: { value: string; expires: number } | null = null;

async function getAuthCookie(): Promise<string> {
  // Return cached cookie if still valid (with 60s margin)
  if (cachedCookie && cachedCookie.expires > Date.now() + 60_000) {
    return cachedCookie.value;
  }

  const { url, username, password } = getWriteConfig();
  const baseUrl = url.replace(/\/+$/, "");

  const res = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    redirect: "manual",
  });

  if (!res.ok && res.status !== 302) {
    throw new Error(`SerpBear login failed (${res.status}). Kullanıcı adı veya şifre hatalı.`);
  }

  // Extract Set-Cookie header
  const setCookies = res.headers.getSetCookie?.() || [];
  const tokenCookie = setCookies.find((c) => c.startsWith("token="));

  if (!tokenCookie) {
    // Fallback: try reading from response body
    const body = await res.json().catch(() => null);
    if (body?.token) {
      cachedCookie = { value: `token=${body.token}`, expires: Date.now() + 23 * 3600_000 };
      return cachedCookie.value;
    }
    throw new Error("SerpBear login başarılı ancak token alınamadı");
  }

  cachedCookie = { value: tokenCookie.split(";")[0], expires: Date.now() + 23 * 3600_000 };
  return cachedCookie.value;
}

async function serpbearAuthFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const cookie = await getAuthCookie();
  const { url } = getWriteConfig();
  const baseUrl = url.replace(/\/+$/, "");

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    // If 401, invalidate cached cookie and retry once
    if (res.status === 401 && cachedCookie) {
      cachedCookie = null;
      const retryCookie = await getAuthCookie();
      const retryRes = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
          Cookie: retryCookie,
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });
      if (!retryRes.ok) {
        const text = await retryRes.text().catch(() => "");
        throw new Error(`SerpBear API error ${retryRes.status}: ${text}`);
      }
      return retryRes.json();
    }

    const text = await res.text().catch(() => "");
    throw new Error(`SerpBear API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ---- Read API Functions (API Key auth) ----

export async function getDomains(): Promise<SerpBearDomain[]> {
  const data = await serpbearFetch<{ domains: SerpBearDomain[] }>("/api/domains");
  return data.domains || [];
}

export async function getKeywords(domain: string): Promise<SerpBearKeyword[]> {
  const data = await serpbearFetch<{ keywords: SerpBearKeyword[] }>(
    `/api/keywords?domain=${encodeURIComponent(domain)}`
  );
  return data.keywords || [];
}

export async function getKeyword(id: number): Promise<SerpBearKeyword> {
  const data = await serpbearFetch<{ keyword: SerpBearKeyword }>(
    `/api/keyword?id=${id}`
  );
  return data.keyword;
}

export async function refreshKeywords(ids: number[]): Promise<void> {
  await serpbearFetch("/api/refresh", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export async function triggerCron(): Promise<void> {
  await serpbearFetch("/api/cron", { method: "POST" });
}

// GSC & Insight (API Key auth — whitelisted)

export async function getSearchConsole(domain: string): Promise<SCAggregated> {
  try {
    const data = await serpbearFetch<{ data: SCRawData | null }>(
      `/api/searchconsole?domain=${encodeURIComponent(domain)}`
    );
    return aggregateSCData(data.data);
  } catch {
    return { sevenDays: { clicks: 0, impressions: 0, ctr: 0, position: 0 }, thirtyDays: { clicks: 0, impressions: 0, ctr: 0, position: 0 }, stats: [], hasData: false };
  }
}

export async function getInsight(domain: string): Promise<InsightData | null> {
  try {
    const data = await serpbearFetch<{ data: InsightData | null }>(
      `/api/insight?domain=${encodeURIComponent(domain)}`
    );
    return data.data || null;
  } catch {
    return null;
  }
}

// Keyword Ideas (JWT cookie auth — not in API key whitelist)

export async function getIdeas(domain: string): Promise<IdeaKeyword[]> {
  try {
    const data = await serpbearAuthFetch<{ data: IdeaKeyword[] }>(
      `/api/ideas?domain=${encodeURIComponent(domain)}`
    );
    return data.data || [];
  } catch {
    return [];
  }
}

export async function fetchNewIdeas(
  domain: string,
  country: string,
  language: string,
  seedKeywords: string[]
): Promise<IdeaKeyword[]> {
  try {
    const data = await serpbearAuthFetch<{ data: IdeaKeyword[] }>("/api/ideas", {
      method: "POST",
      body: JSON.stringify({ domain, country, language, keywords: seedKeywords }),
    });
    return data.data || [];
  } catch {
    return [];
  }
}

// ---- Write API Functions (JWT cookie auth) ----

export async function addDomain(domain: string): Promise<SerpBearDomain[]> {
  const data = await serpbearAuthFetch<{ domains: SerpBearDomain[] }>("/api/domains", {
    method: "POST",
    body: JSON.stringify({ domains: [domain] }),
  });
  return data.domains || [];
}

export async function deleteDomain(domain: string): Promise<void> {
  await serpbearAuthFetch(`/api/domains?domain=${encodeURIComponent(domain)}`, {
    method: "DELETE",
  });
}

export async function addKeywords(keywords: AddKeywordInput[]): Promise<SerpBearKeyword[]> {
  const data = await serpbearAuthFetch<{ keywords: SerpBearKeyword[] }>("/api/keywords", {
    method: "POST",
    body: JSON.stringify({ keywords }),
  });
  return data.keywords || [];
}

export async function deleteKeywords(ids: number[]): Promise<void> {
  await serpbearAuthFetch(`/api/keywords?id=${ids.join(",")}`, {
    method: "DELETE",
  });
}

// ---- Analysis helpers ----

export type KeywordInsight = {
  type: "quick_win" | "declining" | "opportunity" | "strong";
  keyword: string;
  position: number;
  change: number; // positive = improved, negative = dropped
  message: string;
};

export function analyzeKeywords(keywords: SerpBearKeyword[]): KeywordInsight[] {
  const insights: KeywordInsight[] = [];

  for (const kw of keywords) {
    if (kw.position <= 0) continue;

    const historyEntries = Object.entries(kw.history || {}).sort(
      ([a], [b]) => new Date(b).getTime() - new Date(a).getTime()
    );

    // Calculate position change from recent history
    let change = 0;
    if (historyEntries.length >= 2) {
      const latest = historyEntries[0][1];
      const previous = historyEntries[Math.min(6, historyEntries.length - 1)][1];
      if (previous > 0 && latest > 0) {
        change = previous - latest; // positive = improved (lower position number)
      }
    }

    // Quick wins: ranking 5-20, close to page 1
    if (kw.position >= 5 && kw.position <= 20) {
      insights.push({
        type: "quick_win",
        keyword: kw.keyword,
        position: kw.position,
        change,
        message: `"${kw.keyword}" ${kw.position}. sırada — sayfa 1'e yakın, optimizasyon ile yükseltilebilir`,
      });
    }

    // Declining: lost 3+ positions recently
    if (change < -3) {
      insights.push({
        type: "declining",
        keyword: kw.keyword,
        position: kw.position,
        change,
        message: `"${kw.keyword}" son dönemde ${Math.abs(change)} sıra düştü (şu an ${kw.position}.)`,
      });
    }

    // Strong: top 3 and stable/improving
    if (kw.position <= 3 && change >= 0) {
      insights.push({
        type: "strong",
        keyword: kw.keyword,
        position: kw.position,
        change,
        message: `"${kw.keyword}" ${kw.position}. sırada — güçlü pozisyon korunuyor`,
      });
    }
  }

  // Sort: declining first (urgent), then quick wins, then opportunities, then strong
  const priority: Record<string, number> = { declining: 0, quick_win: 1, opportunity: 2, strong: 3 };
  insights.sort((a, b) => priority[a.type] - priority[b.type]);

  return insights;
}
