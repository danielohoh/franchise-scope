import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
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

    const { data: updated, error } = await supabase
      .from("consultation_links")
      .update({ status: "closed" })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[consultations/links/[id]] DELETE failed", error);
      return NextResponse.json({ error: "상담 링크를 종료하지 못했습니다." }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json({ error: "상담 링크를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[consultations/links/[id]] DELETE unexpected", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
