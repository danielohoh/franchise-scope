"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { z } from "zod";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const emailSchema = z.object({
  email: z.string().email("올바른 이메일 주소를 입력해주세요."),
});

type EmailFormValues = z.infer<typeof emailSchema>;

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

export default function LoginPage() {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const emailValue = watch("email");
  const [otpDigits, setOtpDigits] = useState<string[]>(Array.from({ length: OTP_LENGTH }, () => ""));
  const [otpError, setOtpError] = useState("");
  const [requestError, setRequestError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [hasOtpSent, setHasOtpSent] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const otpValue = useMemo(() => otpDigits.join(""), [otpDigits]);

  useEffect(() => {
    if (remainingSeconds <= 0) return undefined;
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) { window.clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [remainingSeconds]);

  const onSendOtp = handleSubmit(async ({ email }) => {
    try {
      setIsSendingOtp(true);
      setRequestError("");
      setSuccessMessage("");
      setOtpError("");

      const supabase = createClient();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${appUrl}/auth/callback`,
        },
      });

      if (error) {
        setRequestError(error.message ?? "인증코드 발송에 실패했습니다.");
        return;
      }

      setHasOtpSent(true);
      setRemainingSeconds(RESEND_SECONDS);
      setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
      setSuccessMessage("인증코드를 발송했습니다. 이메일을 확인해주세요.");
      window.setTimeout(() => { inputRefs.current[0]?.focus(); }, 0);
    } catch (err) {
      console.error("[login] Failed to send OTP", err);
      setRequestError("인증코드 발송 중 오류가 발생했습니다.");
    } finally {
      setIsSendingOtp(false);
    }
  });

  const handleOtpChange = (index: number, value: string) => {
    const nextDigit = value.replace(/\D/g, "").slice(-1);
    const nextDigits = [...otpDigits];
    nextDigits[index] = nextDigit;
    setOtpDigits(nextDigits);
    setOtpError("");
    if (nextDigit && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const nextDigits = Array.from({ length: OTP_LENGTH }, (_, i) => pasted[i] ?? "");
    setOtpDigits(nextDigits);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleVerifyOtp = async () => {
    try {
      setIsVerifyingOtp(true);
      setOtpError("");
      setRequestError("");

      if (otpValue.length !== OTP_LENGTH) {
        setOtpError("6자리 인증코드를 입력해주세요.");
        return;
      }

      const supabase = createClient();

      // 클라이언트에서 직접 verifyOtp → 세션이 브라우저에 자동 저장됨
      const { data, error } = await supabase.auth.verifyOtp({
        email: emailValue,
        token: otpValue,
        type: "email",
      });

      if (error) {
        setOtpError("인증코드가 올바르지 않거나 만료되었습니다.");
        return;
      }

      if (!data.user) {
        setOtpError("인증에 실패했습니다. 다시 시도해주세요.");
        return;
      }

      // users 프로필 존재 여부 → 신규/기존 분기
      const { data: profile } = await supabase
        .from("users")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      window.location.assign(profile ? "/dashboard" : "/auth/signup");
    } catch (err) {
      console.error("[login] Failed to verify OTP", err);
      setOtpError("인증 처리 중 오류가 발생했습니다.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
        <div className="mb-8 space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1F4E79]/10 text-lg font-semibold text-[#1F4E79]">
            FS
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">FranchiseScope 로그인</h1>
          <p className="text-sm leading-6 text-slate-500">이메일로 인증코드를 받아 빠르게 로그인하세요.</p>
        </div>

        <form className="space-y-4" onSubmit={onSendOtp}>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">이메일 주소</label>
            <input
              {...register("email")}
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-base outline-none transition focus:border-[#1F4E79] focus:ring-4 focus:ring-[#1F4E79]/10"
              placeholder="example@email.com"
            />
            {errors.email?.message ? <p className="text-sm text-red-600">{errors.email.message}</p> : null}
          </div>

          <Button
            type="submit"
            size="lg"
            className="h-12 w-full rounded-2xl bg-[#1F4E79] text-white hover:bg-[#173a5b]"
            disabled={isSendingOtp || remainingSeconds > 0}
          >
            {isSendingOtp ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {remainingSeconds > 0 ? `${remainingSeconds}초 후 재전송 가능` : "인증코드 받기"}
          </Button>
        </form>

        <div className="mt-8 space-y-4 rounded-2xl bg-slate-50 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">6자리 인증코드 입력</h2>
            {hasOtpSent ? <span className="text-xs text-slate-500">이메일로 받은 코드를 입력하세요</span> : null}
          </div>

          <div className="grid grid-cols-6 gap-2">
            {otpDigits.map((digit, index) => (
              <input
                key={`otp-${index}`}
                ref={(el) => { inputRefs.current[index] = el; }}
                value={digit}
                inputMode="numeric"
                maxLength={1}
                disabled={!hasOtpSent || isVerifyingOtp}
                className="h-12 rounded-2xl border border-slate-200 text-center text-lg font-semibold outline-none transition focus:border-[#1F4E79] focus:ring-4 focus:ring-[#1F4E79]/10 disabled:bg-slate-100 disabled:text-slate-400"
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                onPaste={handleOtpPaste}
              />
            ))}
          </div>

          {successMessage ? <p className="text-sm text-[#1F4E79]">{successMessage}</p> : null}
          {requestError ? <p className="text-sm text-red-600">{requestError}</p> : null}
          {otpError ? <p className="text-sm text-red-600">{otpError}</p> : null}

          <Button
            type="button"
            size="lg"
            variant="outline"
            className="h-12 w-full rounded-2xl border-slate-200"
            disabled={!hasOtpSent || isVerifyingOtp}
            onClick={() => { void handleVerifyOtp(); }}
          >
            {isVerifyingOtp ? <LoaderCircle className="size-4 animate-spin" /> : null}
            인증 완료
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          처음 방문하셨나요?{" "}
          <Link href="/auth/signup" className="font-semibold text-[#1F4E79] underline-offset-4 hover:underline">
            회원가입 이어서 진행
          </Link>
        </p>
      </div>
    </div>
  );
}
