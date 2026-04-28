// ============================================================
// 웹 검색 유틸리티
// 우선순위: Tavily → Serper(Google) → 검색 없음 (graceful fallback)
// ============================================================

export type WebSearchResult = {
  title: string;
  url: string;
  content: string;  // 요약/스니펫
  domain: string;   // 출처 도메인 (인용 칩에 표시)
};

export type SearchQueryResult = {
  query: string;
  results: WebSearchResult[];
};

/** 도메인에서 짧은 출처명 추출 (www.intoday.kr → Intoday) */
function extractSourceName(url: string): string {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    const name = domain.split(".")[0] ?? domain;
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return url;
  }
}

// ── Tavily ──────────────────────────────────────────────────

async function searchViaTavily(query: string): Promise<WebSearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 5,
        search_depth: "basic",
        include_answer: false,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };
    return (data.results ?? []).slice(0, 5).map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      content: (r.content ?? "").slice(0, 500),
      domain: extractSourceName(r.url ?? ""),
    }));
  } catch {
    return [];
  }
}

// ── Serper (Google) ──────────────────────────────────────────

async function searchViaSerper(query: string): Promise<WebSearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
      body: JSON.stringify({ q: query, num: 5, hl: "ko", gl: "kr" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      organic?: Array<{ title?: string; link?: string; snippet?: string }>;
    };
    return (data.organic ?? []).slice(0, 5).map((r) => ({
      title: r.title ?? "",
      url: r.link ?? "",
      content: r.snippet ?? "",
      domain: extractSourceName(r.link ?? ""),
    }));
  } catch {
    return [];
  }
}

// ── 메인 검색 함수 ───────────────────────────────────────────

/** Tavily 우선, 없으면 Serper, 없으면 빈 배열 */
export async function webSearch(query: string): Promise<WebSearchResult[]> {
  if (process.env.TAVILY_API_KEY) return searchViaTavily(query);
  if (process.env.SERPER_API_KEY) return searchViaSerper(query);
  return [];
}

/** 여러 쿼리 병렬 실행 */
export async function multiSearch(queries: string[]): Promise<SearchQueryResult[]> {
  const results = await Promise.all(
    queries.map(async (q) => ({ query: q, results: await webSearch(q) })),
  );
  return results;
}

/** 브랜드명 + 사용자 컨텍스트 기반 검색 쿼리 생성 */
export function buildReportSearchQueries(brandName: string, userContext: string): string[] {
  const year = new Date().getFullYear();
  const queries: string[] = [
    `${brandName} 창업비용 가맹비 인테리어 ${year}`,
    `${brandName} 가맹점 평균매출 순이익 수익성`,
    `${brandName} 창업 후기 점주 폐점률 ${year}`,
  ];
  // 사용자가 특정 지역을 언급한 경우 지역 특화 쿼리 추가
  const regionMatch = userContext.match(/서울|부산|인천|대구|광주|대전|수원|인천|경기/);
  if (regionMatch) {
    queries.push(`${brandName} ${regionMatch[0]} 창업 상권`);
  }
  return queries.slice(0, 3);
}

/** 검색 API 설정 여부 확인 */
export function isSearchConfigured(): boolean {
  return Boolean(process.env.TAVILY_API_KEY || process.env.SERPER_API_KEY);
}
