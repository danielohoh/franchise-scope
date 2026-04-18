import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from("users")
      .select("name, company_name, phone")
      .eq("id", user.id)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: "프로필을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ user: profile });
  } catch (error) {
    console.error("[GET /api/auth/profile]", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "이름은 2자 이상이어야 합니다.").max(50),
  company_name: z.string().trim().max(100).optional(),
});

export async function PUT(request: Request) {
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
    const parsed = updateProfileSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "요청값이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("users")
      .update({
        name: parsed.data.name,
        company_name: parsed.data.company_name || null,
      })
      .eq("id", user.id);

    if (error) {
      console.error("[PUT /api/auth/profile]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PUT /api/auth/profile]", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
