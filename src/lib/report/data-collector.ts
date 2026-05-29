import { searchNearbyCompetitors } from '@/lib/public-api/google-places';
import { getPopulationData } from '@/lib/public-api/population';
import { getRentData } from '@/lib/public-api/rent-index';
import { getCommercialSales } from '@/lib/public-api/seoul-commercial';
import { getSbizCompetitors } from '@/lib/public-api/sbiz-stores';
import type {
  CollectedCommercialData,
  CollectedCompetitorData,
  CollectedLocationData,
  CollectedPopulationData,
  CollectedRentData,
  DataSourceMeta,
} from '@/types/analysis';

type PartialCollectedResults = {
  population?: CollectedPopulationData | null;
  commercial?: CollectedCommercialData | null;
  rent?: CollectedRentData | null;
  competitors?: CollectedCompetitorData | null;
  location?: CollectedLocationData | null;
};

const withTimeout = async <T>(factory: () => Promise<T>, timeoutMs = 8_500): Promise<T | null> => {
  try {
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    });
    return await Promise.race([factory(), timeoutPromise]);
  } catch {
    return null;
  }
};

// PRD 버그 2 해결: null-safe API 래퍼 — undefined.get 에러 방지
// 공공데이터 API가 해당 지역 데이터를 반환하지 않을 때 fallback을 보장
export async function safeApiCall<T>(
  apiCall: () => Promise<T>,
  fallbackValue: T,
  source: string,
): Promise<{ data: T; source: string; success: boolean }> {
  try {
    const data = await apiCall();
    if (data == null) {
      return { data: fallbackValue, source: `${source} (데이터 없음)`, success: false };
    }
    return { data, source, success: true };
  } catch (error) {
    console.error(`[safeApiCall] ${source} 호출 실패:`, error instanceof Error ? error.message : error);
    return { data: fallbackValue, source: `${source} (호출 실패)`, success: false };
  }
}

// 수집 완성도 점수 산출 (n/10 항목 기준)
export function calcDataCompleteness(results: PartialCollectedResults): {
  score: number;
  percent: number;
  sufficient: boolean;
} {
  const checks = [
    results.population != null,
    results.commercial != null,
    results.rent != null,
    results.competitors != null,
    results.location != null,
    results.population?.radius_500m != null,
    results.population?.radius_1km != null,
    (results.competitors?.competitors?.length ?? 0) > 0,
    results.rent?.avg_monthly_rent_per_pyeong != null,
    results.commercial?.competition_density != null,
  ];

  const score = checks.filter(Boolean).length;
  const percent = Math.round((score / checks.length) * 100);

  return { score, percent, sufficient: percent >= 60 };
}

const normalize = (value: string): string => value.replaceAll(' ', '').toLowerCase();

export const collectPopulation = async (
  lat: number,
  lng: number,
): Promise<CollectedPopulationData | null> => {
  // SGIS 연동 시 다건 외부 호출이 발생하므로 기본 timeout(8.5s)보다 여유를 둔다.
  return withTimeout(() => getPopulationData(lat, lng), 25_000);
};

export const collectCommercial = async (
  lat: number,
  lng: number,
  industry: string,
): Promise<CollectedCommercialData | null> => {
  const commercial = await withTimeout(() => getCommercialSales(lat, lng, industry));
  if (commercial) {
    return commercial;
  }

  const fallback = await withTimeout(() => getSbizCompetitors(lat, lng, industry, 1_000));
  if (!fallback) {
    return null;
  }

  const sameIndustryCount = fallback.total;
  const score = Math.min(100, Math.round((sameIndustryCount / Math.max(sameIndustryCount, 1)) * 100));

  return {
    commercial_area_type: '혼합상권',
    competition_density: {
      score,
      level: score >= 75 ? '매우높음' : score >= 55 ? '높음' : score >= 30 ? '보통' : '낮음',
      same_industry_count: sameIndustryCount,
      total_shop_count: fallback.total,
    },
    industry_distribution: [
      {
        category: industry || '기타',
        count: fallback.total,
        ratio: fallback.total > 0 ? 100 : 0,
      },
    ],
    total_shops: fallback.total,
    source: 'sbiz_competitor_fallback',
  };
};

export const collectCompetitors = async (
  lat: number,
  lng: number,
  industry: string,
  radiusM: number,
  category?: string,
): Promise<CollectedCompetitorData | null> => {
  const primary = await withTimeout(() => searchNearbyCompetitors(lat, lng, industry, radiusM, category));
  const result = primary ?? (await withTimeout(() => getSbizCompetitors(lat, lng, industry, radiusM, category)));
  if (!result) {
    return null;
  }

  const industryNormalized = normalize(industry);
  const sameBrandExists = result.competitors.some((item) => normalize(item.name).includes(industryNormalized));

  return {
    ...result,
    same_brand_exists: sameBrandExists || result.same_brand_exists,
  };
};

export const collectRent = async (
  lat: number,
  lng: number,
  targetSizePyeong?: number,
): Promise<CollectedRentData | null> => {
  return withTimeout(() => getRentData(lat, lng, targetSizePyeong));
};

export const collectLocation = async (
  address: string,
  lat: number,
  lng: number,
): Promise<CollectedLocationData> => {
  const districtMatch = address.match(/([가-힣]+구)/);
  const dongMatch = address.match(/([가-힣0-9]+동)/);

  return {
    lat,
    lng,
    formatted_address: address,
    district: districtMatch?.[1] ?? null,
    dong: dongMatch?.[1] ?? null,
  };
};

export const buildDataSources = (results: PartialCollectedResults): DataSourceMeta => {
  const now = new Date().toISOString();

  return {
    population: {
      source: results.population?.source ?? 'unknown',
      collected_at: now,
      cache_hit: false,
    },
    commercial: {
      source: results.commercial?.source ?? 'unknown',
      collected_at: now,
      cache_hit: false,
    },
    rent: {
      source: results.rent?.source ?? 'unknown',
      collected_at: now,
      cache_hit: false,
    },
    competitors: {
      source: results.competitors?.source ?? 'unknown',
      collected_at: now,
      cache_hit: false,
    },
    location: {
      source: 'user_input',
      collected_at: now,
    },
  };
};
