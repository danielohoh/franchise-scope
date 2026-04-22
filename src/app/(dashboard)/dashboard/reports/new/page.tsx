"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReportStatus } from "@/types/database";

export const dynamic = "force-dynamic";

type Prospect = { id: string; name: string; status: string };
type ProspectsResponse = { prospects: Prospect[] };
type BrandGetResponse = { brand: { id: string } | null };

type GenerateResponse = { report_id: string } | { error: string };
type StatusResponse = {
  status: ReportStatus;
  step: number;
  message: string;
  recommendation?: string;
  total_score?: number;
  file_url?: string;
  error_message?: string;
};

const STATUS_UI: Record<ReportStatus, { step: 1 | 2 | 3 | 4 | 5; message: string }> = {
  pending: { step: 1, message: "📍 주소 분석 중..." },
  collecting: { step: 2, message: "🏘️ 상권 데이터 수집 중..." },
  analyzing: { step: 3, message: "🤖 AI 분석 중..." },
  generating: { step: 4, message: "📄 보고서 문서 생성 중..." },
  completed: { step: 5, message: "✅ 완료!" },
  failed: { step: 1, message: "❌ 실패" },
};

function safeErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/** 숫자만 추출 */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** 천단위 콤마 포맷 */
function formatNumberInput(value: string): string {
  const digits = digitsOnly(value).replace(/^0+(?=\d)/, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 콤마 제거 후 숫자 반환, 빈 문자열이면 null */
function parseManWon(value: string): number | null {
  const digits = digitsOnly(value);
  return digits ? Number(digits) : null;
}

function StepRow({
  index,
  label,
  state,
}: {
  index: 1 | 2 | 3 | 4 | 5;
  label: string;
  state: "pending" | "active" | "done";
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "mt-0.5 flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
          state === "done"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : state === "active"
              ? "border-primary bg-primary/5 text-primary animate-pulse"
              : "border-gray-200 bg-white text-gray-500",
        )}
        aria-hidden
      >
        {state === "done" ? <Check className="size-4" /> : index}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-medium",
            state === "active" ? "text-gray-900" : state === "done" ? "text-gray-800" : "text-gray-600",
          )}
        >
          {label}
        </p>
      </div>
    </div>
  );
}

