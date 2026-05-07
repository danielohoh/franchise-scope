"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

export default function ConfirmPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    async function handleConfirm() {
      try {
        // PKCE ?code= 처리
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("[confirm] exchangeCodeForSession 실패", error);
            router.replace("/auth/login");
            return;
          }
        }

        // 세션 확인 (hash fragment는 Supabase 클라이언트가 자동 처리)
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          router.replace("/auth/login");
          return;
        }

        const { data: profile } = await supabase
          .from("users")
          .select("id")
          .eq("id", session.user.id)
          .maybeSingle();

        router.replace(profile ? "/dashboard" : "/auth/signup");
      } catch (err) {
        console.error("[confirm] 오류", err);
        router.replace("/auth/login");
      }
    }

    void handleConfirm();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <LoaderCircle className="size-8 animate-spin text-primary" />
        <p className="text-sm">로그인 처리 중...</p>
      </div>
    </div>
  );
}
