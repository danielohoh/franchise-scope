import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: reportId } = await params;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: report, error } = await admin
      .from("reports")
      .select("status, file_name")
      .eq("id", reportId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[reports/download] Failed to fetch report", error);
      return NextResponse.json({ error: "보고서를 찾을 수 없습니다." }, { status: 404 });
    }

    if (!report) {
      return NextResponse.json({ error: "보고서를 찾을 수 없습니다." }, { status: 404 });
    }

    if (report.status !== "completed" || !report.file_name) {
      return NextResponse.json(
        { error: "아직 생성이 완료되지 않은 보고서입니다." },
        { status: 400 },
      );
    }

    const filePath = `${user.id}/${report.file_name}`;

    // Signed URL (60초 유효) — private 버킷도 다운로드 가능
    const { data: signed, error: signError } = await admin.storage
      .from("reports")
      .createSignedUrl(filePath, 60, { download: report.file_name });

    if (signError || !signed?.signedUrl) {
      console.error("[reports/download] Failed to create signed URL", signError);
      return NextResponse.json({ error: "다운로드 URL 생성에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.redirect(signed.signedUrl);
  } catch (error) {
    console.error("[reports/download] Unexpected error", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
