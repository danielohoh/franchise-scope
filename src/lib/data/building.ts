// ============================================
// 건축물대장 API 헬퍼 라이브러리
// api/data/building/route.ts 에서 추출 + getBrTitleInfo 추가
// ============================================

import type { BuildingFloorInfo, BuildingRecapInfo } from "@/types/recommend";
import type { BuildingInfoSection } from "@/types/analysis";

// ---- 내부 타입 ----

type BuildingApiItem = {
  bldNm?: string;
  mainPurpsCdNm?: string;
  etcPurps?: string;
  totArea?: string;
  totPkngCnt?: string;
  hhldCnt?: string;
  useAprDay?: string;
  platPlc?: string;
  newPlatPlc?: string;
  flrNo?: string;
  flrArea?: string;
  // getBrTitleInfo 응답 추가 필드
  grndFlrCnt?: string;  // 지상층수
  ugrndFlrCnt?: string; // 지하층수
  strctCdNm?: string;   // 구조코드명
};

type BuildingApiResponse = {
  response?: {
    body?: {
      items?: {
        item?: BuildingApiItem | BuildingApiItem[];
      };
    };
  };
};

export type ResolvedAddressCode = {
  sigunguCd: string;
  bjdongCd: string;
  bun: string;
  ji: string;
};

// ---- 유틸리티 ----

