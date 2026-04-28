const PUBLIC_API_URL = "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius";

const INDUSTRY_TO_INDS_SCLS_CD: Record<string, string | undefined> = {
  치킨: "Q05A08",
  카페: "Q12A01",
  한식: "Q01A01",
  분식: "Q04A01",
  "피자·햄버거": "Q05A01",
  편의점: undefined,
  서비스업: undefined,
  기타: undefined,
};

const FALLBACK = {
  same_industry_500m: 0,
  total_stores_500m: 0,
  is_real: false,
} as const;

function toCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function extractTotalCount(payload: unknown): number {
  if (typeof payload !== "object" || payload === null) return 0;

  const body = (payload as { body?: unknown }).body;
  if (typeof body !== "object" || body === null) return 0;

  return toCount((body as { totalCount?: unknown }).totalCount);
}

async function fetchStoreCount(
  lat: number,
  lng: number,
  apiKey: string,
  indsSclsCd?: string,
): Promise<number> {
  const query = new URLSearchParams({
    serviceKey: apiKey,
    cx: String(lng),
    cy: String(lat),
    radius: "500",
    numOfRows: "1000",
    type: "json",
  });

  if (indsSclsCd) {
    query.set("indsSclsCd", indsSclsCd);
  }

  const response = await fetch(`${PUBLIC_API_URL}?${query.toString()}`, {
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`공공데이터 API 오류 (${response.status})`);
  }

  const data = (await response.json()) as unknown;
  return extractTotalCount(data);
}

export async function fetchPublicCompetition(
  lat: number,
  lng: number,
  industry: string,
): Promise<{ same_industry_500m: number; total_stores_500m: number; is_real: boolean }> {
  const apiKey = process.env.DATA_GO_KR_API_KEY;
  if (!apiKey || apiKey === "placeholder") return { ...FALLBACK };

  const indsSclsCd = INDUSTRY_TO_INDS_SCLS_CD[industry];

  try {
    const [sameIndustryCount, totalCount] = await Promise.all([
      indsSclsCd ? fetchStoreCount(lat, lng, apiKey, indsSclsCd) : Promise.resolve(0),
      fetchStoreCount(lat, lng, apiKey),
    ]);

    return {
      same_industry_500m: Math.max(0, sameIndustryCount),
      total_stores_500m: Math.max(0, totalCount),
      is_real: true,
    };
  } catch (error) {
    console.warn("[public-competition] 공공 경쟁 데이터 조회 실패", error);
    return { ...FALLBACK };
  }
}
