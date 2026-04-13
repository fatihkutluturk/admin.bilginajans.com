import { NextRequest, NextResponse } from "next/server";
import { getKeywords, getKeyword } from "@/lib/serpbear";
import type { SerpResult } from "@/lib/serpbear";

// Domains to exclude from competitor analysis (social media, directories, etc.)
const NOISE_DOMAINS = new Set([
  "www.instagram.com", "instagram.com",
  "www.facebook.com", "facebook.com", "m.facebook.com",
  "www.youtube.com", "youtube.com", "m.youtube.com",
  "twitter.com", "x.com", "www.x.com",
  "www.linkedin.com", "linkedin.com",
  "tr.pinterest.com", "www.pinterest.com", "in.pinterest.com", "pinterest.com",
  "www.tiktok.com", "tiktok.com",
  "play.google.com", "apps.apple.com",
  "tr.wikipedia.org", "en.wikipedia.org",
  "www.google.com", "maps.google.com",
]);

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    const match = url.match(/^https?:\/\/([^/]+)/);
    return match ? match[1].replace(/^www\./, "") : "";
  }
}

type CompetitorKeyword = {
  keyword: string;
  theirPosition: number;
  yourPosition: number;
};

type CompetitorEntry = {
  domain: string;
  keywordsInCommon: number;
  avgPosition: number;
  keywords: CompetitorKeyword[];
};

type SerpByKeyword = {
  keyword: string;
  yourPosition: number;
  topCompetitors: Array<{ domain: string; position: number; title: string; url: string }>;
};

export async function POST(req: NextRequest) {
  try {
    const { domain } = await req.json();
    if (!domain) {
      return NextResponse.json({ error: "domain required" }, { status: 400 });
    }

    const trackedDomain = domain.replace(/^www\./, "");

    // Get all keywords for this domain
    const keywords = await getKeywords(domain);
    if (keywords.length === 0) {
      return NextResponse.json({ competitors: [], serpByKeyword: [] });
    }

    // Fetch each keyword's full detail (includes lastResult)
    const competitorMap = new Map<string, CompetitorKeyword[]>();
    const serpByKeyword: SerpByKeyword[] = [];

    await Promise.all(
      keywords.map(async (kw) => {
        try {
          const detail = await getKeyword(kw.ID);
          const results: SerpResult[] = detail.lastResult || [];
          if (results.length === 0) return;

          // Build per-keyword SERP view (top 10 non-self, non-noise)
          const topCompetitors: SerpByKeyword["topCompetitors"] = [];
          for (const r of results) {
            const rDomain = extractDomain(r.url);
            if (!rDomain || rDomain === trackedDomain || rDomain === `www.${trackedDomain}`) continue;
            if (NOISE_DOMAINS.has(rDomain) || NOISE_DOMAINS.has(`www.${rDomain}`)) continue;
            if (topCompetitors.length < 10) {
              topCompetitors.push({ domain: rDomain, position: r.position, title: r.title, url: r.url });
            }
          }

          serpByKeyword.push({
            keyword: kw.keyword,
            yourPosition: kw.position,
            topCompetitors,
          });

          // Aggregate into competitor map
          for (const r of results) {
            const rDomain = extractDomain(r.url);
            if (!rDomain || rDomain === trackedDomain || rDomain === `www.${trackedDomain}`) continue;
            if (NOISE_DOMAINS.has(rDomain) || NOISE_DOMAINS.has(`www.${rDomain}`)) continue;

            if (!competitorMap.has(rDomain)) competitorMap.set(rDomain, []);
            competitorMap.get(rDomain)!.push({
              keyword: kw.keyword,
              theirPosition: r.position,
              yourPosition: kw.position,
            });
          }
        } catch {
          // Skip keywords that fail to fetch
        }
      })
    );

    // Build sorted competitor list
    const competitors: CompetitorEntry[] = Array.from(competitorMap.entries())
      .map(([compDomain, kws]) => ({
        domain: compDomain,
        keywordsInCommon: kws.length,
        avgPosition: Math.round((kws.reduce((s, k) => s + k.theirPosition, 0) / kws.length) * 10) / 10,
        keywords: kws.sort((a, b) => a.theirPosition - b.theirPosition),
      }))
      .sort((a, b) => b.keywordsInCommon - a.keywordsInCommon)
      .slice(0, 50); // Top 50 competitors

    return NextResponse.json({ competitors, serpByKeyword });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
