/**
 * 네이버 부동산 서버사이드 수집기
 * 브라우저 없이 서버에서 직접 Naver 상가 매물 API를 호출합니다.
 */

import type { NaverListingInput } from "@/types/recommend";

const NAVER_API = "https://new.land.naver.com/api/articles";
const MAX_PAGES = 50;

/** Naver API 응답 단일 매물 타입 */
type NaverArticle = {
  atclNo?: string;
  articleNo?: string;
  tradeTypeName?: string;
  tradeType?: string;
  dealOrWarrantPrc?: string;
  rentPrc?: string;
  atclNm?: string;
  articleName?: string;
  bildNm?: string;
  buildingName?: string;
  dtlAddr?: string;
  detailAddress?: string;
  flrInfo?: string;
  floorInfo?: string;
  area1?: string;
  spc1?: string;
  area2?: string;
  spc2?: string;
  bildUsg?: string;
  buildingUse?: string;
  prkCnt?: string;
  lat?: string;
  lng?: string;
  repImgUrl?: string;
  representativeImgUrl?: string;
};

type NaverApiResponse = {
  articleList?: NaverArticle[];
  body?: NaverArticle[];
  isMoreData?: boolean;
  totalCount?: number;
};

export type ScrapeProgress = {
  current: number;
  total: number;
  page: number;
};

/** 네이버 API 단일 매물 → DB 입력 형식으로 변환 */
function mapArticle(article: NaverArticle, regionCode: string): NaverListingInput {
  const tradeType = article.tradeTypeName ?? article.tradeType ?? "";
  let deposit: number | null = null;
  let monthlyRent: number | null = null;
  let salePrice: number | null = null;

  const rawPrc = parseInt(article.dealOrWarrantPrc ?? "0", 10);
  const rawRent = parseInt(article.rentPrc ?? "0", 10);

  if (tradeType === "월세") {
    deposit = rawPrc || null;
    monthlyRent = rawRent || null;
  } else if (tradeType === "전세") {
    deposit = rawPrc || null;
  } else if (tradeType === "매매") {
    salePrice = rawPrc || null;
  }

  const prkCnt = parseInt(article.prkCnt ?? "0", 10);
  const lat = parseFloat(article.lat ?? "0");
  const lng = parseFloat(article.lng ?? "0");

  return {
    article_id: article.atclNo ?? article.articleNo ?? "",
    region_code: regionCode,
    trade_type: tradeType,
    article_name: article.atclNm ?? article.articleName ?? undefined,
    building_name: article.bildNm ?? article.buildingName ?? undefined,
    detail_address: article.dtlAddr ?? article.detailAddress ?? undefined,
    floor_info: article.flrInfo ?? article.floorInfo ?? undefined,
    area_supply: parseFloat(article.area1 ?? article.spc1 ?? "0") || undefined,
    area_exclusive: parseFloat(article.area2 ?? article.spc2 ?? "0") || undefined,
    deposit,
    monthly_rent: monthlyRent,
    sale_price: salePrice,
    building_use: article.bildUsg ?? article.buildingUse ?? undefined,
    parking_available: prkCnt > 0,
    parking_count: prkCnt > 0 ? prkCnt : undefined,
    latitude: lat !== 0 ? lat : null,
    longitude: lng !== 0 ? lng : null,
    image_url: article.repImgUrl ?? article.representativeImgUrl ?? undefined,
    naver_url: `https://new.land.naver.com/offices?articleNo=${article.atclNo ?? article.articleNo ?? ""}`,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 네이버 부동산 상가 매물 수집
 * @param regionCode 법정동코드 (10자리)
 * @param tradeType  거래유형 ('월세'|'전세'|'매매'|'' = 전체)
 * @param onProgress 진행상황 콜백
 */
export async function scrapeNaverListings(
  regionCode: string,
  tradeType: string = "",
  onProgress?: (progress: ScrapeProgress) => void,
): Promise<NaverListingInput[]> {
  const allListings: NaverListingInput[] = [];
  let page = 1;
  let hasMore = true;

  let retryCount = 0;
  const MAX_RETRIES = 3;

  while (hasMore && page <= MAX_PAGES) {
    const url =
      `${NAVER_API}?cortarNo=${encodeURIComponent(regionCode)}` +
      `&realEstateType=SG` +
      `&tradeType=${encodeURIComponent(tradeType)}` +
      `&page=${page}` +
      `&sameAddressGroup=false`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: "https://new.land.naver.com/offices",
        Origin: "https://new.land.naver.com",
        "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
      },
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });

    if (response.status === 429) {
      retryCount++;
      if (retryCount > MAX_RETRIES) {
        // 최대 재시도 초과 — 현재까지 수집된 데이터로 종료
        break;
      }
      // 지수 백오프: 5s, 10s, 20s
      await sleep(5000 * Math.pow(2, retryCount - 1));
      continue;
    }

    retryCount = 0; // 성공 시 재시도 카운터 초기화

    if (!response.ok) {
      throw new Error(`네이버 API 오류: ${response.status}`);
    }

    const data = (await response.json()) as NaverApiResponse;
    const articles = data.articleList ?? data.body ?? [];

    if (!articles || articles.length === 0) {
      break;
    }

    for (const article of articles) {
      const listing = mapArticle(article, regionCode);
      if (listing.article_id) {
        allListings.push(listing);
      }
    }

    hasMore = !!data.isMoreData;

    onProgress?.({
      current: allListings.length,
      total: hasMore ? allListings.length + 1 : allListings.length,
      page,
    });

    page++;

    if (hasMore) {
      // 1~3초 랜덤 딜레이 (Rate Limit 방지)
      await sleep(randomBetween(1000, 3000));
    }
  }

  return allListings;
}
