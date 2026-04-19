"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const schema = z
  .object({
    email: z.string().email("올바른 이메일을 입력해주세요."),
    password: z
      .string()
      .min(8, "비밀번호는 8자 이상이어야 합니다.")
      .regex(/[A-Za-z]/, "영문자를 포함해야 합니다.")
      .regex(/[0-9]/, "숫자를 포함해야 합니다."),
    confirmPassword: z.string().min(1, "비밀번호를 다시 입력해주세요."),
    name: z.string().trim().min(2, "이름은 2자 이상이어야 합니다.").max(50, "이름은 50자 이하여야 합니다."),
    companyName: z.string().trim().max(100, "회사명은 100자 이하여야 합니다.").optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export default function SignupPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", confirmPassword: "", name: "", companyName: "" },
  });

  const [submitError, setSubmitError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const onSubmit = handleSubmit(async ({ email, password, name, companyName }) => {
    setSubmitError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, companyName: companyName?.trim() || null }),
      });

      const json = (await res.json()) as { error?: string };

      if (!res.ok) {
        setSubmitError(json.error ?? "회원가입에 실패했습니다.");
        return;
      }

      window.location.assign("/dashboard/brand");
    } catch (err) {
      console.error("[signup] error", err);
      setSubmitError("회원가입 처리 중 오류가 발생했습니다.");
    }
  });

  const inputClass = (hasError: boolean) =>
    cn(
      "h-11 w-full rounded-xl border px-3 text-sm outline-none transition",
      "focus:border-[#1F4E79] focus:ring-2 focus:ring-[#1F4E79]/20",
      hasError ? "border-red-400" : "border-slate-200",
    );

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
        <div className="mb-8 space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1F4E79]/10 text-lg font-semibold text-[#1F4E79]">
            FS
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">회원가입</h1>
          <p className="text-sm text-slate-500">FranchiseScope를 시작하세요.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="이메일" error={errors.email?.message}>
            <input
              {...register("email")}
              type="email"
              autoComplete="email"
              placeholder="example@email.com"
              className={inputClass(!!errors.email)}
            />
          </Field>

          <Field label="비밀번호" error={errors.password?.message}>
            <div className="relative">
              <input
                {...register("password")}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="영문+숫자 8자 이상"
                className={cn(inputClass(!!errors.password), "pr-10")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>

          <Field label="비밀번호 확인" error={errors.confirmPassword?.message}>
            <div className="relative">
              <input
                {...register("confirmPassword")}
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="비밀번호 재입력"
                className={cn(inputClass(!!errors.confirmPassword), "pr-10")}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>

          <Field label="이름" error={errors.name?.message}>
            <input
              {...register("name")}
              type="text"
              placeholder="홍길동"
              className={inputClass(!!errors.name)}
            />
          </Field>

          <Field label="소속 회사명 (선택)" error={errors.companyName?.message}>
            <input
              {...register("companyName")}
              type="text"
              placeholder="FranchiseScope"
              className={inputClass(!!errors.companyName)}
            />
          </Field>

          {submitError ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{submitError}</p>
          ) : null}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full rounded-xl bg-[#1F4E79] text-white hover:bg-[#173a5b]"
          >
            {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
            회원가입
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          이미 계정이 있으신가요?{" "}
          <Link href="/auth/login" className="font-semibold text-[#1F4E79] underline-offset-4 hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
