import 'server-only';

import { buildCacheKey, getOrFetch } from '@/lib/cache/public-data-cache';
import type { CollectedPopulationData, PopulationRadius } from '@/types/analysis';

// ============================================================================
// SGIS OpenAPI Client — 통계지리정보서비스
// Base: https://sgisapi.mods.go.kr/OpenAPI3
// ============================================================================

const SGIS_BASE = 'https://sgisapi.mods.go.kr/OpenAPI3';

// ── SGIS Response Types ─────────────────────────────────────────────────────

type SgisBaseResponse<T> = {
  id: string;
  result: T;
  errMsg: string;
  errCd: number;
  trId: string;
};

type SgisAuthResult = {
  accessToken: string;
  accessTimeout: string; // Unix epoch seconds
};

type SgisReverseGeocodeResult = {
  sido_nm: string;
  sido_cd: string;
  sgg_nm: string;
  sgg_cd: string;
  emdong_nm?: string;
  emdong_cd?: string;
  adm_dr_cd?: string;
  full_addr: string;
};

type SgisPopulationItem = {
  adm_cd: string;
  adm_nm: string;
  population: number;
};

type SgisHouseholdItem = {
  adm_cd: string;
  adm_nm: string;
  household_cnt: string; // string in response
  family_member_cnt: number;
  avg_family_member_cnt: string;
};

type SgisCompanyItem = {
  adm_cd: string;
  adm_nm: string;
  corp_cnt: string;   // string in response
  tot_worker: string; // string in response
};

