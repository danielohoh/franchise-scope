import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { DashboardMobileTopbar, DashboardSidebar } from "@/app/(dashboard)/_components/dashboard-navigation";

// 인증 + Supabase 의존 → 정적 생성 비활성화
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // 개발 미리보기 모드: 인증/Supabase 없이 레이아웃 렌더링
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  let userName = "데모 사용자";
  let initialHasBrand = true;

  if (!isDemoMode) {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/auth/login");
    }

    const [{ data: profile }, { data: brand }] = await Promise.all([
      supabase.from("users").select("name").eq("id", user.id).maybeSingle(),
      supabase.from("brands").select("id").eq("user_id", user.id).maybeSingle(),
    ]);

    // 프로필 없는 유저 → 회원가입 완료 페이지로 리다이렉트
    if (!profile) {
      redirect("/auth/signup");
    }

    userName = profile.name ?? user.email ?? "사용자";
    initialHasBrand = Boolean(brand);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="lg:flex">
        <div className="hidden lg:block lg:shrink-0">
          <div className="sticky top-0 h-screen">
            <DashboardSidebar initialHasBrand={initialHasBrand} userName={userName} />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <DashboardMobileTopbar initialHasBrand={initialHasBrand} userName={userName} />
          <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
