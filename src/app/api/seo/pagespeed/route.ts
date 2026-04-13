import { NextRequest, NextResponse } from "next/server";

export type PageSpeedResult = {
  url: string;
  fetchedAt: string;
  scores: {
    performance: number;
    seo: number;
    accessibility: number;
    bestPractices: number;
  };
  webVitals: {
    lcp: { value: number; unit: string; rating: "good" | "needs-improvement" | "poor" };
    cls: { value: number; unit: string; rating: "good" | "needs-improvement" | "poor" };
    inp: { value: number; unit: string; rating: "good" | "needs-improvement" | "poor" };
    fcp: { value: number; unit: string; rating: "good" | "needs-improvement" | "poor" };
    ttfb: { value: number; unit: string; rating: "good" | "needs-improvement" | "poor" };
  };
  error?: string;
};

function ratingFromScore(score: number, good: number, poor: number): "good" | "needs-improvement" | "poor" {
  if (score <= good) return "good";
  if (score <= poor) return "needs-improvement";
  return "poor";
}

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get("url");
    if (!url) {
      return NextResponse.json({ error: "url parameter required" }, { status: 400 });
    }

    const targetUrl = url.startsWith("http") ? url : `https://${url}`;
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(targetUrl)}&category=performance&category=seo&category=accessibility&category=best-practices&strategy=mobile`;

    const res = await fetch(apiUrl, { next: { revalidate: 0 } });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json({
        url: targetUrl,
        fetchedAt: new Date().toISOString(),
        scores: { performance: 0, seo: 0, accessibility: 0, bestPractices: 0 },
        webVitals: {
          lcp: { value: 0, unit: "ms", rating: "poor" as const },
          cls: { value: 0, unit: "", rating: "poor" as const },
          inp: { value: 0, unit: "ms", rating: "poor" as const },
          fcp: { value: 0, unit: "ms", rating: "poor" as const },
          ttfb: { value: 0, unit: "ms", rating: "poor" as const },
        },
        error: `PageSpeed API error: ${res.status} ${text.slice(0, 200)}`,
      } satisfies PageSpeedResult);
    }

    const data = await res.json();
    const cats = data.lighthouseResult?.categories || {};
    const audits = data.lighthouseResult?.audits || {};

    const lcpMs = audits["largest-contentful-paint"]?.numericValue || 0;
    const clsVal = audits["cumulative-layout-shift"]?.numericValue || 0;
    const inpMs = audits["interaction-to-next-paint"]?.numericValue || audits["max-potential-fid"]?.numericValue || 0;
    const fcpMs = audits["first-contentful-paint"]?.numericValue || 0;
    const ttfbMs = audits["server-response-time"]?.numericValue || 0;

    const result: PageSpeedResult = {
      url: targetUrl,
      fetchedAt: new Date().toISOString(),
      scores: {
        performance: Math.round((cats.performance?.score || 0) * 100),
        seo: Math.round((cats.seo?.score || 0) * 100),
        accessibility: Math.round((cats.accessibility?.score || 0) * 100),
        bestPractices: Math.round((cats["best-practices"]?.score || 0) * 100),
      },
      webVitals: {
        lcp: { value: Math.round(lcpMs), unit: "ms", rating: ratingFromScore(lcpMs, 2500, 4000) },
        cls: { value: Math.round(clsVal * 1000) / 1000, unit: "", rating: ratingFromScore(clsVal, 0.1, 0.25) },
        inp: { value: Math.round(inpMs), unit: "ms", rating: ratingFromScore(inpMs, 200, 500) },
        fcp: { value: Math.round(fcpMs), unit: "ms", rating: ratingFromScore(fcpMs, 1800, 3000) },
        ttfb: { value: Math.round(ttfbMs), unit: "ms", rating: ratingFromScore(ttfbMs, 800, 1800) },
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
