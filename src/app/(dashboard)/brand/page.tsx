import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { DbBrand } from "@/types/database";
import { PageContainer } from "@/components/layout/PageContainer";
import { BrandManagement } from "@/components/brand/BrandManagement";

export const dynamic = "force-dynamic";

export default async function BrandPage() {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  let brand: DbBrand | null = null;

  if (!isDemoMode) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/auth/login");
    }

    const { data } = await supabase.from("brands").select("*").eq("user_id", user.id).maybeSingle();
    brand = data ?? null;
  }

  return (
    <PageContainer
      title="브랜드 관리"
      description="내 브랜드 기본정보/가맹조건/운영지표를 관리하고 정보공개서 파싱 결과로 자동 채울 수 있어요."
    >
      <BrandManagement initialBrand={brand} />
    </PageContainer>
  );
}
