import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  email: z.string().email("올바른 이메일을 입력해주세요."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
  name: z.string().trim().min(2).max(50),
  companyName: z.string().trim().max(100).nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = schema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const { email, password, name, companyName } = parsed.data;
    const admin = createAdminClient();

    // 1) 이미 가입된 이메일인지 확인
    const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers();
    if (listError) {
      console.error("[register] listUsers 실패", listError);
      return NextResponse.json(
        { error: "서버 오류가 발생했습니다.", _debug: `listUsers: ${listError.message}` },
        { status: 500 },
      );
    }
    const alreadyExists = existingUsers?.users.some(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );

    if (alreadyExists) {
      return NextResponse.json(
        { error: "이미 사용 중인 이메일입니다." },
        { status: 409 },
      );
    }

    // 2) Admin으로 사용자 생성 (email_confirm: true → 인증 이메일 없이 즉시 활성화)
    const { data: userData, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !userData.user) {
      console.error("[register] createUser 실패", createError);
      return NextResponse.json(
        { error: "계정 생성에 실패했습니다. 다시 시도해주세요.", _debug: `createUser: ${createError?.message ?? "user is null"}` },
        { status: 500 },
      );
    }

    const user = userData.user;
    const phone = user.id.replace(/-/g, "").slice(0, 15);

    // 3) users 테이블에 프로필 저장
    const { error: profileError } = await admin
      .from("users")
      .upsert(
        {
          id: user.id,
          phone,
          name,
          email: user.email ?? null,
          company_name: companyName ?? null,
          role: "user",
          plan: "free",
        },
        { onConflict: "id" },
      );

    if (profileError) {
      console.error("[register] profile upsert 실패", profileError);
      // 계정은 만들어졌으나 프로필 저장 실패 → 롤백 시도
      await admin.auth.admin.deleteUser(user.id);
      return NextResponse.json(
        { error: "프로필 저장에 실패했습니다. 다시 시도해주세요." },
        { status: 500 },
      );
    }

    // 4) 클라이언트 측에서 직접 로그인하도록 이메일/비밀번호는 이미 갖고 있음
    //    서버에서 세션을 만들지 않고 success를 반환 → 브라우저가 직접 signInWithPassword 호출
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[register] Unexpected error", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
