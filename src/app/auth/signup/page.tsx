"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const completeSignupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "이름은 2자 이상이어야 합니다.")
    .max(50, "이름은 50자 이하여야 합니다."),
  companyName: z.string().trim().max(100, "회사명은 100자 이하여야 합니다.").optional(),
});

type CompleteSignupForm = z.infer<typeof completeSignupSchema>;

function Spinner() {
  return <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
}

export default function SignupPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CompleteSignupForm>({
    resolver: zodResolver(completeSignupSchema),
    defaultValues: {
      name: "",
      companyName: "",
    },
  });

  const [submitError, setSubmitError] = useState<string>("");
  const [sessionChecked, setSessionChecked] = useState(false);

  // 세션 없으면 로그인 페이지로 리다이렉트
  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        window.location.assign("/auth/login");
      } else {
        setSessionChecked(true);
      }
    });
  }, []);

  const onSubmit = async (values: CompleteSignupForm) => {
    setSubmitError("");

    try {
      const supabase = createClient();

      // 1) 현재 세션 확인
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        window.location.assign("/auth/login");
        return;
      }

      const user = session.user;
      // phone NOT NULL 우회: phone이 없거나 빈 문자열이면 UUID 앞 15자리 사용
      const phone = user.phone || user.id.replace(/-/g, "").slice(0, 15);

      // 2) 서버 API 경유 없이 클라이언트에서 직접 DB 저장
      const { error } = await supabase.from("users").upsert(
        {
          id: user.id,
          phone,
          name: values.name.trim(),
          email: user.email ?? null,
          company_name: values.companyName?.trim() || null,
          role: "user",
          plan: "free",
        },
        { onConflict: "id" },
      );

      if (error) {
        console.error("Signup upsert failed", error);
        setSubmitError(error.message ?? "회원가입 정보를 저장하지 못했습니다.");
        return;
      }

      window.location.assign("/dashboard/brand");
    } catch (error) {
      console.error("Signup completion failed", error);
      setSubmitError("회원가입 처리 중 오류가 발생했습니다.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-[#1F4E79]">회원가입 완료</h1>
        <p className="mt-2 text-sm text-slate-600">이름과 소속 정보를 입력해 계정을 활성화하세요.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-slate-700">
              이름
            </label>
            <input
              id="name"
              type="text"
              placeholder="홍길동"
              className={cn(
                "h-11 w-full rounded-lg border px-3 text-sm outline-none transition",
                "focus:border-[#1F4E79] focus:ring-2 focus:ring-[#1F4E79]/20",
                errors.name ? "border-red-500" : "border-slate-300",
              )}
              {...register("name")}
            />
            {errors.name?.message ? <p className="text-sm text-red-600">{errors.name.message}</p> : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="companyName" className="block text-sm font-medium text-slate-700">
              소속 회사명 (선택)
            </label>
            <input
              id="companyName"
              type="text"
              placeholder="FranchiseScope"
              className={cn(
                "h-11 w-full rounded-lg border px-3 text-sm outline-none transition",
                "focus:border-[#1F4E79] focus:ring-2 focus:ring-[#1F4E79]/20",
                errors.companyName ? "border-red-500" : "border-slate-300",
              )}
              {...register("companyName")}
            />
            {errors.companyName?.message ? (
              <p className="text-sm text-red-600">{errors.companyName.message}</p>
            ) : null}
          </div>

          {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

          <Button
            type="submit"
            disabled={isSubmitting || !sessionChecked}
            className="h-11 w-full bg-[#1F4E79] hover:bg-[#193f62]"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <Spinner />
                처리 중...
              </span>
            ) : (
              "가입 완료"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          이미 계정이 있으신가요?{" "}
          <Link href="/auth/login" className="font-medium text-[#1F4E79] underline">
            로그인으로 이동
          </Link>
        </p>
      </section>
    </main>
  );
}
