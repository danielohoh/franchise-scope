import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { ProspectStatus } from "@/types/database";

const createProspectSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요.").max(100),
  phone: z
    .string()
    .regex(/^010-\d{4}-\d{4}$/, "010-XXXX-XXXX 형식으로 입력해 주세요.")
    .optional()
    .nullable()
    .or(z.literal("")),
  email: z
    .string()
    .email("이메일 형식이 올바르지 않습니다.")
    .optional()
    .nullable()
    .or(z.literal("")),
  age_group: z
    .enum(["20대", "30대", "40대", "50대", "60대+"])
    .optional()
    .nullable(),
  investment_budget: z.number().int().positive().optional().nullable(),
  experience: z.string().max(200).optional().nullable(),
  preferred_region: z.string().max(500).optional().nullable(),
  consultation_date: z.string().optional().nullable(),
  status: z
    .enum(["inquiry", "consulting", "report_requested", "contracted", "rejected"])
    .default("inquiry"),
  memo: z.string().max(2000).optional().nullable(),
  brand_id: z.string().uuid().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as ProspectStatus | null;
    const search = searchParams.get("search") ?? "";
    const sort = searchParams.get("sort") ?? "created_at_desc";

    let query = supabase
      .from("prospects")
      .select("*")
      .eq("user_id", user.id);

    if (status) query = query.eq("status", status);
    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    // 정렬
    if (sort === "name_asc") {
      query = query.order("name", { ascending: true });
    } else if (sort === "status_asc") {
      query = query.order("status", { ascending: true });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const { data: prospects, error } = await query;

    if (error) {
      console.error("[GET /api/prospects]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ prospects: prospects ?? [] });
  } catch (error) {
    console.error("[GET /api/prospects] Unexpected error", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const json = await request.json();
    const parsed = createProspectSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "요청값이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const { data: prospect, error } = await supabase
      .from("prospects")
      .insert({
        user_id: user.id,
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        age_group: parsed.data.age_group ?? null,
        investment_budget: parsed.data.investment_budget ?? null,
        experience: parsed.data.experience ?? null,
        preferred_region: parsed.data.preferred_region ?? null,
        consultation_date: parsed.data.consultation_date ?? null,
        status: parsed.data.status,
        memo: parsed.data.memo ?? null,
        brand_id: parsed.data.brand_id ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error("[POST /api/prospects]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ prospect }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/prospects] Unexpected error", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
