import { createAdminClient } from "@/lib/supabase/admin";

import ConsultationClient from "./consultation-client";

export const dynamic = "force-dynamic";

export default async function ConsultTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const now = new Date().toISOString();

  const { data: link } = await supabase
    .from("consultation_links")
    .select("token, status, expires_at, brand_id")
    .eq("token", token)
    .eq("status", "active")
    .gt("expires_at", now)
    .maybeSingle();

  if (!link) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center px-4 py-10">
        <div className="w-full rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">유효하지 않은 상담 링크입니다</h1>
          <p className="mt-2 text-sm text-gray-500">링크가 만료되었거나 종료되었습니다. 본사 담당자에게 새 링크를 요청해 주세요.</p>
        </div>
      </main>
    );
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("brand_name")
    .eq("id", link.brand_id)
    .maybeSingle();

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8">
      <ConsultationClient token={token} brandName={brand?.brand_name ?? "브랜드"} />
    </main>
  );
}
