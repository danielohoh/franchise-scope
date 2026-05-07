import { redirect } from "next/navigation";

import { PageContainer } from "@/components/layout/PageContainer";
import { createClient } from "@/lib/supabase/server";
import type { UserPlan } from "@/types/database";

import { LogoutButton } from "@/app/(dashboard)/settings/_components/LogoutButton";
import { ProfileEditForm } from "@/app/(dashboard)/settings/_components/ProfileEditForm";

export const dynamic = "force-dynamic";

type SettingsProfile = {
  plan: UserPlan;
};

function planLabel(plan: UserPlan) {
  if (plan === "enterprise") return "Enterprise";
  if (plan === "pro") return "Pro";
  return "Free";
}

export default async function SettingsPage() {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  let profile: SettingsProfile = {
    plan: "free",
  };

  if (!isDemoMode) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/auth/login");
    }

    const { data: dbUser } = await supabase
      .from("users")
      .select("plan")
      .eq("id", user.id)
      .maybeSingle();

    if (!dbUser) {
      redirect("/auth/signup");
    }

    profile = {
      plan: dbUser.plan,
    };
  }

  return (
    <PageContainer
      title="설정"
      description="계정 정보와 플랜 상태를 확인하세요."
    >
      <div className="max-w-2xl space-y-6">
        <ProfileEditForm />

        <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-base font-semibold">플랜</h2>
              <p className="mt-1 text-sm text-muted-foreground">현재 구독 플랜입니다.</p>
            </div>
            <div className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
              {planLabel(profile.plan)}
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-border bg-background p-4">
            <p className="text-sm text-muted-foreground">
              플랜 변경/결제는 Wave 3에서 제공될 예정입니다.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-base font-semibold">계정</h2>
              <p className="mt-1 text-sm text-muted-foreground">세션 및 보안 작업</p>
            </div>
            <LogoutButton variant="secondary" />
          </div>
        </section>

        <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-foreground">
          <h2 className="font-heading text-base font-semibold text-destructive">Danger zone</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            계정 삭제는 복구할 수 없습니다. MVP에서는 삭제 기능을 제공하지 않습니다.
          </p>
          <div className="mt-5 rounded-xl border border-destructive/20 bg-background p-4">
            <p className="text-sm font-medium text-foreground">계정 삭제</p>
            <p className="mt-1 text-xs text-muted-foreground">지원팀에 문의해주세요.</p>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
