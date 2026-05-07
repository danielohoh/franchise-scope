"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { z } from "zod";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const schema = z.object({
  email: z.string().email("올바른 이메일을 입력해주세요."),
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

type FormValues = z.infer<typeof schema>;

function toKoreanError(message: string): string {
  const msg = message.toLowerCase();
  if (msg.includes("invalid login") || msg.includes("invalid credentials")) return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (msg.includes("email not confirmed")) return "이메일 인증이 필요합니다. 받은편지함을 확인해주세요.";
  if (msg.includes("too many requests") || msg.includes("rate limit")) return "잠시 후 다시 시도해주세요.";
  if (msg.includes("network") || msg.includes("fetch")) return "네트워크 오류가 발생했습니다.";
  return "로그인에 실패했습니다. 다시 시도해주세요.";
}

export default function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setError("");
    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError(toKoreanError(authError.message));
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      window.location.assign(profile ? "/dashboard" : "/auth/signup");
    } catch (err) {
      console.error("[login] error", err);
      setError("로그인 처리 중 오류가 발생했습니다.");
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
        <div className="mb-8 space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary">
            FS
          </div>
          <h1 className="text-2xl font-semibold text-foreground">FranchiseScope 로그인</h1>
          <p className="text-sm leading-6 text-muted-foreground">이메일과 비밀번호로 로그인하세요.</p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">이메일</label>
            <input
              {...register("email")}
              id="email"
              type="email"
              autoComplete="email"
              placeholder="example@email.com"
              className="h-12 w-full rounded-2xl border border-border px-4 text-base outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
            {errors.email?.message ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">비밀번호</label>
            <div className="relative">
              <input
                {...register("password")}
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="비밀번호 입력"
                className="h-12 w-full rounded-2xl border border-border px-4 pr-12 text-base outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.password?.message ? <p className="text-sm text-destructive">{errors.password.message}</p> : null}
          </div>

          {error ? (
            <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="h-12 w-full rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={isSubmitting}
          >
            {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
            로그인
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          계정이 없으신가요?{" "}
          <Link href="/auth/signup" className="font-semibold text-primary underline-offset-4 hover:underline">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
