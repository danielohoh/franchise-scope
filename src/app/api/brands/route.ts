import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { Database, Industry, PriceTier, RoyaltyType } from "@/types/database";

type BrandRow = Database["public"]["Tables"]["brands"]["Row"];

type ApiError = {
  message: string;
};

type BrandsGetResponse = {
  brand: BrandRow | null;
};

type BrandsUpsertResponse = {
  brand: BrandRow;
};

const industryValues: ReadonlyArray<Industry> = ["외식", "도소매", "서비스"];
const priceTierValues: ReadonlyArray<PriceTier> = ["저가", "중가", "프리미엄"];
const royaltyTypeValues: ReadonlyArray<RoyaltyType> = ["fixed", "rate", "none"];

const industrySchema = z.enum(industryValues);
const priceTierSchema = z.enum(priceTierValues);
const royaltyTypeSchema = z.enum(royaltyTypeValues);

const nullableTrimmedString = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

const nullableNonNegativeInt = z
  .number()
  .int()
  .min(0)
  .nullable()
  .optional();

const nullablePercent = z
  .number()
  .min(0)
  .max(100)
  .nullable()
  .optional();

const brandUpsertSchema = z.object({
  brand_name: z.string().trim().min(1).max(200),
  company_name: z.string().trim().min(1).max(200),
  representative: nullableTrimmedString,
  business_number: nullableTrimmedString,
  address: nullableTrimmedString,
  phone: nullableTrimmedString,
  industry: industrySchema,
  sub_industry: nullableTrimmedString,
  category: nullableTrimmedString,
  price_tier: priceTierSchema.nullable().optional(),
  avg_store_size_pyeong: z.number().min(0).max(999.9).nullable().optional(),

  franchise_fee: nullableNonNegativeInt,
  education_fee: nullableNonNegativeInt,
  deposit: nullableNonNegativeInt,

  royalty_type: royaltyTypeSchema.nullable().optional(),
  royalty_amount: nullableNonNegativeInt,

  interior_cost_per_pyeong: nullableNonNegativeInt,
  equipment_cost: nullableNonNegativeInt,
  initial_supplies_cost: nullableNonNegativeInt,
  signage_cost: nullableNonNegativeInt,
  other_cost: nullableNonNegativeInt,

  royalty_rate: nullablePercent,
  ad_contribution_rate: nullablePercent,
  supply_cost_rate: nullablePercent,

  avg_ticket_price: z.number().int().min(0).nullable().optional(),
  avg_monthly_revenue: nullableNonNegativeInt,

  min_store_requirement: nullableTrimmedString,
  target_customer: nullableTrimmedString,
  delivery_ratio: nullablePercent,
  peak_hours: nullableTrimmedString,

  total_stores: z.number().int().min(0).nullable().optional(),
  avg_close_rate: nullablePercent,
  notes: nullableTrimmedString,

  standard_size_min: z.number().min(0).max(9999).nullable().optional(),
  standard_size_max: z.number().min(0).max(9999).nullable().optional(),
  standard_staff_count: nullableNonNegativeInt,
  territory_protection_meters: nullableNonNegativeInt,
  contract_period_years: nullableNonNegativeInt,
});

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[brands GET] auth.getUser failed", authError);
    return NextResponse.json<ApiError>({ message: "로그인 상태를 확인할 수 없습니다." }, { status: 401 });
  }

  if (!user) {
    return NextResponse.json<ApiError>({ message: "인증된 사용자가 아닙니다." }, { status: 401 });
  }

  const { data: brand, error } = await supabase
    .from("brands")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[brands GET] select failed", error);
    return NextResponse.json<ApiError>({ message: "브랜드 정보를 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json<BrandsGetResponse>({ brand }, { status: 200 });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[brands POST] auth.getUser failed", authError);
    return NextResponse.json<ApiError>({ message: "로그인 상태를 확인할 수 없습니다." }, { status: 401 });
  }

  if (!user) {
    return NextResponse.json<ApiError>({ message: "인증된 사용자가 아닙니다." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch (error) {
    console.error("[brands POST] invalid json", error);
    return NextResponse.json<ApiError>({ message: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const parsed = brandUpsertSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "요청값이 올바르지 않습니다.";
    return NextResponse.json<ApiError>(
      { message },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();

  const payload: Database["public"]["Tables"]["brands"]["Insert"] = {
    ...parsed.data,
    id: crypto.randomUUID(),
    user_id: user.id,
    created_at: now,
    updated_at: now,
  };

  const { data: brand, error } = await supabase
    .from("brands")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error("[brands POST] insert failed", error);
    return NextResponse.json<ApiError>({ message: "브랜드 정보를 저장하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json<BrandsUpsertResponse>({ brand }, { status: 201 });
}
