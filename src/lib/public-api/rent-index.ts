import { buildCacheKey, getOrFetch } from '@/lib/cache/public-data-cache';
import type { CollectedRentData } from '@/types/analysis';

const RENT_TTL_SECONDS = 60 * 60 * 24;

type RentBand = {
  min: number;
  max: number;
};

function isSeoul(lat: number, lng: number): boolean {
  return lat > 37.4 && lat < 37.7 && lng > 126.7 && lng < 127.2;
}

function getFallbackRentBand(lat: number, lng: number): { areaName: string; band: RentBand } {
  if (isSeoul(lat, lng)) {
    const gangnamLike = lat > 37.48 && lng > 126.97;
    return {
      areaName: gangnamLike ? 'Seoul(핵심상권)' : 'Seoul',
      band: gangnamLike ? { min: 230_000, max: 300_000 } : { min: 150_000, max: 240_000 },
    };
  }

  if (lat > 35.0 && lat < 37.1 && lng > 126.5 && lng < 129.5) {
    return { areaName: '광역시권', band: { min: 80_000, max: 150_000 } };
  }

  return { areaName: '기타도시', band: { min: 50_000, max: 100_000 } };
}

function averageBand(band: RentBand): number {
  return Math.round((band.min + band.max) / 2);
}

type SbizRentItem = Record<string, unknown>;
type SbizRentResponse = {
  body?: { items?: SbizRentItem[] };
  items?: SbizRentItem[];
};

function getNumber(item: SbizRentItem, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.replaceAll(',', ''));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

async function fetchRentFromSbiz(lat: number, lng: number): Promise<CollectedRentData | null> {
  const apiKey = process.env.DATA_GO_KR_API_KEY?.trim();
  if (!apiKey) return null;

  const url = new URL('https://apis.data.go.kr/B553077/api/open/sdsc2/bizAreaInfoInRadius');
  url.searchParams.set('serviceKey', apiKey);
  url.searchParams.set('radius', '1000');
  url.searchParams.set('cx', String(lng));
  url.searchParams.set('cy', String(lat));
  url.searchParams.set('numOfRows', '30');
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('type', 'json');

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
    if (!response.ok) return null;

    const json = (await response.json()) as SbizRentResponse;
    const items = Array.isArray(json.body?.items)
      ? json.body.items
      : Array.isArray(json.items)
        ? json.items
        : [];
    if (items.length === 0) return null;

    const rents = items
      .map((item) => getNumber(item, 'rntfee', 'rent', 'avgRntfee', 'avgRent'))
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);

    const deposits = items
      .map((item) => getNumber(item, 'grfe', 'deposit', 'avgGrfe', 'avgDeposit'))
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);

    const areaNameRaw = items
      .map((item) => item['trdarNm'] ?? item['areaName'] ?? item['signguNm'])
      .find((value) => typeof value === 'string' && value.trim());

    const avgRent = rents.length > 0 ? Math.round(rents.reduce((a, b) => a + b, 0) / rents.length) : null;
    const avgDeposit =
      deposits.length > 0 ? Math.round(deposits.reduce((a, b) => a + b, 0) / deposits.length) : null;

    if (avgRent === null && avgDeposit === null) return null;

    return {
      avg_monthly_rent_per_pyeong: avgRent,
      avg_deposit_per_pyeong: avgDeposit,
      area_name: typeof areaNameRaw === 'string' ? areaNameRaw : null,
      is_mock: false,
      source: 'sbiz_rent_api',
    };
  } catch {
    return null;
  }
}

function fallbackRent(lat: number, lng: number): CollectedRentData {
  const { areaName, band } = getFallbackRentBand(lat, lng);
  const avg = averageBand(band);

  return {
    avg_monthly_rent_per_pyeong: avg,
    avg_deposit_per_pyeong: avg * 10,
    area_name: areaName,
    is_mock: true,
    source: 'district_static_fallback',
  };
}

export async function getRentData(
  lat: number,
  lng: number,
  targetSizePyeong?: number,
): Promise<CollectedRentData> {
  const key = buildCacheKey({
    provider: 'rent-index',
    endpoint: 'bizAreaInfoInRadius',
    lat,
    lng,
    extra: { targetSizePyeong: targetSizePyeong ?? null },
  });

  const fetcher = async (): Promise<CollectedRentData> => {
    const apiData = await fetchRentFromSbiz(lat, lng);
    if (apiData) return apiData;
    return fallbackRent(lat, lng);
  };

  try {
    const { data } = await getOrFetch<CollectedRentData>(key, 'rent-index', RENT_TTL_SECONDS, fetcher);
    return data;
  } catch {
    return fetcher();
  }
}
