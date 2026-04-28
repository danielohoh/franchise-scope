import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { Database, Industry } from "@/types/database";

type BrandRow = Database["public"]["Tables"]["brands"]["Row"];

type ApiError = {
  message: string;
};

type BrandsUpsertResponse = {
  brand: BrandRow;
};

type BrandsDeleteResponse = {
  success: true;
};

const industryValues: ReadonlyArray<Industry> = ["외식", "도소매", "서비스"];

const industrySchema = z.enum(industryValues);

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
  industry: industrySchema,
  sub_industry: nullableTrimmedString,
  avg_store_size_pyeong: z.number().min(0).max(999.9).nullable().optional(),

  franchise_fee: nullableNonNegativeInt,
  education_fee: nullableNonNegativeInt,
  deposit: nullableNonNegativeInt,

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
});

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[brands PUT] auth.getUser failed", authError);
    return NextResponse.json<ApiError>({ message: "로그인 상태를 확인할 수 없습니다." }, { status: 401 });
  }

  if (!user) {
    return NextResponse.json<ApiError>({ message: "인증된 사용자가 아닙니다." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch (error) {
    console.error("[brands PUT] invalid json", error);
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
  const payload: Database["public"]["Tables"]["brands"]["Update"] = {
    ...parsed.data,
    updated_at: now,
  };

  const { data: brand, error } = await supabase
    .from("brands")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    console.error("[brands PUT] update failed", error);
    return NextResponse.json<ApiError>({ message: "브랜드 정보를 수정하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json<BrandsUpsertResponse>({ brand }, { status: 200 });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[brands DELETE] auth.getUser failed", authError);
    return NextResponse.json<ApiError>({ message: "로그인 상태를 확인할 수 없습니다." }, { status: 401 });
  }

  if (!user) {
    return NextResponse.json<ApiError>({ message: "인증된 사용자가 아닙니다." }, { status: 401 });
  }

  const { error } = await supabase.from("brands").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    console.error("[brands DELETE] delete failed", error);
    return NextResponse.json<ApiError>({ message: "브랜드 정보를 삭제하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json<BrandsDeleteResponse>({ success: true }, { status: 200 });
}
