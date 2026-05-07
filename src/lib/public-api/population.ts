import { searchShops } from '@/lib/commercial-area/csv-search';
import type { CollectedPopulationData } from '@/types/analysis';

type PopulationProvider = {
  getPopulationData(lat: number, lng: number): Promise<CollectedPopulationData>;
};

type StoreSummary = {
  total: number;
  food: number;
  retail: number;
  service: number;
  officeLike: number;
};

const BASE = {
  radius_500m: { residential: 8500, households: 3200, workers: 2800 },
  radius_1km: { residential: 28000, households: 11500, workers: 6500 },
  radius_2km: { residential: 72000, households: 28500, workers: 15000 },
  core_age_group: '30~50대 62%',
  gender_ratio: '남 49% / 여 51%',
} as const;

function scalePopulation(base: number, factor: number): number {
  return Math.max(100, Math.round(base * factor));
}

function densityFactor(totalStoreCount: number): number {
  if (totalStoreCount <= 0) return 0.95;
  if (totalStoreCount < 30) return 0.98;
  if (totalStoreCount < 80) return 1.05;
  if (totalStoreCount < 140) return 1.12;
  return 1.2;
}

function classifyCommercialAreaTypeFromStores(summary: StoreSummary): string {
  if (summary.total <= 0) return '혼합상권';

  const foodRetailRatio = (summary.food + summary.retail) / summary.total;
  const serviceRatio = summary.service / summary.total;
  const officeRatio = summary.officeLike / summary.total;

  if (officeRatio >= 0.28) return '오피스상권';
  if (foodRetailRatio >= 0.55) return '상업상권';
  if (serviceRatio >= 0.36) return '주거상권';
  return '혼합상권';
}

function extractName(item: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function summarizeStores(items: unknown[]): StoreSummary {
  let food = 0;
  let retail = 0;
  let service = 0;
  let officeLike = 0;

  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const major = extractName(item, 'indsLclsNm', 'majorName', 'major');
    const mid = extractName(item, 'indsMclsNm', 'midName', 'middle');
    const sub = extractName(item, 'indsSclsNm', 'subName', 'sub');
    const text = `${major} ${mid} ${sub}`;

    if (text.includes('음식') || text.includes('카페') || text.includes('주점')) food += 1;
    if (text.includes('소매') || text.includes('편의점') || text.includes('마트')) retail += 1;
    if (text.includes('서비스') || text.includes('미용') || text.includes('세탁')) service += 1;
    if (text.includes('부동산') || text.includes('학원') || text.includes('사무') || text.includes('금융')) {
      officeLike += 1;
    }
  }

  return { total: items.length, food, retail, service, officeLike };
}

async function getCsvFallbackAreaType(lat: number, lng: number): Promise<string | null> {
  try {
    const result = await searchShops({ lat, lng, radiusM: 1000, limit: 200 });
    return result.commercialAreaType;
  } catch {
    return null;
  }
}

type SbizStoreRadiusResponse = {
  body?: { items?: unknown[] };
  items?: unknown[];
};

type SbizPopulationInput = {
  lat: number;
  lng: number;
  apiKey: string;
};

async function fetchStoreDistribution({ lat, lng, apiKey }: SbizPopulationInput): Promise<StoreSummary | null> {
  const url = new URL('https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius');
  url.searchParams.set('serviceKey', apiKey);
  url.searchParams.set('radius', '1000');
  url.searchParams.set('cx', String(lng));
  url.searchParams.set('cy', String(lat));
  url.searchParams.set('numOfRows', '300');
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('type', 'json');

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });

    if (!response.ok) return null;
    const json = (await response.json()) as SbizStoreRadiusResponse;
    const items = Array.isArray(json.body?.items)
      ? json.body?.items
      : Array.isArray(json.items)
        ? json.items
        : [];

    return summarizeStores(items);
  } catch {
    return null;
  }
}

function buildPopulationPayload(commercialAreaType: string, totalStoreCount: number): CollectedPopulationData {
  const factor = densityFactor(totalStoreCount);
  return {
    radius_500m: {
      residential: scalePopulation(BASE.radius_500m.residential, factor),
      households: scalePopulation(BASE.radius_500m.households, factor),
      workers: scalePopulation(BASE.radius_500m.workers, factor),
    },
    radius_1km: {
      residential: scalePopulation(BASE.radius_1km.residential, factor),
      households: scalePopulation(BASE.radius_1km.households, factor),
      workers: scalePopulation(BASE.radius_1km.workers, factor),
    },
    radius_2km: {
      residential: scalePopulation(BASE.radius_2km.residential, factor),
      households: scalePopulation(BASE.radius_2km.households, factor),
      workers: scalePopulation(BASE.radius_2km.workers, factor),
    },
    core_age_group: BASE.core_age_group,
    gender_ratio: BASE.gender_ratio,
    commercial_area_type: commercialAreaType,
    hourly_traffic: {
      morning: { weekday: 64, weekend: 48 },
      lunch: { weekday: 92, weekend: 73 },
      afternoon: { weekday: 71, weekend: 78 },
      evening: { weekday: 83, weekend: 95 },
      night: { weekday: 39, weekend: 61 },
    },
    is_mock: true,
    source: 'sbiz_store_distribution_estimate',
  };
}

type RealSbizPopulationProvider = PopulationProvider;

function createRealSbizPopulationProvider(apiKey: string): RealSbizPopulationProvider {
  return {
    async getPopulationData(lat: number, lng: number): Promise<CollectedPopulationData> {
      const summary = await fetchStoreDistribution({ lat, lng, apiKey });
      const areaByStores = summary ? classifyCommercialAreaTypeFromStores(summary) : null;
      const csvAreaType = await getCsvFallbackAreaType(lat, lng);
      const commercialAreaType = areaByStores ?? csvAreaType ?? '혼합상권';
      const totalStoreCount = summary?.total ?? 0;
      return buildPopulationPayload(commercialAreaType, totalStoreCount);
    },
  };
}

type MockPopulationProvider = PopulationProvider;

function createMockPopulationProvider(): MockPopulationProvider {
  return {
    async getPopulationData(lat: number, lng: number): Promise<CollectedPopulationData> {
      const csvAreaType = await getCsvFallbackAreaType(lat, lng);
      const payload = buildPopulationPayload(csvAreaType ?? '혼합상권', 0);
      return {
        ...payload,
        source: 'mock_population',
      };
    },
  };
}

export function getPopulationProvider(): PopulationProvider {
  const apiKey = process.env.DATA_GO_KR_API_KEY?.trim();
  return apiKey ? createRealSbizPopulationProvider(apiKey) : createMockPopulationProvider();
}

export async function getPopulationData(lat: number, lng: number): Promise<CollectedPopulationData> {
  try {
    return await getPopulationProvider().getPopulationData(lat, lng);
  } catch {
    return createMockPopulationProvider().getPopulationData(lat, lng);
  }
}
