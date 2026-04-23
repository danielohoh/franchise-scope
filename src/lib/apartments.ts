import { createUntypedAdminClient } from "@/lib/supabase/untyped-admin";
import type { DbApartmentData, AptBasisInfoResponse, AptBasisInfo } from "@/types/recommend";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24시간

/**
 * 공공데이터 API에서 아파트 기본정보를 조회합니다.
 * DATA_GO_KR_API_KEY가 없으면 빈 배열을 반환합니다(graceful degradation).
 * apartment_data 테이블에 24시간 캐시합니다.
 */
export async function fetchApartmentsForRegion(
  regionCode: string,
): Promise<DbApartmentData[]> {
  const admin = createUntypedAdminClient();

  // 1. 캐시 확인 — updated_at 이 24시간 이내인 데이터
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

  // 3. 공공데이터 API 호출
  const url = new URL(
    "https://apis.data.go.kr/1613000/AptBasisInfoServiceV3/getAphusBassInfoV3",
  );
  url.searchParams.set("ServiceKey", apiKey);
  url.searchParams.set("bjdCode", regionCode);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "100");
  url.searchParams.set("_type", "json");

  let items: AptBasisInfo[] = [];

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[apartments] API 응답 오류:", res.status, res.statusText);
      return [];
    }

    const json = (await res.json()) as AptBasisInfoResponse;
    const body = json.response?.body;

    if (!body?.items?.item) {
      return [];
    }

    // item이 단일 객체 또는 배열일 수 있음
    items = Array.isArray(body.items.item)
      ? body.items.item
      : [body.items.item];
  } catch (error) {
    console.error("[apartments] API 호출 실패:", error);
    return [];
  }

  if (items.length === 0) return [];

  // 4. DB upsert
  const now = new Date().toISOString();
  const rows = items.map((item) => ({
    region_code: regionCode,
    complex_name: item.kaptName,
    total_households: item.kaptTotHo ? parseInt(item.kaptTotHo, 10) : null,
    dong_count: item.kaptDongCnt ? parseInt(item.kaptDongCnt, 10) : null,
    floor_max: null as number | null,
    built_year: item.kaptUseDate
      ? parseInt(item.kaptUseDate.substring(0, 4), 10)
      : null,
    address: item.kaptAddr ?? null,
    latitude: item.latitude ? parseFloat(item.latitude) : null,
    longitude: item.longitude ? parseFloat(item.longitude) : null,
    raw_data: item as unknown,
    updated_at: now,
  }));

  const { data: upserted, error: upsertError } = await admin
    .from("apartment_data")
    .upsert(rows, { onConflict: "region_code,complex_name" })
    .select("*");

  if (upsertError) {
    console.error("[apartments] upsert 실패:", upsertError);
    // upsert 실패 시에도 파싱된 데이터를 임시 반환
    return rows.map((r) => ({
      id: "",
      ...r,
      raw_data: r.raw_data,
    })) as DbApartmentData[];
  }

  return (upserted ?? []) as DbApartmentData[];
}
