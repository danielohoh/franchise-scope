import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { StoreInfo, StoresResponse } from "@/types/recommend";

type StoreListApiItem = {
  bizesNm?: string;
  indsLclsNm?: string;
  indsMclsNm?: string;
  indsSclsNm?: string;
  lnoAdr?: string;
  rdnmAdr?: string;
  lon?: string;
  lat?: string;
};

type StoreListApiResponse = {
  body?: {
    totalCount?: number;
    items?: {
      item?: StoreListApiItem | StoreListApiItem[];
    };
  };
  // API 응답 포맷 편차 대응
  items?: {
    item?: StoreListApiItem | StoreListApiItem[];
  };
  totalCount?: number;
};

function toNullableString(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeItemArray<T>(item: T | T[] | undefined): T[] {
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

function parseNumberParam(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
  const lat = parseNumberParam(searchParams.get("lat"));
  const lng = parseNumberParam(searchParams.get("lng"));
  const radiusInput = parseNumberParam(searchParams.get("radius"));

  if (lat === null || lng === null) {
    return NextResponse.json({ error: "lat, lng 파라미터가 필요합니다." }, { status: 400 });
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "lat/lng 범위가 올바르지 않습니다." }, { status: 400 });
  }

  const radius = Math.max(1, Math.min(Math.round(radiusInput ?? 500), 500));

  const url = new URL("https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius");
  url.searchParams.set("ServiceKey", apiKey);
  url.searchParams.set("cx", String(lng));
  url.searchParams.set("cy", String(lat));
  url.searchParams.set("radius", String(radius));
  url.searchParams.set("numOfRows", "100");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("type", "json");

  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[data/stores] API HTTP error", response.status, text.slice(0, 200));
      return NextResponse.json({ error: "소상공인 상권정보 조회에 실패했습니다." }, { status: 502 });
    }

    const data = (await response.json()) as StoreListApiResponse;
    const rawItems = normalizeItemArray(data.body?.items?.item ?? data.items?.item);

    const stores: StoreInfo[] = rawItems.map((item) => ({
      bizesNm: toNullableString(item.bizesNm),
      indsLclsNm: toNullableString(item.indsLclsNm),
      indsMclsNm: toNullableString(item.indsMclsNm),
      indsSclsNm: toNullableString(item.indsSclsNm),
      lnoAdr: toNullableString(item.lnoAdr),
      rdnmAdr: toNullableString(item.rdnmAdr),
      lon: toNullableString(item.lon),
      lat: toNullableString(item.lat),
    }));

    const payload: StoresResponse = {
      stores,
      total: data.body?.totalCount ?? data.totalCount ?? stores.length,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[data/stores]", error);
    return NextResponse.json({ error: "소상공인 상권정보 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
