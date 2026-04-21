"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Download, Loader2, RefreshCw, RotateCcw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Recommendation, ReportStatus } from "@/types/database";
import type { ReportAnalysis } from "@/lib/ai/schema";

export const dynamic = "force-dynamic";

type ReportsResponse = { reports: ReportRecord[] };
type BrandGetResponse = { brand: { id: string } | null };
type GenerateResponse = { report_id: string } | { error: string };
type ApiError = { error?: string; message?: string };
type StatusResponse = {
  status: ReportStatus;
  step: number;
  message: string;
  error_message?: string;
  recommendation?: Recommendation;
  total_score?: number;
  file_url?: string;
};

type ReportRecord = {
  id: string;
  brand_id: string | null;
  prospect_id: string | null;
  address: string;
  analysis_result?: unknown;
  recommendation: Recommendation | null;
  total_score: number | null;
  file_url: string | null;
  status: ReportStatus;
  error_message: string | null;
  created_at: string;
  llm_provider?: string | null;
};

// 위험도 정렬 우선순위 (낮을수록 위험)
const RISK_ORDER: Record<string, number> = { 치명적: 0, 높음: 1, 보통: 2, 낮음: 3 };

type CompetitorItem = ReportAnalysis["competitors"][number];

function RiskBadge({ level }: { level: CompetitorItem["risk_level"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        level === "치명적"
          ? "border-red-200 bg-red-50 text-red-700"
          : level === "높음"
            ? "border-orange-200 bg-orange-50 text-orange-800"
            : level === "보통"
              ? "border-gray-200 bg-gray-50 text-gray-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700",
      )}
    >
      {level}
    </span>
  );
}

function CompetitorTable({
  title,
  competitors,
  emptyMessage,
}: {
  title: string;
  competitors: CompetitorItem[];
  emptyMessage: string;
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-gray-700">{title}</p>
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-600">
              <th className="px-4 py-2.5">이름</th>
              <th className="px-4 py-2.5">거리</th>
              <th className="px-4 py-2.5">평점</th>
              <th className="px-4 py-2.5">추정 월매출</th>
              <th className="px-4 py-2.5">위험도</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {competitors.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-gray-400" colSpan={5}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              competitors.map((c) => (
                <tr
                  key={`${c.rank}-${c.name}`}
                  className={
                    c.risk_level === "치명적"
                      ? "bg-red-50/50"
                      : c.risk_level === "높음"
                        ? "bg-orange-50/50"
                        : ""
                  }
                >
                  <td className="max-w-[260px] truncate px-4 py-3 font-semibold text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-gray-700">{formatNumber(Math.round(c.distance_m))}m</td>
                  <td className="px-4 py-3 text-gray-700">{c.rating != null ? c.rating.toFixed(1) : "-"}</td>
                  <td className="px-4 py-3 text-gray-700">{formatCurrency(c.estimated_monthly_revenue)}</td>
                  <td className="px-4 py-3">
                    <RiskBadge level={c.risk_level} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompetitorSection({ competitors }: { competitors: CompetitorItem[] }) {
  const byRisk = (a: CompetitorItem, b: CompetitorItem) =>
    (RISK_ORDER[a.risk_level] ?? 4) - (RISK_ORDER[b.risk_level] ?? 4);

  const franchises = competitors
    .filter((c) => c.type === "프랜차이즈")
    .sort(byRisk)
    .slice(0, 5);

  const individuals = competitors
    .filter((c) => c.type === "개인점")
    .sort(byRisk)
    .slice(0, 5);

  return (
    <section className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-gray-900">경쟁점 현황</h2>
        <p className="mt-1 text-sm text-gray-500">
          프랜차이즈·일반매장 각 최대 5개, 위험도 높은 순 · 추정 월매출 포함
        </p>
      </div>
      <CompetitorTable
        title="🏢 프랜차이즈 경쟁점"
        competitors={franchises}
        emptyMessage="프랜차이즈 경쟁점이 없습니다."
      />
      <CompetitorTable
        title="🏪 일반매장 경쟁점"
        competitors={individuals}
        emptyMessage="일반매장 경쟁점이 없습니다."
      />
    </section>
  );
}

const STATUS_UI: Record<ReportStatus, { step: 1 | 2 | 3 | 4 | 5; message: string }> = {
  pending: { step: 1, message: "📍 주소 분석 중..." },
  collecting: { step: 2, message: "🏘️ 상권 데이터 수집 중..." },
  analyzing: { step: 3, message: "🤖 AI 분석 중..." },
  generating: { step: 4, message: "📄 보고서 문서 생성 중..." },
  completed: { step: 5, message: "✅ 완료!" },
  failed: { step: 1, message: "❌ 실패" },
};

const IN_PROGRESS: ReadonlyArray<ReportStatus> = ["pending", "collecting", "analyzing", "generating"];

const RECOMMENDATION_BADGE: Record<Recommendation, string> = {
  적극추천: "bg-emerald-50 text-emerald-700 border-emerald-200",
  조건부추천: "bg-yellow-50 text-yellow-800 border-yellow-200",
  재검토필요: "bg-orange-50 text-orange-800 border-orange-200",
  반려: "bg-red-50 text-red-700 border-red-200",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatCurrency(value: number) {
  return `${formatNumber(value)}원`;
}

/** 비용 구조 공식으로 월 영업이익 직접 계산 */
function calcOperatingProfit(
  monthlyRevenue: number,
  costSim: ReportAnalysis["cost_simulation"],
): number {
  return (
    monthlyRevenue
    - Math.round(monthlyRevenue * costSim.supply_cost_rate)
    - costSim.labor_and_rent
    - Math.round(monthlyRevenue * costSim.delivery_commission_rate)
    - costSim.royalty_and_others
  );
}

function formatKst(dateIso: string) {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR");
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
      <p className={cn("text-sm font-medium", state === "active" ? "text-gray-900" : "text-gray-700")}>{label}</p>
    </div>
  );
}

function ReportStatusTracker({ status, errorMessage }: { status: ReportStatus; errorMessage?: string | null }) {
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
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
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
        </div>
      ) : null}
    </section>
  );
}

