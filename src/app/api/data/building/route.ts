import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type {
  BuildingFloorInfo,
  BuildingRecapInfo,
  BuildingResponse,
} from "@/types/recommend";

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

type ResolvedAddressCode = {
  sigunguCd: string;
  bjdongCd: string;
  bun: string;
  ji: string;
};

function normalizeItemArray<T>(item: T | T[] | undefined): T[] {
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

function toNullableString(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNullableNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function isNeighborhoodFacility(mainPurpsCdNm: string | null, etcPurps: string | null): boolean {
  const keywords = ["근린생활시설", "제1종근린생활시설", "제2종근린생활시설", "근린생활", "판매시설"];
  const combined = `${mainPurpsCdNm ?? ""} ${etcPurps ?? ""}`;
  return keywords.some((kw) => combined.includes(kw));
}

function parsePnuAddressCode(bCode: string, bunRaw: string, jiRaw: string): ResolvedAddressCode | null {
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

async function resolveCodesFromAddress(address: string): Promise<ResolvedAddressCode | null> {
  const kakaoKey = process.env.KAKAO_REST_API_KEY;
  if (!kakaoKey) return null;

  const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
  url.searchParams.set("query", address);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `KakaoAK ${kakaoKey}`,
      },
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

async function fetchRecap(
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

  if (!response.ok) {
    throw new Error(`Recap request failed: ${response.status}`);
  }

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

async function fetchFloors(
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

  if (!response.ok) {
    throw new Error(`Floor request failed: ${response.status}`);
  }

  const data = (await response.json()) as BuildingApiResponse;
  const items = normalizeItemArray(data.response?.body?.items?.item);

  return items.map((item) => ({
    flrNo: toNullableString(item.flrNo),
    flrArea: toNullableString(item.flrArea),
    mainPurpsCdNm: toNullableString(item.mainPurpsCdNm),
    etcPurps: toNullableString(item.etcPurps),
  }));
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const apiKey = process.env.DATA_GO_KR_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "DATA_GO_KR_API_KEY가 설정되지 않았습니다." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim();

  let sigunguCd = searchParams.get("sigunguCd")?.trim() ?? "";
  let bjdongCd = searchParams.get("bjdongCd")?.trim() ?? "";
  let bun = searchParams.get("bun")?.trim() ?? "";
  let ji = searchParams.get("ji")?.trim() ?? "";

  if (address) {
    const resolved = await resolveCodesFromAddress(address);
    if (!resolved) {
      return NextResponse.json({ error: "주소를 건축물대장 조회 코드로 변환하지 못했습니다." }, { status: 400 });
    }
    sigunguCd = resolved.sigunguCd;
    bjdongCd = resolved.bjdongCd;
    bun = resolved.bun;
    ji = resolved.ji;
  }

  if (!sigunguCd || !bjdongCd) {
    return NextResponse.json(
      { error: "sigunguCd, bjdongCd 파라미터가 필요합니다. (또는 address 제공)" },
      { status: 400 },
    );
  }

  if (!bun) bun = "0000";
  if (!ji) ji = "0000";

  try {
    const [recap, floors] = await Promise.all([
      fetchRecap(apiKey, sigunguCd, bjdongCd),
      fetchFloors(apiKey, sigunguCd, bjdongCd, bun, ji),
    ]);

    const payload: BuildingResponse = {
      recap,
      floors,
      isNeighborhoodFacility: isNeighborhoodFacility(recap?.mainPurpsCdNm ?? null, recap?.etcPurps ?? null),
      parkingCount: toNullableNumber(recap?.totPkngCnt ?? null),
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[data/building]", error);
    return NextResponse.json({ error: "건축물대장 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
