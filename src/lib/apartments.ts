import { createUntypedAdminClient } from "@/lib/supabase/untyped-admin";
import type {
  AptBasisInfoResponse,
  AptListItem,
  AptListResponse,
  DbApartmentData,
} from "@/types/recommend";

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30일

type AptDetailItem = {
  kaptCode: string;
  kaptName: string;
  kaptAddr: string | null;
  kaptdaCnt: string | null; // 세대수
  kaptPkngCnt: string | null; // 주차수
  kaptDongCnt: string | null;
  kaptUseDate: string | null;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeItemArray<T>(item: T | T[] | undefined): T[] {
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

function toNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBuiltYear(useDate: string | null | undefined): number | null {
  if (!useDate) return null;
  const match = useDate.match(/^(\d{4})/);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

// 카카오 지오코딩 (주소 → 위경도)
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const kakaoKey = process.env.KAKAO_REST_API_KEY;
  if (!kakaoKey) return null;

  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
      {
        headers: { Authorization: `KakaoAK ${kakaoKey}` },
        signal: AbortSignal.timeout(5_000),
        cache: "no-store",
      },
    );

    if (!res.ok) return null;

    const data = (await res.json()) as {
      documents?: Array<{ x: string; y: string }>;
    };

    const doc = data.documents?.[0];
    if (!doc) return null;

    const lat = Number.parseFloat(doc.y);
    const lng = Number.parseFloat(doc.x);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
  } catch {
    return null;
  }
}

async function fetchAptList(regionCode: string, apiKey: string): Promise<AptListItem[]> {
  const url = new URL("https://apis.data.go.kr/1613000/AptBasisInfoServiceV3/getLegaldongAptList");
  url.searchParams.set("ServiceKey", apiKey);
  url.searchParams.set("bjdCode", regionCode);
  url.searchParams.set("numOfRows", "500");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("_type", "json");

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Apt list request failed: ${response.status}`);
  }

  const json = (await response.json()) as AptListResponse;
  return normalizeItemArray(json.response?.body?.items?.item);
}

async function fetchAptDetail(kaptCode: string, apiKey: string): Promise<AptDetailItem | null> {
  const url = new URL("https://apis.data.go.kr/1613000/AptBasisInfoServiceV3/getAphusBassInfoV3");
  url.searchParams.set("ServiceKey", apiKey);
  url.searchParams.set("kaptCode", kaptCode);
  url.searchParams.set("_type", "json");

  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("[apartments] 상세 API 오류", response.status, kaptCode);
      return null;
    }

    const json = (await response.json()) as AptBasisInfoResponse;
    const item = normalizeItemArray(json.response?.body?.items?.item)[0];
    if (!item) return null;

    return {
      kaptCode: item.kaptCode,
      kaptName: item.kaptName,
      kaptAddr: item.kaptAddr ?? null,
      kaptdaCnt: item.kaptdaCnt ?? null,
      kaptPkngCnt: item.kaptPkngCnt ?? null,
      kaptDongCnt: item.kaptDongCnt ?? null,
      kaptUseDate: item.kaptUseDate ?? null,
    };
  } catch (error) {
    console.warn("[apartments] 상세 API 호출 실패", kaptCode, error);
    return null;
  }
}

/**
 * 공공데이터 API에서 아파트 기본정보를 조회합니다.
 * DATA_GO_KR_API_KEY가 없으면 빈 배열을 반환합니다(graceful degradation).
 * apartment_data 테이블에 24시간 캐시합니다.
 */
export async function fetchApartmentsForRegion(
  regionCode: string,
): Promise<DbApartmentData[]> {
  const admin = createUntypedAdminClient();

  // 1. DB 캐시 확인 (30일)
  const cutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString();
  const { data: cached, error: cacheError } = await admin
    .from("apartment_data")
    .select("*")
    .eq("region_code", regionCode)
    .gte("updated_at", cutoff);

  if (!cacheError && cached && cached.length > 0) {
    return cached as DbApartmentData[];
  }

  // 2. API 키 확인
  const apiKey = process.env.DATA_GO_KR_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[apartments] DATA_GO_KR_API_KEY가 설정되지 않았습니다. 빈 배열을 반환합니다.");
    return [];
  }

  let aptList: AptListItem[] = [];

  try {
    // 3. 1단계: getLegaldongAptList
    aptList = await fetchAptList(regionCode, apiKey);
  } catch (error) {
    console.error("[apartments] 단지 목록 API 호출 실패:", error);
    return [];
  }

  if (aptList.length === 0) {
    return [];
  }

  // 4. 2단계: 각 kaptCode로 상세 조회 (rate limit 완화)
  const detailMap = new Map<string, AptDetailItem>();
  for (const apt of aptList) {
    const detail = await fetchAptDetail(apt.kaptCode, apiKey);
    if (detail) {
      detailMap.set(apt.kaptCode, detail);
    }
    await delay(200);
  }

  // 5. 단지 주소 기반 카카오 지오코딩 + DB row 매핑
  const now = new Date().toISOString();
  const rows: Omit<DbApartmentData, "id">[] = [];

  for (const apt of aptList) {
    const detail = detailMap.get(apt.kaptCode);
    const address = detail?.kaptAddr ?? null;

    const geo = address ? await geocodeAddress(address) : null;
    if (address) {
      await delay(120);
    }

    rows.push({
      region_code: regionCode,
      complex_name: detail?.kaptName ?? apt.kaptName,
      total_households: toNumber(detail?.kaptdaCnt),
      dong_count: toNumber(detail?.kaptDongCnt),
      floor_max: null,
      built_year: parseBuiltYear(detail?.kaptUseDate),
      address,
      latitude: geo?.lat ?? null,
      longitude: geo?.lng ?? null,
      raw_data: {
        list: apt,
        detail,
        parking_count: toNumber(detail?.kaptPkngCnt),
      },
      updated_at: now,
    });
  }

  // 6. DB delete + insert (region_code 기준)
  const { error: deleteError } = await admin
    .from("apartment_data")
    .delete()
    .eq("region_code", regionCode);

  if (deleteError) {
    console.error("[apartments] 기존 캐시 삭제 실패:", deleteError);
  }

  const { data: inserted, error: insertError } = await admin
    .from("apartment_data")
    .insert(rows)
    .select("*");

  if (insertError) {
    console.error("[apartments] insert 실패:", insertError);
    return rows.map((r) => ({
      id: "",
      ...r,
      raw_data: r.raw_data,
    })) as DbApartmentData[];
  }

  return (inserted ?? []) as DbApartmentData[];
}
