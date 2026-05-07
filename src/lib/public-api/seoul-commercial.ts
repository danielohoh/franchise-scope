'use server';

import proj4 from 'proj4';

import { getOrFetch, buildCacheKey } from '@/lib/cache/public-data-cache';
import type { CollectedCommercialData } from '@/types/analysis';
import type { SeoulCommercialApiResponse } from '@/types/public-data';

const TM128 = '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43';
const WGS84 = 'EPSG:4326';
const TTL_SECONDS = 24 * 60 * 60;

function mockCommercialData(): CollectedCommercialData {
  return {
    commercial_area_type: '혼합상권',
    competition_density: {
      score: 50,
      level: '보통',
      same_industry_count: 5,
      total_shop_count: 30,
    },
    industry_distribution: [],
    total_shops: 30,
    source: 'mock',
  };
}

export async function getSeoulCommercialData(
  lat: number,
  lng: number,
  serviceCode?: string,
): Promise<SeoulCommercialApiResponse | null> {
  const apiKey = process.env.SEOUL_OPEN_DATA_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const [tmX, tmY] = proj4(WGS84, TM128, [lng, lat]);
    const servicePath = serviceCode ? `/${encodeURIComponent(serviceCode)}` : '';
    const url = `http://openapi.seoul.go.kr:8088/${encodeURIComponent(apiKey)}/json/TBGIS_BZ_CMR_CUST_SERVICE/1/5${servicePath}?X=${encodeURIComponent(String(tmX))}&Y=${encodeURIComponent(String(tmY))}`;

    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as SeoulCommercialApiResponse;
    const resultCode = json?.TBGIS_BZ_CMR_CUST_SERVICE?.RESULT?.CODE;
    if (!resultCode || resultCode !== 'INFO-000') {
      return null;
    }

    return json;
  } catch {
    return null;
  }
}

export async function getCommercialSales(
  lat: number,
  lng: number,
  industryCode?: string,
): Promise<CollectedCommercialData | null> {
  const apiKey = process.env.SEOUL_OPEN_DATA_API_KEY;
  if (!apiKey) {
    return { ...mockCommercialData(), source: 'mock', is_mock: true } as CollectedCommercialData & { is_mock: boolean };
  }

  const cacheKey = buildCacheKey({
    provider: 'seoul',
    endpoint: 'TBGIS_BZ_CMR_CUST_SERVICE',
    lat,
    lng,
    extra: { industryCode: industryCode ?? 'all' },
  });

  const { data } = await getOrFetch(cacheKey, 'seoul', TTL_SECONDS, async () => {
    const apiData = await getSeoulCommercialData(lat, lng, industryCode);
    if (!apiData) {
      return mockCommercialData();
    }

    const rows = apiData.TBGIS_BZ_CMR_CUST_SERVICE?.row ?? [];
    const totalShops = rows.length;
    const sameIndustryCount = industryCode
      ? rows.filter((row) => row.SVC_INDUTY_CD === industryCode).length
      : totalShops;

    const score = Math.min(100, Math.round((sameIndustryCount / Math.max(1, totalShops)) * 100));
    const level: CollectedCommercialData['competition_density']['level'] =
      score >= 75 ? '매우높음' : score >= 55 ? '높음' : score >= 30 ? '보통' : '낮음';

    const industryCountMap = new Map<string, number>();
    for (const row of rows) {
      const key = row.SVC_INDUTY_CD || '기타';
      industryCountMap.set(key, (industryCountMap.get(key) ?? 0) + 1);
    }

    const industryDistribution = Array.from(industryCountMap.entries()).map(([category, count]) => ({
      category,
      count,
      ratio: totalShops > 0 ? Math.round((count / totalShops) * 1000) / 10 : 0,
    }));

    return {
      commercial_area_type: rows[0]?.TRDAR_SE_CD_NM ?? '혼합상권',
      competition_density: {
        score,
        level,
        same_industry_count: sameIndustryCount,
        total_shop_count: totalShops,
      },
      industry_distribution: industryDistribution,
      total_shops: totalShops,
      source: 'seoul_open_data',
    } satisfies CollectedCommercialData;
  });

  return data;
}
