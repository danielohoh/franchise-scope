"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { toast } from "sonner";

import type { AnalysisStatus, AnalysisSummary, Recommendation } from "@/types/analysis";
import { PageContainer } from "@/components/layout/PageContainer";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AnalysesGetResponse = {
  analyses?: AnalysisSummary[];
  analysis?: AnalysisSummary[];
};

type ApiError = { message?: string; error?: string };

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function statusLabel(status: AnalysisStatus) {
  if (status === "pending") return "대기";
  if (status === "collecting") return "수집 중";
  if (status === "collected") return "수집 완료";
  if (status === "generating") return "보고서 생성";
  if (status === "completed") return "완료";
  return "실패";
}

function statusBadgeClass(status: AnalysisStatus) {
  if (status === "completed") return "bg-emerald-500/10 text-emerald-700 ring-emerald-600/20";
  if (status === "failed") return "bg-rose-500/10 text-rose-700 ring-rose-600/20";
  if (status === "collecting" || status === "generating") return "bg-sky-500/10 text-sky-700 ring-sky-600/20";
  if (status === "collected") return "bg-indigo-500/10 text-indigo-700 ring-indigo-600/20";
  return "bg-muted text-muted-foreground ring-border";
}

function recommendationLabel(value: Recommendation | null) {
  if (!value) return "-";
  return value;
}

export function AnalysisListClient() {
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<AnalysisSummary[]>([]);

  const fetchList = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/analysis", { method: "GET" });

      let json: unknown = null;
      try {
        json = await response.json();
      } catch {
        // ignore
      }

      if (!response.ok) {
        const message =
          json && typeof json === "object" && json !== null && ("message" in json || "error" in json)
            ? (((json as ApiError).message ?? (json as ApiError).error) || "상권분석 목록을 불러오지 못했습니다.")
            : "상권분석 목록을 불러오지 못했습니다.";
        throw new Error(message);
      }

      const data = (json ?? {}) as AnalysesGetResponse;
      const list =
        Array.isArray(data.analyses) ? data.analyses : Array.isArray(data.analysis) ? data.analysis : [];
      setItems(list);
    } catch (e) {
      console.error("[analysis list] fetch failed", e);
      toast.error(e instanceof Error ? e.message : "상권분석 목록을 불러오지 못했습니다.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchList();
  }, [fetchList]);

  return (
    <PageContainer
      title="상권분석"
      description="생성한 상권분석의 진행 상태/결과를 확인하고 보고서를 다운로드할 수 있어요."
      action={
        <Link href="/analysis/new" className={cn(buttonVariants({ size: "lg" }), "rounded-xl")}>
          <Plus className="size-4" />
          새 상권분석
        </Link>
      }
    >
      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-3">
            <div className="h-6 w-40 animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-card-foreground shadow-sm">
          <p className="text-base font-semibold text-foreground">아직 생성된 상권분석이 없습니다.</p>
          <p className="mt-2 text-sm text-muted-foreground">주소 하나로 빠르게 상권분석 보고서를 생성해보세요.</p>
          <div className="mt-6 flex justify-center">
            <Link href="/analysis/new" className={cn(buttonVariants({ size: "lg" }), "rounded-xl")}>
              <Plus className="size-4" />
              새 상권분석 시작
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">주소</th>
                  <th className="px-4 py-3 text-left">브랜드</th>
                  <th className="px-4 py-3 text-left">상태</th>
                  <th className="px-4 py-3 text-left">종합점수</th>
                  <th className="px-4 py-3 text-left">권고</th>
                  <th className="px-4 py-3 text-left">생성일</th>
                  <th className="px-4 py-3 text-right">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <Link
                        href={`/analysis/${a.id}`}
                        className="block min-w-[320px] font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {a.address}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{a.brand_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                          statusBadgeClass(a.status),
                        )}
                      >
                        {statusLabel(a.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {typeof a.total_score === "number" && Number.isFinite(a.total_score) ? (
                        <span className="font-semibold text-foreground tabular-nums">{Math.round(a.total_score)}점</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-foreground">{recommendationLabel(a.recommendation)}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(a.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/analysis/${a.id}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl")}
                      >
                        보기
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
