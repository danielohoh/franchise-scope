import { NextResponse } from "next/server";
import { z } from "zod";

import { createUntypedAdminClient } from "@/lib/supabase/untyped-admin";
import { getAuthUser } from "@/lib/supabase/auth-bearer";
import type { CollectListingsResponse } from "@/types/recommend";
import type { DbNaverListingInsert } from "@/types/database";

const NaverListingInputSchema = z.object({
  article_id: z.string().min(1),
  region_code: z.string().min(1),
  region_name: z.string().optional(),
  trade_type: z.string().min(1),
  article_name: z.string().optional(),
  building_name: z.string().optional(),
  detail_address: z.string().optional(),
  floor_info: z.string().optional(),
  area_supply: z.number().nullable().optional(),
  area_exclusive: z.number().nullable().optional(),
  deposit: z.number().nullable().optional(),
  monthly_rent: z.number().nullable().optional(),
  sale_price: z.number().nullable().optional(),
  maintenance_cost: z.number().nullable().optional(),
  building_use: z.string().optional(),
  parking_available: z.boolean().default(false),
  parking_count: z.number().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  image_url: z.string().optional(),
  naver_url: z.string().optional(),
  raw_data: z.unknown().optional(),
});

const CollectSchema = z.object({
  listings: z.array(NaverListingInputSchema).min(1).max(500),
  regionCode: z.string().min(1),
});

export async function POST(request: Request) {
  // Bearer 토큰(익스텐션) 또는 쿠키 세션(웹앱) 이중 인증
  const { user, error: authError } = await getAuthUser(request);

  if (authError || !user) {
    return NextResponse.json(
      { error: authError ?? "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 본문이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const parsed = CollectSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "요청값이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { listings, regionCode } = parsed.data;
  const admin = createUntypedAdminClient();

  const rows: DbNaverListingInsert[] = listings.map((item) => ({
    user_id: user.id,
    article_id: item.article_id,
    region_code: regionCode,
    region_name: item.region_name ?? null,
    trade_type: item.trade_type,
    article_name: item.article_name ?? null,
    building_name: item.building_name ?? null,
    detail_address: item.detail_address ?? null,
    floor_info: item.floor_info ?? null,
    area_supply: item.area_supply ?? null,
    area_exclusive: item.area_exclusive ?? null,
    deposit: item.deposit ?? null,
    monthly_rent: item.monthly_rent ?? null,
    sale_price: item.sale_price ?? null,
    maintenance_cost: item.maintenance_cost ?? null,
    building_use: item.building_use ?? null,
    parking_available: item.parking_available,
    parking_count: item.parking_count ?? null,
    latitude: item.latitude ?? null,
    longitude: item.longitude ?? null,
    image_url: item.image_url ?? null,
    naver_url: item.naver_url ?? null,
    raw_data: item.raw_data,
  }));

  try {
    const { data, error } = await admin
      .from("naver_listings")
      .upsert(rows, { onConflict: "user_id,article_id" })
      .select("id");

    if (error) {
      console.error("[listings/collect]", error);
      return NextResponse.json(
        { error: "매물 저장 중 오류가 발생했습니다." },
        { status: 500 },
      );
    }

    const collected = data?.length ?? 0;
    const skipped = listings.length - collected;

    return NextResponse.json<CollectListingsResponse>(
      { collected, skipped },
      { status: 200 },
    );
  } catch (error) {
    console.error("[listings/collect]", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
