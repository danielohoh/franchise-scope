import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      companyName?: string;
    };
    const name = (body.name ?? "").trim();
    const companyName = (body.companyName ?? "").trim();

    if (name.length < 2 || name.length > 50) {
      return NextResponse.json(
        { message: "이름은 2자 이상 50자 이하로 입력해주세요." },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ message: "서버 환경변수가 설정되지 않았습니다." }, { status: 500 });
    }

    // 1) Authorization 헤더에서 access_token 추출 (클라이언트사이드 세션)
    const authHeader = request.headers.get("Authorization");
    const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    let user: { id: string; email?: string | null; phone?: string | null } | null = null;

    if (accessToken) {
      // access_token으로 사용자 검증 (admin client 사용)
      const admin = createSupabaseAdmin(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await admin.auth.getUser(accessToken);
      if (error || !data.user) {
        console.error("[complete-signup] Invalid access token", error);
        return NextResponse.json({ message: "유효하지 않은 인증 토큰입니다." }, { status: 401 });
      }
      user = data.user;
    } else {
      // 쿠키 기반 세션 폴백
      const supabase = await createClient();
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError || !data.user) {
        console.error("[complete-signup] Failed to load auth user", authError);
        return NextResponse.json({ message: "로그인 상태를 확인할 수 없습니다." }, { status: 401 });
      }
      user = data.user;
    }

    if (!user) {
      return NextResponse.json({ message: "인증된 사용자가 아닙니다." }, { status: 401 });
    }

    // 이메일 인증으로 전환 — phone이 없으면 UUID 앞 15자리로 채움 (NOT NULL 우회, 추후 마이그레이션으로 nullable 변경 권장)
    const phone = user.phone ?? user.id.replace(/-/g, "").slice(0, 15);

    const now = new Date().toISOString();
    const payload: Database["public"]["Tables"]["users"]["Insert"] = {
      id: user.id,
      phone,
      name,
      email: user.email ?? null,
      company_name: companyName || null,
      role: "user",
      plan: "free",
      created_at: now,
      updated_at: now,
    };

    const response = await fetch(`${supabaseUrl}/rest/v1/users?on_conflict=id`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error("[complete-signup] Failed to save profile", responseText);

      return NextResponse.json(
        { message: "회원가입 정보를 저장하지 못했습니다." },
        { status: 500 },
      );
    }

    return NextResponse.json({ message: "회원가입이 완료되었습니다." });
  } catch (error) {
    console.error("[complete-signup] Unexpected error", error);

    return NextResponse.json(
      { message: "요청 처리 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