export default function ReportDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const reportId = params.id;

  const [report, setReport] = useState<ReportRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ReportStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const pollIntervalRef = useRef<number | null>(null);

  async function fetchReport() {
    try {
      const res = await fetch("/api/reports", { method: "GET" });
      const json = (await res.json()) as ReportsResponse | ApiError;
      if (!res.ok) {
        const message = (json as ApiError).error ?? (json as ApiError).message ?? "보고서를 불러오지 못했습니다.";
        throw new Error(message);
      }

      const found = (json as ReportsResponse).reports.find((r) => r.id === reportId) ?? null;
      setReport(found);
      setStatus(found?.status ?? null);
    } catch (error) {
      console.error("[reports/detail] fetchReport failed", error);
      toast.error(error instanceof Error ? error.message : "보고서를 불러오지 못했습니다.");
      setReport(null);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  useEffect(() => {
    if (!reportId) return;
    if (!status || !IN_PROGRESS.includes(status)) {
      if (pollIntervalRef.current) window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
      return;
    }

    let cancelled = false;

    async function pollStatus() {
      try {
        const res = await fetch(`/api/reports/${reportId}/status`, { method: "GET" });
        const json = (await res.json()) as StatusResponse | ApiError;

        if (!res.ok) {
          const message = (json as ApiError).error ?? (json as ApiError).message ?? "상태 조회에 실패했습니다.";
          throw new Error(message);
        }

        if (cancelled) return;

        const nextStatus = (json as StatusResponse).status;
        setStatus(nextStatus);
        setStatusError((json as StatusResponse).error_message ?? null);

        if (nextStatus === "completed" || nextStatus === "failed") {
          if (pollIntervalRef.current) window.clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          await fetchReport();
        }
      } catch (error) {
        console.error("[reports/detail] pollStatus failed", error);
      }
    }

    void pollStatus();
    pollIntervalRef.current = window.setInterval(() => {
      void pollStatus();
    }, 2000);

    return () => {
      cancelled = true;
      if (pollIntervalRef.current) window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, status]);

  const analysis = (report?.analysis_result as ReportAnalysis | null) ?? null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-56 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />
        <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-5">
        <Link href="/dashboard/reports" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary">
          <ArrowLeft className="size-4" /> 목록으로
        </Link>
        <section className="rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm">
          <p className="text-sm font-semibold text-gray-900">보고서를 찾을 수 없습니다</p>
          <p className="mt-1 text-sm text-gray-500">삭제되었거나 접근 권한이 없을 수 있습니다.</p>
          <div className="mt-5">
            <Link href="/dashboard/reports">
              <Button className="rounded-xl">목록으로</Button>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const score = report.total_score ?? analysis?.evaluation.total ?? null;
  const recommendation = report.recommendation ?? analysis?.recommendation ?? null;
    const alert =
      analysis?.alert?.alert_type && analysis.alert.alert_type !== "none" ? analysis.alert : null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/dashboard/reports" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary">
          <ArrowLeft className="size-4" /> 목록으로
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 break-words">{report.address}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
              <span>생성: {formatKst(report.created_at)}</span>
              <span>LLM: {report.llm_provider ?? "-"}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {report.file_url ? (
              <a href={`/api/reports/${report.id}/download`}>
                <Button className="rounded-xl px-4">
                  <Download className="size-4" />
                  docx 다운로드
                </Button>
              </a>
            ) : (
              <Button className="rounded-xl px-4" disabled>
                <Download className="size-4" />
                docx 다운로드
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              className="rounded-xl px-4"
              disabled={regenerating}
              onClick={() => {
                void (async () => {
                  try {
                    setRegenerating(true);

                    const brandRes = await fetch("/api/brands", { method: "GET" });
                    const brandJson = (await brandRes.json()) as BrandGetResponse | ApiError;
                    if (!brandRes.ok) {
                      const message = (brandJson as ApiError).error ?? (brandJson as ApiError).message ?? "브랜드 조회에 실패했습니다.";
                      throw new Error(message);
                    }
                    const brandId = (brandJson as BrandGetResponse).brand?.id;
                    if (!brandId) {
                      throw new Error("브랜드 정보를 찾을 수 없습니다. 먼저 브랜드를 등록해주세요.");
                    }

                    const generateRes = await fetch("/api/reports/generate", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        brand_id: brandId,
                        address: report.address,
                        ...(report.prospect_id ? { prospect_id: report.prospect_id } : {}),
                      }),
                    });
                    const generateJson = (await generateRes.json()) as GenerateResponse;
                    if (!generateRes.ok) {
                      const message = "error" in generateJson ? generateJson.error : "재생성 요청에 실패했습니다.";
                      throw new Error(message);
                    }

                    const nextId = (generateJson as { report_id: string }).report_id;
                    void fetch(`/api/reports/${nextId}/run`, { method: "POST" }).catch((error) => {
                      console.error("[reports/detail] run trigger failed", error);
                    });

                    toast.success("재생성을 시작했습니다.");
                    router.push(`/dashboard/reports/${nextId}`);
                  } catch (error) {
                    console.error("[reports/detail] regenerate failed", error);
                    toast.error(error instanceof Error ? error.message : "재생성에 실패했습니다.");
                  } finally {
                    setRegenerating(false);
                  }
                })();
              }}
            >
              {regenerating ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              재생성
            </Button>
          </div>
        </div>
      </div>

      {status && status !== "completed" ? (
        <ReportStatusTracker status={status} errorMessage={statusError ?? report.error_message} />
      ) : null}

      {status === "failed" ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-semibold text-red-700">생성 실패</p>
          <p className="mt-1 text-sm text-red-700/90">{statusError ?? report.error_message ?? "알 수 없는 오류"}</p>
          <div className="mt-4">
            <Link href="/dashboard/reports/new">
              <Button variant="outline" className="rounded-xl">
                <RefreshCw className="size-4" />
                새로 생성하기
              </Button>
            </Link>
          </div>
        </div>
      ) : null}

      {status === "completed" ? (
        <>
          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">종합 평가</p>
                <p className="mt-1 text-sm text-gray-500">분석 결과를 요약한 최종 권고입니다.</p>
              </div>
              {recommendation ? (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-semibold",
                    RECOMMENDATION_BADGE[recommendation] ?? "bg-gray-50 text-gray-700 border-gray-200",
                  )}
                >
                  {recommendation}
                </span>
              ) : null}
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-[240px,1fr]">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <p className="text-xs font-semibold text-gray-500">총점</p>
                <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900">
                  {score != null ? score : "-"}
                  <span className="text-base font-semibold text-gray-400"> / 100</span>
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-5">
                <p className="text-xs font-semibold text-gray-500">권고 사유</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-700">
                  {analysis?.recommendation_reason ?? "권고 사유를 불러올 수 없습니다."}
                </p>
              </div>
            </div>

            {alert ? (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 size-5 text-red-700" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-red-800">⚠ 동일 건물/근접 경쟁점 감지</p>
                    <p className="mt-1 text-sm text-red-700/90">
                      {alert.competitor_name} — {alert.detail}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          {!analysis ? (
            <section className="rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm">
              <p className="text-sm font-semibold text-gray-900">분석 결과가 없습니다</p>
              <p className="mt-1 text-sm text-gray-500">analysis_result가 저장되지 않았거나 조회할 수 없습니다.</p>
            </section>
          ) : (
            <div className="space-y-6">
              <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">배후 인구</h2>
                  <p className="mt-1 text-sm text-gray-500">반경별 주거/세대/직장 인구 요약</p>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-600">
                        <th className="py-2 pr-4">반경</th>
                        <th className="py-2 pr-4">주거인구</th>
                        <th className="py-2 pr-4">세대수</th>
                        <th className="py-2">직장인구</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(
                        [
                          { label: "500m", data: analysis.population.radius_500m },
                          { label: "1km", data: analysis.population.radius_1km },
                          { label: "2km", data: analysis.population.radius_2km },
                        ] as const
                      ).map((row) => (
                        <tr key={row.label}>
                          <td className="py-3 pr-4 font-semibold text-gray-900">{row.label}</td>
                          <td className="py-3 pr-4 text-gray-700">{formatNumber(row.data.residential)}</td>
                          <td className="py-3 pr-4 text-gray-700">{formatNumber(row.data.households)}</td>
                          <td className="py-3 text-gray-700">{formatNumber(row.data.workers)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-xs font-semibold text-gray-500">핵심 연령대</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{analysis.population.core_age_group}</p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-xs font-semibold text-gray-500">성별 비율</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{analysis.population.gender_ratio}</p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-xs font-semibold text-gray-500">상권 유형</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{analysis.population.commercial_area_type}</p>
                  </div>
                </div>
              </section>

              {/* ── 입지 조건 ── */}
              <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">입지 조건</h2>
                  <p className="mt-1 text-sm text-gray-500">보증금·임대료 등 임차 비용 정보</p>
                </div>

                <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-4">
                  {(
                    [
                      { label: "보증금", value: analysis.location_info.deposit },
                      { label: "권리금", value: analysis.location_info.key_money },
                      { label: "월 임대료", value: analysis.location_info.monthly_rent },
                      { label: "관리비 (월)", value: analysis.location_info.maintenance_fee },
                    ] as const
                  ).map(({ label, value }) => (
                    <div key={label} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-xs font-semibold text-gray-500">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">{formatCurrency(value)}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2">
                  <span className="text-xs text-blue-700">
                    월 고정 임차비용: <strong>{formatCurrency(analysis.location_info.monthly_rent + analysis.location_info.maintenance_fee)}</strong>
                    {" "}(임대료 + 관리비) · 추정 면적: <strong>{analysis.location_info.estimated_area_pyeong}평</strong>
                  </span>
                </div>
              </section>

              <CompetitorSection competitors={analysis.competitors} />

              {/* ── 매출 시뮬레이션 ── */}
              <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">매출 시뮬레이션</h2>
                  <p className="mt-1 text-sm text-gray-500">보수적/기본/낙관적 시나리오 비교</p>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-600">
                        <th className="py-2 pr-4">항목</th>
                        <th className="py-2 pr-4">보수적</th>
                        <th className="py-2 pr-4">기본</th>
                        <th className="py-2">낙관적</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      <tr>
                        <td className="py-3 pr-4 font-semibold text-gray-900">월매출</td>
                        <td className="py-3 pr-4 text-gray-700">{formatCurrency(analysis.revenue_simulation.conservative.monthly_revenue)}</td>
                        <td className="py-3 pr-4 text-gray-900 font-semibold">{formatCurrency(analysis.revenue_simulation.standard.monthly_revenue)}</td>
                        <td className="py-3 text-gray-700">{formatCurrency(analysis.revenue_simulation.optimistic.monthly_revenue)}</td>
                      </tr>
                      <tr>
                        <td className="py-3 pr-4 font-semibold text-gray-900">월영업이익</td>
                        <td className="py-3 pr-4 text-gray-700">{formatCurrency(calcOperatingProfit(analysis.revenue_simulation.conservative.monthly_revenue, analysis.cost_simulation))}</td>
                        <td className="py-3 pr-4 text-gray-900 font-semibold">{formatCurrency(calcOperatingProfit(analysis.revenue_simulation.standard.monthly_revenue, analysis.cost_simulation))}</td>
                        <td className="py-3 text-gray-700">{formatCurrency(calcOperatingProfit(analysis.revenue_simulation.optimistic.monthly_revenue, analysis.cost_simulation))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* ── 비용 구조 (기본 시나리오 기준) ── */}
                <div className="mt-5">
                  <p className="text-xs font-semibold text-gray-500 mb-3">비용 구조 상세 (기본 시나리오 기준)</p>
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-600">
                          <th className="px-4 py-2.5">비용 항목</th>
                          <th className="px-4 py-2.5">산출 기준</th>
                          <th className="px-4 py-2.5 text-right">금액</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        <tr>
                          <td className="px-4 py-3 font-medium text-gray-900">공급원가</td>
                          <td className="px-4 py-3 text-gray-500">월매출 × {Math.round(analysis.cost_simulation.supply_cost_rate * 100)}%</td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {formatCurrency(Math.round(analysis.revenue_simulation.standard.monthly_revenue * analysis.cost_simulation.supply_cost_rate))}
                          </td>
                        </tr>
                        <tr className="bg-blue-50/60">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            인건비 + 임대료
                            <span className="ml-1.5 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">임대 반영</span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            고정비 — 임대료 {formatCurrency(analysis.location_info.monthly_rent)} + 관리비 {formatCurrency(analysis.location_info.maintenance_fee)} 포함
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-blue-700">{formatCurrency(analysis.cost_simulation.labor_and_rent)}</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-medium text-gray-900">배달 수수료</td>
                          <td className="px-4 py-3 text-gray-500">월매출 × {Math.round(analysis.cost_simulation.delivery_commission_rate * 100)}%</td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {formatCurrency(Math.round(analysis.revenue_simulation.standard.monthly_revenue * analysis.cost_simulation.delivery_commission_rate))}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-medium text-gray-900">로열티 등 기타</td>
                          <td className="px-4 py-3 text-gray-500">고정비</td>
                          <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(analysis.cost_simulation.royalty_and_others)}</td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-200 bg-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-900" colSpan={2}>기본 시나리오 월영업이익</td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-700">
                            {formatCurrency(calcOperatingProfit(analysis.revenue_simulation.standard.monthly_revenue, analysis.cost_simulation))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">SWOT 분석</h2>
                  <p className="mt-1 text-sm text-gray-500">핵심 요인을 2x2로 요약합니다.</p>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs font-semibold text-emerald-800">강점 (Strengths)</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-emerald-900">
                      {analysis.swot.strengths.map((s, idx) => (
                        <li key={`${idx}-${s}`}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                    <p className="text-xs font-semibold text-red-800">약점 (Weaknesses)</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-900">
                      {analysis.swot.weaknesses.map((s, idx) => (
                        <li key={`${idx}-${s}`}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <p className="text-xs font-semibold text-blue-800">기회 (Opportunities)</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-blue-900">
                      {analysis.swot.opportunities.map((s, idx) => (
                        <li key={`${idx}-${s}`}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
                    <p className="text-xs font-semibold text-yellow-900">위협 (Threats)</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-yellow-900">
                      {analysis.swot.threats.map((s, idx) => (
                        <li key={`${idx}-${s}`}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">종합 평가 항목</h2>
                  <p className="mt-1 text-sm text-gray-500">항목별 점수와 만점</p>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-600">
                        <th className="py-2 pr-4">항목</th>
                        <th className="py-2 pr-4">점수</th>
                        <th className="py-2">만점</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(
                        [
                          { label: "입지", score: analysis.evaluation.location.score, max: analysis.evaluation.location.max },
                          { label: "수요", score: analysis.evaluation.demand.score, max: analysis.evaluation.demand.max },
                          { label: "경쟁", score: analysis.evaluation.competition.score, max: analysis.evaluation.competition.max },
                          { label: "수익성", score: analysis.evaluation.profitability.score, max: analysis.evaluation.profitability.max },
                          { label: "성장", score: analysis.evaluation.growth.score, max: analysis.evaluation.growth.max },
                          { label: "브랜드 적합", score: analysis.evaluation.brand_fit.score, max: analysis.evaluation.brand_fit.max },
                        ] as const
                      ).map((row) => (
                        <tr key={row.label}>
                          <td className="py-3 pr-4 font-semibold text-gray-900">{row.label}</td>
                          <td className="py-3 pr-4 text-gray-700">{row.score}</td>
                          <td className="py-3 text-gray-700">{row.max}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-100">
                        <td className="py-3 pr-4 font-semibold text-gray-900">총점</td>
                        <td className="py-3 pr-4 font-semibold text-gray-900">{analysis.evaluation.total}</td>
                        <td className="py-3 text-gray-500">/ 100</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {report.file_url ? (
                  <a href={`/api/reports/${report.id}/download`}>
                    <Button className="rounded-xl px-4">
                      <Download className="size-4" />
                      docx 다운로드
                    </Button>
                  </a>
                ) : null}

                <Link href="/dashboard/reports/new">
                  <Button variant="outline" className="rounded-xl px-4">
                    <RefreshCw className="size-4" />
                    새 보고서 생성
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