// ── Auth Token Cache (in-memory, 3.5h TTL) ──────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const consumerKey = process.env.SGIS_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.SGIS_CONSUMER_SECRET?.trim();
  if (!consumerKey || !consumerSecret) {
    throw new Error('SGIS credentials not configured');
  }

  // Return cached token if still valid (with 30-min safety margin)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30 * 60 * 1000) {
    return cachedToken.token;
  }

  const url = `${SGIS_BASE}/auth/authentication.json?consumer_key=${consumerKey}&consumer_secret=${consumerSecret}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8_000), cache: 'no-store' });
  if (!res.ok) throw new Error(`SGIS auth HTTP ${res.status}`);

  const json = (await res.json()) as SgisBaseResponse<SgisAuthResult>;
  if (json.errCd !== 0) throw new Error(`SGIS auth error: ${json.errMsg}`);

  const token = json.result.accessToken;
  // accessTimeout is Unix epoch seconds
  const expiresAt = Number(json.result.accessTimeout) * 1000;

  cachedToken = { token, expiresAt };
  return token;
}

// ── Reverse Geocode (WGS84 → 행정동코드) ────────────────────────────────────

async function reverseGeocode(
  token: string,
  lat: number,
  lng: number,
): Promise<SgisReverseGeocodeResult | null> {
  try {
    const url = new URL(`${SGIS_BASE}/addr/rgeocodewgs84.json`);
    url.searchParams.set('accessToken', token);
    url.searchParams.set('x_coor', String(lng));
    url.searchParams.set('y_coor', String(lat));
    // addr_type=21 returns adm_dr_cd (8-digit administrative dong code)
    // which is directly usable as stats adm_cd.
    url.searchParams.set('addr_type', '21');

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6_000), cache: 'no-store' });
    if (!res.ok) return null;

    const json = (await res.json()) as SgisBaseResponse<SgisReverseGeocodeResult | SgisReverseGeocodeResult[]>;
    if (json.errCd !== 0) return null;

    if (Array.isArray(json.result)) {
      return json.result[0] ?? null;
    }
    return json.result;
  } catch {
    return null;
  }
}

// ── Stats Fetchers ──────────────────────────────────────────────────────────

function statsYear(): string {
  // SGIS currently supports up to 2024 for population/household in production.
  return '2024';
}

function companyYear(): string {
  // Company statistics usually lag more than resident population.
  return '2023';
}

async function fetchPopulation(
  token: string,
  admCd: string,
  gender?: 0 | 1 | 2,
): Promise<SgisPopulationItem[]> {
  try {
    const url = new URL(`${SGIS_BASE}/stats/searchpopulation.json`);
    url.searchParams.set('accessToken', token);
    url.searchParams.set('year', statsYear());
    url.searchParams.set('adm_cd', admCd);
    url.searchParams.set('low_search', '0');
    if (gender !== undefined) url.searchParams.set('gender', String(gender));

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6_000), cache: 'no-store' });
    if (!res.ok) return [];

    const json = (await res.json()) as SgisBaseResponse<SgisPopulationItem[]>;
    if (json.errCd !== 0 || !Array.isArray(json.result)) return [];
    return json.result;
  } catch {
    return [];
  }
}

async function fetchHousehold(
  token: string,
  admCd: string,
): Promise<SgisHouseholdItem[]> {
  try {
    const url = new URL(`${SGIS_BASE}/stats/household.json`);
    url.searchParams.set('accessToken', token);
    url.searchParams.set('year', statsYear());
    url.searchParams.set('adm_cd', admCd);
    url.searchParams.set('low_search', '0');

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6_000), cache: 'no-store' });
    if (!res.ok) return [];

    const json = (await res.json()) as SgisBaseResponse<SgisHouseholdItem[]>;
    if (json.errCd !== 0 || !Array.isArray(json.result)) return [];
    return json.result;
  } catch {
    return [];
  }
}

async function fetchCompany(
  token: string,
  admCd: string,
): Promise<SgisCompanyItem[]> {
  try {
    const url = new URL(`${SGIS_BASE}/stats/company.json`);
    url.searchParams.set('accessToken', token);
    url.searchParams.set('year', companyYear());
    url.searchParams.set('adm_cd', admCd);
    url.searchParams.set('low_search', '0');

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6_000), cache: 'no-store' });
    if (!res.ok) return [];

    const json = (await res.json()) as SgisBaseResponse<SgisCompanyItem[]>;
    if (json.errCd !== 0 || !Array.isArray(json.result)) return [];
    return json.result;
  } catch {
    return [];
  }
}

// ── Radius Sampling ─────────────────────────────────────────────────────────

type SamplePoint = { lat: number; lng: number; maxRadiusM: number };

/** 1 degree latitude ≈ 111,320m at all latitudes */
const METER_PER_DEG_LAT = 111_320;

function meterPerDegLng(lat: number): number {
  return 111_320 * Math.cos((lat * Math.PI) / 180);
}

function offsetPoint(lat: number, lng: number, dxM: number, dyM: number): { lat: number; lng: number } {
  return {
    lat: lat + dyM / METER_PER_DEG_LAT,
    lng: lng + dxM / meterPerDegLng(lat),
  };
}

/**
 * Generate sample points for radius-based aggregation.
 * - 500m: center only
 * - 1km: center + 4 cardinal at 700m
 * - 2km: all above + 4 cardinal at 1500m + 4 diagonal at 1400m
 */
function generateSamplePoints(lat: number, lng: number): SamplePoint[] {
  const points: SamplePoint[] = [
    { lat, lng, maxRadiusM: 500 }, // center → in all radii
  ];

  // 4 cardinal directions at 700m → within 1km radius
  const cardinalDist = 700;
  const cardinals: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  for (const [dx, dy] of cardinals) {
    const p = offsetPoint(lat, lng, dx * cardinalDist, dy * cardinalDist);
    points.push({ ...p, maxRadiusM: 1000 });
  }

  // 4 cardinal at 1500m + 4 diagonal at 1400m → within 2km radius
  const farCardinalDist = 1500;
  for (const [dx, dy] of cardinals) {
    const p = offsetPoint(lat, lng, dx * farCardinalDist, dy * farCardinalDist);
    points.push({ ...p, maxRadiusM: 2000 });
  }

  const diagonalDist = 1400;
  const diag = 0.707; // sin(45°) ≈ cos(45°)
  const diagonals: [number, number][] = [[diag, diag], [diag, -diag], [-diag, diag], [-diag, -diag]];
  for (const [dx, dy] of diagonals) {
    const p = offsetPoint(lat, lng, dx * diagonalDist, dy * diagonalDist);
    points.push({ ...p, maxRadiusM: 2000 });
  }

  return points;
}

// ── District Stats Aggregation ──────────────────────────────────────────────

type DistrictStats = {
  admCd: string;
  admNm: string;
  population: number;
  households: number;
  workers: number;
  /** Which radius buckets this district belongs to */
  inRadius: Set<500 | 1000 | 2000>;
};

async function collectDistrictStats(
  token: string,
  lat: number,
  lng: number,
): Promise<DistrictStats[]> {
  const samplePoints = generateSamplePoints(lat, lng);

  // Step 1: Reverse geocode all sample points in parallel
  const geocodeResults = await Promise.all(
    samplePoints.map(async (p) => {
      const result = await reverseGeocode(token, p.lat, p.lng);
      return { point: p, result };
    }),
  );

  // Step 2: Group by unique district code, track which radii each belongs to
  const districtMap = new Map<string, { admNm: string; inRadius: Set<500 | 1000 | 2000> }>();

  for (const { point, result } of geocodeResults) {
    const admCd = result?.adm_dr_cd;
    if (!admCd) continue;

    const existing = districtMap.get(admCd);
    if (existing) {
      // This district is reachable from a smaller radius too
      if (point.maxRadiusM <= 500) existing.inRadius.add(500);
      if (point.maxRadiusM <= 1000) existing.inRadius.add(1000);
      existing.inRadius.add(2000);
    } else {
      const radii = new Set<500 | 1000 | 2000>();
      if (point.maxRadiusM <= 500) radii.add(500);
      if (point.maxRadiusM <= 1000) radii.add(1000);
      radii.add(2000); // always in 2km
      districtMap.set(admCd, { admNm: result.emdong_nm ?? admCd, inRadius: radii });
    }
  }

  if (districtMap.size === 0) return [];

  // Step 3: Fetch stats for each unique district in parallel
  const admCds = [...districtMap.keys()];
  const [popResults, householdResults, companyResults] = await Promise.all([
    Promise.all(admCds.map((cd) => fetchPopulation(token, cd))),
    Promise.all(admCds.map((cd) => fetchHousehold(token, cd))),
    Promise.all(admCds.map((cd) => fetchCompany(token, cd))),
  ]);

  // Step 4: Assemble per-district stats
  const districts: DistrictStats[] = admCds.map((admCd, i) => {
    const meta = districtMap.get(admCd)!;
    const pop = Number(popResults[i]?.[0]?.population) || 0;
    const hh = Number(householdResults[i]?.[0]?.household_cnt) || 0;
    const workers = Number(companyResults[i]?.[0]?.tot_worker) || 0;

    return {
      admCd,
      admNm: meta.admNm,
      population: pop,
      households: hh,
      workers,
      inRadius: meta.inRadius,
    };
  });

  return districts;
}

function sumByRadius(districts: DistrictStats[], radius: 500 | 1000 | 2000): PopulationRadius {
  let residential = 0;
  let households = 0;
  let workers = 0;

  for (const d of districts) {
    if (d.inRadius.has(radius)) {
      residential += d.population;
      households += d.households;
      workers += d.workers;
    }
  }

  return { residential, households, workers };
}

// ── Gender Ratio ────────────────────────────────────────────────────────────

async function fetchGenderRatio(token: string, admCd: string): Promise<string> {
  const [maleResult, femaleResult] = await Promise.all([
    fetchPopulation(token, admCd, 1),
    fetchPopulation(token, admCd, 2),
  ]);

  const male = Number(maleResult[0]?.population) || 0;
  const female = Number(femaleResult[0]?.population) || 0;
  const total = male + female;

  if (total === 0) return '남 50% / 여 50%';

  const malePct = Math.round((male / total) * 100);
  const femalePct = 100 - malePct;
  return `남 ${malePct}% / 여 ${femalePct}%`;
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Check whether SGIS credentials are configured */
export function isSgisConfigured(): boolean {
  return !!(process.env.SGIS_CONSUMER_KEY?.trim() && process.env.SGIS_CONSUMER_SECRET?.trim());
}

/**
 * Fetch real population/household/worker statistics from SGIS OpenAPI.
 * Uses radius-based sampling: center + surrounding sample points →
 * reverse geocode to district codes → fetch & aggregate stats.
 */
export async function getSgisPopulationData(
  lat: number,
  lng: number,
): Promise<CollectedPopulationData> {
  const cacheKey = buildCacheKey({
    provider: 'sgis',
    endpoint: 'population-aggregate',
    lat,
    lng,
  });

  const { data } = await getOrFetch<CollectedPopulationData>(
    cacheKey,
    'sgis',
    // Cache for 12 hours — census data is annual, no need to refresh often
    12 * 60 * 60,
    async () => {
      const token = await getAccessToken();

      // Get center district for gender ratio
      const centerGeo = await reverseGeocode(token, lat, lng);
      const centerAdmCd = centerGeo?.adm_dr_cd;

      // Run district aggregation and gender ratio in parallel
      const [districts, genderRatio] = await Promise.all([
        collectDistrictStats(token, lat, lng),
        centerAdmCd ? fetchGenderRatio(token, centerAdmCd) : Promise.resolve('남 50% / 여 50%'),
      ]);

      const radius500m = sumByRadius(districts, 500);
      const radius1km = sumByRadius(districts, 1000);
      const radius2km = sumByRadius(districts, 2000);

      return {
        radius_500m: radius500m,
        radius_1km: radius1km,
        radius_2km: radius2km,
        core_age_group: '30~50대', // SGIS age breakdown requires many additional calls; keep estimate
        gender_ratio: genderRatio,
        commercial_area_type: '', // Filled by population.ts caller
        hourly_traffic: {
          morning: { weekday: 0, weekend: 0 },
          lunch: { weekday: 0, weekend: 0 },
          afternoon: { weekday: 0, weekend: 0 },
          evening: { weekday: 0, weekend: 0 },
          night: { weekday: 0, weekend: 0 },
        },
        is_mock: false,
        source: 'sgis_openapi',
      };
    },
  );

  return data;
}
