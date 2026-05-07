import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ApiError = { message: string };
type UploadResponse = { disclosure_id: string };

export const maxDuration = 10;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json<ApiError>({ message: "인증이 필요합니다." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const brandId = formData.get("brand_id");

    if (!(file instanceof File)) {
      return NextResponse.json<ApiError>({ message: "PDF 파일이 필요합니다." }, { status: 400 });
    }

    if (typeof brandId !== "string" || brandId.trim().length === 0) {
      return NextResponse.json<ApiError>({ message: "brand_id가 필요합니다." }, { status: 400 });
    }

    if (!(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
      return NextResponse.json<ApiError>({ message: "PDF만 업로드할 수 있습니다." }, { status: 400 });
    }

    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json<ApiError>({ message: "최대 20MB까지 업로드할 수 있습니다." }, { status: 400 });
    }

    const admin = createAdminClient();
    const disclosureId = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${user.id}/${disclosureId}-${safeName}`;
    const now = new Date().toISOString();
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from("disclosures")
      .upload(filePath, fileBuffer, { contentType: "application/pdf", upsert: false });

    if (uploadError) {
      return NextResponse.json<ApiError>({ message: "파일 업로드에 실패했습니다." }, { status: 500 });
    }

    const { error: insertError } = await admin.from("disclosures").insert({
      id: disclosureId,
      brand_id: brandId,
      user_id: user.id,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      parse_status: "uploaded",
      created_at: now,
      updated_at: now,
    });

    if (insertError) {
      await admin.storage.from("disclosures").remove([filePath]);
      return NextResponse.json<ApiError>({ message: "정보공개서 메타데이터 저장에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json<UploadResponse>({ disclosure_id: disclosureId }, { status: 201 });
  } catch (error) {
    console.error("[disclosure/upload POST]", error);
    return NextResponse.json<ApiError>({ message: "요청 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
