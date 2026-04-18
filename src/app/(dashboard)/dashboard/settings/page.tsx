"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

export const dynamic = "force-dynamic";

const profileSchema = z.object({
  name: z.string().trim().min(2, "이름은 2자 이상이어야 합니다.").max(50),
  company_name: z.string().trim().max(100).optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

interface UserProfile {
  name: string;
  company_name: string | null;
  phone: string;
}

interface ProfileApiResponse {
  user: UserProfile;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/auth/profile");
        if (res.ok) {
          const data = (await res.json()) as ProfileApiResponse;
          reset({
            name: data.user.name,
            company_name: data.user.company_name ?? "",
          });
        }
      } catch (err) {
        console.error("Settings profile fetch error", err);
      } finally {
        setLoading(false);
      }
    }
    void fetchProfile();
  }, [reset]);

  const onSubmit = async (values: ProfileForm) => {
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "저장에 실패했습니다.");
        return;
      }

      toast.success("프로필이 저장되었습니다.");
    } catch (err) {
      console.error("Settings profile update error", err);
      toast.error("네트워크 오류가 발생했습니다.");
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        window.location.href = "/auth/login";
      } else {
        toast.error("로그아웃에 실패했습니다.");
      }
    } catch (err) {
      console.error("Logout error", err);
      toast.error("네트워크 오류가 발생했습니다.");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">설정</h1>

      {/* 프로필 섹션 */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-base font-semibold text-gray-900">프로필 정보</h2>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                {...register("name")}
                type="text"
                placeholder="홍길동"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1F4E79] disabled:bg-gray-50"
                disabled={isSubmitting}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                소속 회사명 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <input
                {...register("company_name")}
                type="text"
                placeholder="(주)프랜차이즈본사"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1F4E79] disabled:bg-gray-50"
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-[#1F4E79] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1a4268] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Spinner />
                  저장 중...
                </>
              ) : (
                "저장"
              )}
            </button>
          </form>
        )}
      </section>

      {/* LLM 설정 섹션 */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-base font-semibold text-gray-900">LLM 설정</h2>
        <p className="mb-4 text-sm text-gray-500">
          현재 LLM 설정은 서버 환경변수로 관리됩니다. 변경하려면 Vercel 대시보드의 환경변수를 수정해주세요.
        </p>

        <div className="rounded-xl bg-gray-50 p-4 space-y-2">
          <InfoRow label="LLM Provider" value={process.env.NEXT_PUBLIC_LLM_PROVIDER_DISPLAY ?? "Anthropic (Claude)"} />
          <InfoRow label="모델" value="환경변수로 설정됨" />
        </div>

        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs text-blue-700">
            💡 <strong>.env.local</strong> 파일에서 <code className="bg-blue-100 px-1 rounded">LLM_PROVIDER</code>,{" "}
            <code className="bg-blue-100 px-1 rounded">LLM_API_KEY</code>,{" "}
            <code className="bg-blue-100 px-1 rounded">LLM_MODEL</code>을 설정하면 LLM을 전환할 수 있습니다.
          </p>
        </div>
      </section>

      {/* 계정 섹션 */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-900">계정</h2>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {loggingOut ? <Spinner /> : null}
          로그아웃
        </button>
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