export function normalizeItemArray<T>(item: T | T[] | undefined): T[] {
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

export function toNullableString(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function toNullableNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBuiltYear(useAprDay: string | null): number | null {
  if (!useAprDay) return null;
  const match = useAprDay.match(/^(\d{4})/);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

function isNeighborhoodFacility(mainPurpsCdNm: string | null, etcPurps: string | null): boolean {
  const keywords = ["근린생활시설", "제1종근린생활시설", "제2종근린생활시설", "근린생활", "판매시설"];
  const combined = `${mainPurpsCdNm ?? ""} ${etcPurps ?? ""}`;
  return keywords.some((kw) => combined.includes(kw));
}

// ---- 주소 코드 해석 ----

export function parsePnuAddressCode(
  bCode: string,
  bunRaw: string,
  jiRaw: string,
): ResolvedAddressCode | null {
  const bCodeDigits = bCode.replace(/\D/g, "");
  if (bCodeDigits.length < 10) return null;

  const sigunguCd = bCodeDigits.slice(0, 5);
  const bjdongCd = bCodeDigits.slice(5, 10);

  const bunDigits = bunRaw.replace(/\D/g, "");
  const jiDigits = jiRaw.replace(/\D/g, "");

  const bun = (bunDigits.length > 0 ? bunDigits : "0").padStart(4, "0").slice(-4);
  const ji = (jiDigits.length > 0 ? jiDigits : "0").padStart(4, "0").slice(-4);

  return { sigunguCd, bjdongCd, bun, ji };
}

export async function resolveCodesFromAddress(address: string): Promise<ResolvedAddressCode | null> {
  const kakaoKey = process.env.KAKAO_REST_API_KEY;
  if (!kakaoKey) return null;

  const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
  url.searchParams.set("query", address);

  try {
    const response = await fetch(url.toString(), {
      headers: { Authorization: `KakaoAK ${kakaoKey}` },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      documents?: Array<{
        address?: {
          b_code?: string;
          main_address_no?: string;
          sub_address_no?: string;
        };
      }>;
    };

    const first = data.documents?.[0]?.address;
    if (!first?.b_code) return null;

    return parsePnuAddressCode(
      first.b_code,
      first.main_address_no ?? "0",
      first.sub_address_no ?? "0",
    );
  } catch {
    return null;
  }
}

// ---- 건축물대장 API 호출 ----

export async function fetchRecap(
  apiKey: string,
  sigunguCd: string,
  bjdongCd: string,
): Promise<BuildingRecapInfo | null> {
  const url = new URL("https://apis.data.go.kr/1613000/BldRgstHubService/getBrRecapTitleInfo");
  url.searchParams.set("ServiceKey", apiKey);
  url.searchParams.set("sigunguCd", sigunguCd);
  url.searchParams.set("bjdongCd", bjdongCd);
  url.searchParams.set("numOfRows", "10");
  url.searchParams.set("_type", "json");

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Recap request failed: ${response.status}`);

  const data = (await response.json()) as BuildingApiResponse;
  const item = normalizeItemArray(data.response?.body?.items?.item)[0];
  if (!item) return null;

  return {
    bldNm: toNullableString(item.bldNm),
    mainPurpsCdNm: toNullableString(item.mainPurpsCdNm),
    etcPurps: toNullableString(item.etcPurps),
    totArea: toNullableString(item.totArea),
    totPkngCnt: toNullableString(item.totPkngCnt),
    hhldCnt: toNullableString(item.hhldCnt),
    useAprDay: toNullableString(item.useAprDay),
    platPlc: toNullableString(item.platPlc),
    newPlatPlc: toNullableString(item.newPlatPlc),
  };
}

export async function fetchFloors(
  apiKey: string,
  sigunguCd: string,
  bjdongCd: string,
  bun: string,
  ji: string,
): Promise<BuildingFloorInfo[]> {
  const url = new URL("https://apis.data.go.kr/1613000/BldRgstHubService/getBrFlrOulnInfo");
  url.searchParams.set("ServiceKey", apiKey);
  url.searchParams.set("sigunguCd", sigunguCd);
  url.searchParams.set("bjdongCd", bjdongCd);
  url.searchParams.set("bun", bun);
  url.searchParams.set("ji", ji);
  url.searchParams.set("_type", "json");

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Floor request failed: ${response.status}`);

  const data = (await response.json()) as BuildingApiResponse;
  const items = normalizeItemArray(data.response?.body?.items?.item);

  return items.map((item) => ({
    flrNo: toNullableString(item.flrNo),
    flrArea: toNullableString(item.flrArea),
    mainPurpsCdNm: toNullableString(item.mainPurpsCdNm),
    etcPurps: toNullableString(item.etcPurps),
  }));
}

/**
 * 총괄표제부 조회 — 지상/지하층수, 구조코드명 포함
 * https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo
 */
export async function fetchTitle(
  apiKey: string,
  sigunguCd: string,
  bjdongCd: string,
  bun: string,
  ji: string,
): Promise<{ groundFloors: number | null; undergroundFloors: number | null } | null> {
  const url = new URL("https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo");
  url.searchParams.set("ServiceKey", apiKey);
  url.searchParams.set("sigunguCd", sigunguCd);
  url.searchParams.set("bjdongCd", bjdongCd);
  url.searchParams.set("bun", bun);
  url.searchParams.set("ji", ji);
  url.searchParams.set("numOfRows", "5");
  url.searchParams.set("_type", "json");

  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = (await response.json()) as BuildingApiResponse;
    const item = normalizeItemArray(data.response?.body?.items?.item)[0];
    if (!item) return null;

    return {
      groundFloors: toNullableNumber(toNullableString(item.grndFlrCnt)),
      undergroundFloors: toNullableNumber(toNullableString(item.ugrndFlrCnt)),
    };
  } catch {
    return null;
  }
}

/**
 * 주소로 건물 상세분석용 데이터를 조회합니다.
 * 총괄표제부 + 층별개요 + 총괄표제부(층수) 병렬 호출.
 * 실패 시 null 반환 (graceful degradation).
 */
export async function getBuildingByAddress(
  address: string,
  areaSupply?: number | null,
  areaExclusive?: number | null,
): Promise<BuildingInfoSection | null> {
  const apiKey = process.env.DATA_GO_KR_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[building] DATA_GO_KR_API_KEY가 설정되지 않았습니다.");
    return null;
  }

  const codes = await resolveCodesFromAddress(address);
  if (!codes) {
    console.warn("[building] 주소 코드 변환 실패:", address);
    return null;
  }

  const { sigunguCd, bjdongCd, bun, ji } = codes;

  try {
    const [recap, floors, title] = await Promise.all([
      fetchRecap(apiKey, sigunguCd, bjdongCd),
      fetchFloors(apiKey, sigunguCd, bjdongCd, bun, ji),
      fetchTitle(apiKey, sigunguCd, bjdongCd, bun, ji),
    ]);

    const builtYear = parseBuiltYear(recap?.useAprDay ?? null);
    const parkingCount = toNullableNumber(recap?.totPkngCnt ?? null);
    const totalArea = toNullableNumber(recap?.totArea ?? null);

    let exclusiveRatio: number | null = null;
    if (areaSupply != null && areaExclusive != null && areaSupply > 0) {
      exclusiveRatio = Math.round((areaExclusive / areaSupply) * 100 * 10) / 10;
    }

    return {
      buildingName: recap?.bldNm ?? null,
      mainPurpose: recap?.mainPurpsCdNm ?? null,
      etcPurpose: recap?.etcPurps ?? null,
      totalArea,
      parkingCount,
      isNeighborhoodFacility: isNeighborhoodFacility(
        recap?.mainPurpsCdNm ?? null,
        recap?.etcPurps ?? null,
      ),
      floors,
      builtYear,
      groundFloors: title?.groundFloors ?? null,
      undergroundFloors: title?.undergroundFloors ?? null,
      exclusiveRatio,
    };
  } catch (error) {
    console.error("[building] 건축물대장 조회 실패:", error);
    return null;
  }
}