export default function NewReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialProspectId = useMemo(() => searchParams.get("prospect_id"), [searchParams]);

  const [brandId, setBrandId] = useState<string | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loadingProspects, setLoadingProspects] = useState(true);

  const [prospectId, setProspectId] = useState<string | null>(initialProspectId);
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 임대 조건 입력 상태 (기본: 해당없음 체크 = AI 추정)
  const [noPropertyInfo, setNoPropertyInfo] = useState(true);
  const [depositManWon, setDepositManWon] = useState("");
  const [monthlyRentManWon, setMonthlyRentManWon] = useState("");
  const [maintenanceFeeManWon, setMaintenanceFeeManWon] = useState("");

  const [mode, setMode] = useState<"form" | "progress">("form");
  const [reportId, setReportId] = useState<string | null>(null);
  const [status, setStatus] = useState<ReportStatus>("pending");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pollIntervalRef = useRef<number | null>(null);
  const redirectTimeoutRef = useRef<number | null>(null);
  const stuckTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setProspectId(initialProspectId);
  }, [initialProspectId]);

  useEffect(() => {
    let cancelled = false;

    async function fetchInitial() {
      setLoadingProspects(true);
      try {
        const [brandsRes, prospectsRes] = await Promise.all([fetch("/api/brands"), fetch("/api/prospects")]);

        if (brandsRes.ok) {
          const json = (await brandsRes.json()) as BrandGetResponse;
          if (!cancelled) setBrandId(json.brand?.id ?? null);
        }

        if (prospectsRes.ok) {
          const json = (await prospectsRes.json()) as ProspectsResponse;
          if (!cancelled) setProspects(json.prospects ?? []);
        }
      } catch (error) {
        console.error("[reports/new] init fetch failed", error);
        toast.error("초기 데이터를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoadingProspects(false);
      }
    }

    void fetchInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!reportId) return;

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/reports/${reportId}/status`, { method: "GET" });
        const json = (await res.json()) as StatusResponse | { error?: string };

        if (!res.ok) {
          const message = "error" in json && json.error ? json.error : "상태 조회에 실패했습니다.";
          throw new Error(message);
        }

        if (cancelled) return;

        const nextStatus = (json as StatusResponse).status;
        setStatus(nextStatus);
        setErrorMessage((json as StatusResponse).error_message ?? null);

        if (nextStatus === "completed") {
          if (pollIntervalRef.current) window.clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          if (stuckTimeoutRef.current) window.clearTimeout(stuckTimeoutRef.current);
          stuckTimeoutRef.current = null;

          if (redirectTimeoutRef.current) window.clearTimeout(redirectTimeoutRef.current);
          redirectTimeoutRef.current = window.setTimeout(() => {
            router.push(`/dashboard/reports/${reportId}`);
          }, 3000);
        }

        if (nextStatus === "failed") {
          if (pollIntervalRef.current) window.clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          if (stuckTimeoutRef.current) window.clearTimeout(stuckTimeoutRef.current);
          stuckTimeoutRef.current = null;
        }
      } catch (error) {
        console.error("[reports/new] poll failed", error);
      }
    }

    void poll();
    pollIntervalRef.current = window.setInterval(() => {
      void poll();
    }, 2000);

    // 8분(480s) 동안 완료/실패가 없으면 타임아웃으로 처리
    stuckTimeoutRef.current = window.setTimeout(() => {
      if (pollIntervalRef.current) window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
      setStatus("failed");
      setErrorMessage(
        "보고서 생성에 시간이 너무 오래 걸려 타임아웃됐습니다. 다시 시도하거나, 잠시 후 보고서 목록에서 결과를 확인해주세요.",
      );
    }, 8 * 60 * 1000);

    return () => {
      cancelled = true;
      if (pollIntervalRef.current) window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
      if (redirectTimeoutRef.current) window.clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
      if (stuckTimeoutRef.current) window.clearTimeout(stuckTimeoutRef.current);
      stuckTimeoutRef.current = null;
    };
  }, [reportId, router]);

  const currentStep = STATUS_UI[status].step;
  const currentMessage = STATUS_UI[status].message;

  const steps = useMemo(
    () =>
      [
        { index: 1 as const, label: "📍 주소 분석" },
        { index: 2 as const, label: "🏘️ 상권 데이터 수집" },
        { index: 3 as const, label: "🤖 AI 분석" },
        { index: 4 as const, label: "📄 보고서 문서 생성" },
        { index: 5 as const, label: "✅ 완료" },
      ] as const,
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2">
            <Link href="/dashboard/reports" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary">
              <ArrowLeft className="size-4" />
              목록으로
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">새 보고서 생성</h1>
          <p className="mt-1 text-sm text-gray-500">주소를 입력하면 상권 데이터 수집과 AI 분석을 통해 DOCX 보고서를 생성합니다.</p>
        </div>
      </div>

      {mode === "form" ? (
        <section className="max-w-2xl rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void (async () => {
                const trimmed = address.trim();
                if (!trimmed) {
                  toast.error("분석 주소를 입력해주세요.");
                  return;
                }

                if (!brandId) {
                  toast.error("브랜드 정보를 찾을 수 없습니다. 먼저 브랜드를 등록해주세요.");
                  router.push("/dashboard/brand");
                  return;
                }

                try {
                  setSubmitting(true);
                  setMode("progress");
                  setStatus("pending");
                  setErrorMessage(null);
                  setReportId(null);

                  const generateRes = await fetch("/api/reports/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      brand_id: brandId,
                      address: trimmed,
                      ...(prospectId ? { prospect_id: prospectId } : {}),
                    }),
                  });

                  const generateJson = (await generateRes.json()) as GenerateResponse;
                  if (!generateRes.ok) {
                    const message = "error" in generateJson ? generateJson.error : "보고서 생성 요청에 실패했습니다.";
                    throw new Error(message);
                  }

                  const nextReportId = (generateJson as { report_id: string }).report_id;
                  setReportId(nextReportId);

                  // fire-and-forget (await 없이 호출) — 임대 조건 포함
                  const propertyPayload = noPropertyInfo
                    ? null
                    : {
                        deposit: parseManWon(depositManWon),
                        monthly_rent: parseManWon(monthlyRentManWon),
                        maintenance_fee: parseManWon(maintenanceFeeManWon),
                      };
                  void fetch(`/api/reports/${nextReportId}/run`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ property: propertyPayload }),
                  }).catch((error) => {
                    console.error("[reports/new] run trigger failed", error);
                  });

                  toast.success("보고서 생성을 시작했습니다.");
                } catch (error) {
                  console.error("[reports/new] generate failed", error);
                  toast.error(safeErrorMessage(error, "보고서 생성에 실패했습니다."));
                  setMode("form");
                } finally {
                  setSubmitting(false);
                }
              })();
            }}
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">예비 창업자</label>
              <select
                value={prospectId ?? ""}
                onChange={(e) => setProspectId(e.target.value ? e.target.value : null)}
                disabled={loadingProspects || submitting}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1F4E79] disabled:bg-gray-50"
              >
                <option value="">직접 입력</option>
                {prospects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">예비 창업자와 연결하면 보고서 목록에서 추적하기 쉬워집니다.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                분석 주소 <span className="text-red-500">*</span>
              </label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                type="text"
                required
                placeholder="예: 서울특별시 강남구 테헤란로 123"
                disabled={submitting}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1F4E79] disabled:bg-gray-50"
              />
            </div>

            {/* 임대 조건 (선택) */}
            <fieldset className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <legend className="text-sm font-medium text-gray-700">임대 조건 <span className="text-gray-400 font-normal">(선택)</span></legend>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={noPropertyInfo}
                    onChange={(e) => {
                      setNoPropertyInfo(e.target.checked);
                      if (e.target.checked) {
                        setDepositManWon("");
                        setMonthlyRentManWon("");
                        setMaintenanceFeeManWon("");
                      }
                    }}
                    disabled={submitting}
                    className="size-4 rounded border-gray-300 accent-[#1F4E79]"
                  />
                  해당없음 (AI가 시세 추정)
                </label>
              </div>

              <div className={cn("grid grid-cols-3 gap-3 transition-opacity duration-150", noPropertyInfo && "pointer-events-none opacity-40")}>
                {(
                  [
                    { label: "보증금", value: depositManWon, setter: setDepositManWon },
                    { label: "월 임대료", value: monthlyRentManWon, setter: setMonthlyRentManWon },
                    { label: "관리비", value: maintenanceFeeManWon, setter: setMaintenanceFeeManWon },
                  ] as const
                ).map(({ label, value, setter }) => (
                  <div key={label}>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={value}
                        onChange={(e) => setter(formatNumberInput(e.target.value))}
                        disabled={noPropertyInfo || submitting}
                        placeholder="0"
                        className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1F4E79] disabled:bg-gray-50"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">만원</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500">미입력 항목은 AI가 상권 시세를 기준으로 추정합니다.</p>
            </fieldset>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={submitting} className="rounded-xl px-5">
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  "보고서 생성"
                )}
              </Button>
              <Link href="/dashboard/reports" className="text-sm text-gray-500 hover:text-gray-700">
                취소
              </Link>
            </div>
          </form>
        </section>
      ) : (
        <section className="max-w-2xl rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">생성 진행 상황</p>
              <p className="mt-1 text-sm text-gray-600">{currentMessage}</p>
            </div>
            {status !== "failed" && status !== "completed" ? (
              <div className="inline-flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/50 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
                폴링 중
              </div>
            ) : null}
          </div>

          <div className="mt-5 space-y-3">
            {steps.map((s) => {
              const state: "pending" | "active" | "done" =
                currentStep > s.index ? "done" : currentStep === s.index ? "active" : "pending";
              return <StepRow key={s.index} index={s.index} label={s.label} state={state} />;
            })}
          </div>

          {status === "failed" ? (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">❌ 실패</p>
              <p className="mt-1 text-sm text-red-700/90">{errorMessage ?? "알 수 없는 오류가 발생했습니다."}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    setMode("form");
                    setReportId(null);
                    setStatus("pending");
                    setErrorMessage(null);
                  }}
                >
                  <RefreshCw className="size-4" />
                  다시 시도
                </Button>
                {reportId ? (
                  <Link href={`/dashboard/reports/${reportId}`} className="text-sm text-primary hover:underline">
                    생성된 항목 보기
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          {status === "completed" && reportId ? (
            <p className="mt-5 text-sm text-gray-500">3초 후 상세 페이지로 이동합니다…</p>
          ) : null}
        </section>
      )}
    </div>
  );
}
