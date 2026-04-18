import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const updateProspectSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  phone: z
    .string()
    .regex(/^010-\d{4}-\d{4}$/)
    .optional()
    .or(z.literal(""))
    .nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  age_group: z.enum(["20대", "30대", "40대", "50대", "60대+"]).optional().nullable(),
  investment_budget: z.number().int().positive().optional().nullable(),
  experience: z.string().max(200).optional().nullable(),
  preferred_region: z.string().max(500).optional().nullable(),
  consultation_date: z.string().optional().nullable(),
  status: z
    .enum(["inquiry", "consulting", "report_requested", "contracted", "rejected"])
    .optional(),
  memo: z.string().max(2000).optional().nullable(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { data: prospect, error } = await supabase
      .from("prospects")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !prospect) {
      return NextResponse.json({ error: "예비 창업자를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ prospect });
  } catch (error) {
    console.error("[GET /api/prospects/[id]]", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const json = await request.json();
    const parsed = updateProspectSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "요청값이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const { data: prospect, error } = await supabase
      .from("prospects")
      .update(parsed.data)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !prospect) {
      console.error("[PUT /api/prospects/[id]]", error);
      return NextResponse.json(
        { error: error?.message ?? "예비 창업자를 찾을 수 없습니다." },
        { status: error ? 500 : 404 }
      );
    }

    return NextResponse.json({ prospect });
  } catch (error) {
    console.error("[PUT /api/prospects/[id]]", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { error } = await supabase
      .from("prospects")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("[DELETE /api/prospects/[id]]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/prospects/[id]]", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
