import 'server-only';

import {
  mapBrandIndustryToMajor,
  mapBrandIndustryToSub,
  mapSubIndustryToSub,
  searchShops,
} from '@/lib/commercial-area/csv-search';
import { haversineDistance } from '@/lib/utils/geo';
import type { CollectedCompetitorData, CompetitorInfo } from '@/types/analysis';
import type { SbizApiResponse, SbizStoreItem } from '@/types/public-data';

const SBIZ_BASE_URL = 'https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius';
const MAX_ITEMS = 100;
const PAGE_SIZE = 20;

const FRANCHISE_KEYWORDS = [
  '스타벅스',
  '이디야',
  '메가커피',
  '빽다방',
  '투썸',
  '컴포즈',
  '파리바게뜨',
  'GS25',
  'CU',
  '세븐일레븐',
];

export function classifyType(name: string): '프랜차이즈' | '개인점' {
  const normalized = name.replaceAll(' ', '').toUpperCase();
  const isFranchise = FRANCHISE_KEYWORDS.some((keyword) =>
    normalized.includes(keyword.replaceAll(' ', '').toUpperCase()),
  );
  return isFranchise ? '프랜차이즈' : '개인점';
}

async function searchCsvFallback(
  lat: number,
  lng: number,
  radiusM: number,
  industryCode?: string,
  category?: string,
): Promise<SbizStoreItem[]> {
  try {
    const major = industryCode ? mapBrandIndustryToMajor(industryCode) : undefined;
    // 업종 세부(category)가 있으면 소분류 매핑 우선, 없으면 대분류 코드 기반 소분류 매핑
    const sub = category
      ? mapSubIndustryToSub(category)
      : industryCode
        ? mapBrandIndustryToSub(industryCode)
        : undefined;

    const result = await searchShops({
      lat,
      lng,
      radiusM,
      industryMajor: major,
      industrySub: sub,
      limit: MAX_ITEMS,
    });

    return result.shops.map((shop) => ({
      bizesNm: shop.name,
      indsLclsNm: shop.industryMajor,
      indsMclsNm: shop.industryMid,
      indsSclsNm: shop.industrySub,
      lnoAdr: shop.address,
      rdnmAdr: shop.address,
      lon: String(shop.lng),
      lat: String(shop.lat),
    }));
  } catch {
    return [];
  }
}

export async function fetchStoreListInRadius(
  lat: number,
  lng: number,
  radiusM: number,
  industryCode?: string,
  category?: string,
): Promise<SbizStoreItem[]> {
  const apiKey = process.env.DATA_GO_KR_API_KEY;
  if (!apiKey) {
    return searchCsvFallback(lat, lng, radiusM, industryCode, category);
  }

  try {
    const allItems: SbizStoreItem[] = [];
    let pageNo = 1;

    while (allItems.length < MAX_ITEMS) {
      const params = new URLSearchParams({
        serviceKey: apiKey,
        radius: String(radiusM),
        cx: String(lng),
        cy: String(lat),
        numOfRows: String(PAGE_SIZE),
        pageNo: String(pageNo),
        type: 'json',
      });

      if (industryCode) {
        params.set('indsLclsCd', industryCode);
      }

      const url = `${SBIZ_BASE_URL}?${params.toString()}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });

      if (!response.ok) {
        return searchCsvFallback(lat, lng, radiusM, industryCode, category);
      }

      const json = (await response.json()) as SbizApiResponse;
      const rawItems = json?.body?.items?.item;
      const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

      allItems.push(...items);

      const totalCount = json?.body?.totalCount ?? 0;
      const reachedEnd = items.length === 0 || pageNo * PAGE_SIZE >= totalCount || allItems.length >= MAX_ITEMS;
      if (reachedEnd) break;
      pageNo += 1;
    }

    return allItems.slice(0, MAX_ITEMS);
  } catch {
    return searchCsvFallback(lat, lng, radiusM, industryCode, category);
  }
}

export async function getSbizCompetitors(
  lat: number,
  lng: number,
  industry: string,
  radiusM: number,
  category?: string,
): Promise<CollectedCompetitorData> {
  const stores = await fetchStoreListInRadius(lat, lng, radiusM, industry, category);

  // 공공 API 경로(CSV fallback이 아닌 경우)에서도 업종 세부(category) 기반 소분류 필터 적용
  // CSV fallback은 searchShops 내부에서 이미 industrySub 필터링이 적용됨
  const categorySubKeyword = category ? mapSubIndustryToSub(category) : undefined;
  const filteredStores = categorySubKeyword
    ? stores.filter((store) => (store.indsSclsNm ?? '').includes(categorySubKeyword))
    : stores;

  const competitors: CompetitorInfo[] = filteredStores.map((store, index) => {
    const storeLat = Number.parseFloat(store.lat);
    const storeLng = Number.parseFloat(store.lon);
    const parsedLat = Number.isFinite(storeLat) ? storeLat : lat;
    const parsedLng = Number.isFinite(storeLng) ? storeLng : lng;

    return {
      name: store.bizesNm,
      address: store.rdnmAdr || store.lnoAdr,
      lat: parsedLat,
      lng: parsedLng,
      distance_m: Math.round(haversineDistance(lat, lng, parsedLat, parsedLng)),
      rating: null,
      review_count: 0,
      is_open: null,
      place_id: `sbiz-${index}-${store.bizesNm}`,
      type: classifyType(store.bizesNm),
    };
  });

  return {
    competitors,
    total: competitors.length,
    same_brand_exists: false,
    source: 'csv_fallback',
  };
}
