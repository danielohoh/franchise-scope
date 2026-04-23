"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";

import { PluginGuide } from "@/components/recommend/PluginGuide";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export default function PluginSettingsPage() {
  const [email, setEmail] = useState<string>("-");

  useEffect(() => {
    void (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        setEmail(data.user?.email ?? "-");
      } catch (error) {
        console.error("[plugin] getUser failed", error);
        toast.error("사용자 정보를 불러오지 못했습니다.");
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Chrome 플러그인 연동</h1>
          <p className="mt-1 text-sm text-muted-foreground">플러그인을 설치하고 계정을 연동해 매물 수집을 시작하세요.</p>
        </div>
        <Link href="/dashboard/settings" className="shrink-0">
          <Button type="button" variant="ghost" className="rounded-xl">
            <ArrowLeft className="size-4" />
            설정으로 돌아가기
          </Button>
        </Link>
      </div>

      <PluginGuide />

      <div className="flex flex-wrap items-center gap-3">
        <a href="#" className="shrink-0">
          <Button type="button" className="rounded-xl">
            <Download className="size-4" />
            플러그인 다운로드
          </Button>
        </a>
        <div className="rounded-xl border border-border bg-muted px-4 py-2.5 text-sm text-muted-foreground">
          플러그인에서 <span className="font-semibold text-foreground">ai-scope.kr</span> 계정으로 로그인하면 자동으로 연동됩니다
        </div>
      </div>

      <section className="rounded-xl border border-border bg-background p-6">
        <h2 className="text-base font-semibold text-foreground">현재 로그인 계정</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          이메일: <span className="font-medium text-foreground">{email}</span>
        </p>
      </section>
    </div>
  );
}
