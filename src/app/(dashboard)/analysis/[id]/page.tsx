"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import type {
  AnalysisStatus,
  AnalysisWithData,
  CollectedCompetitorData,
  CollectedPopulationData,
} from "@/types/analysis";
import { PageContainer } from "@/components/layout/PageContainer";
import { CollectionProgress } from "@/components/analysis/CollectionProgress";
import { ReportViewer } from "@/components/analysis/ReportViewer";
import { AnalysisMap } from "@/components/analysis/AnalysisMap";
import { DocxDownloadButton } from "@/components/analysis/DocxDownloadButton";
import { PopulationChart } from "@/components/charts/PopulationChart";
import { CompetitorChart } from "@/components/charts/CompetitorChart";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ApiError = { message?: string; error?: string };

type AnalysisGetResponse = {
  analysis?: AnalysisWithData;
  data?: AnalysisWithData;
};

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

function tryJson<T>(value: unknown): T | null {
  if (!value || typeof value !== "object") return null;
  return value as T;
}

export default function AnalysisDetailPage() {
  const params = useParams();
  const router = useRouter();

  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<AnalysisWithData | null>(null);

  const fetchOne = React.useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/analysis/${encodeURIComponent(id)}`, { method: "GET" });
      let json: unknown = null;
      try {
        json = await response.json();
      } catch {
        // ignore
      }

      if (!response.ok) {
        const msg =
          json && typeof json === "object" && json !== null && ("message" in json || "error" in json)
            ? (((json as ApiError).message ?? (json as ApiError).error) || "상권분석을 불러오지 못했습니다.")
            : "상권분석을 불러오지 못했습니다.";
        throw new Error(msg);
      }

      const payload = (json ?? {}) as AnalysisGetResponse;
      const a = payload.analysis ?? payload.data ?? null;
      setData(a);
    } catch (e) {
      console.error("[analysis detail] fetch failed", e);
      toast.error(e instanceof Error ? e.message : "상권분석을 불러오지 못했습니다.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    void fetchOne();
  }, [fetchOne]);

  const analysis = data?.analysis ?? null;
  const status = analysis?.status ?? ("pending" as AnalysisStatus);

  const population = tryJson<CollectedPopulationData>(data?.collected_data?.population_data ?? null);
  const competitors = tryJson<CollectedCompetitorData>(data?.collected_data?.competitor_data ?? null);

  return (
    <PageContainer
      title="상권분석 결과"
      description={analysis ? `${analysis.address}` : "분석 정보를 불러오는 중입니다."}
      backHref="/analysis"
      action={
        analysis ? (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1",
                statusBadgeClass(status),
              )}
            >
              {statusLabel(status)}
            </span>
            <DocxDownloadButton analysisId={analysis.id} disabled={status !== "completed"} />
          </div>
        ) : null
      }
    >
      {loading ? (
        <div className="space-y-4">
          <div className="h-28 animate-pulse rounded-2xl bg-muted" />
          <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : !data || !analysis ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-card-foreground shadow-sm">
          <p className="text-base font-semibold text-foreground">상권분석을 찾을 수 없습니다.</p>
          <p className="mt-2 text-sm text-muted-foreground">목록으로 돌아가 다시 시도해주세요.</p>
          <div className="mt-6 flex justify-center">
            <Link href="/analysis" className={cn(buttonVariants({ variant: "default" }), "rounded-xl")}>
              목록으로
            </Link>
          </div>
        </div>
      ) : status === "collecting" ? (
        <CollectionProgress
          analysisId={analysis.id}
          brand={{ id: data.brand.id, industry: data.brand.industry, category: data.brand.category ?? null }}
          lat={analysis.latitude}
          lng={analysis.longitude}
          targetSizePyeong={analysis.target_size_pyeong ?? undefined}
          onComplete={() => {
            void fetchOne();
          }}
        />
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">요약</p>
                <p className="text-lg font-semibold tracking-tight text-foreground">{data.brand.brand_name}</p>
                <p className="text-sm text-muted-foreground">{analysis.address}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">종합점수</p>
                  <p className="mt-1 text-base font-semibold text-foreground tabular-nums">
                    {typeof analysis.total_score === "number" ? `${Math.round(analysis.total_score)}점` : "-"}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">권고</p>
                  <p className="mt-1 text-base font-semibold text-foreground">{analysis.recommendation ?? "-"}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">상태</p>
                  <p className="mt-1 text-base font-semibold text-foreground">{statusLabel(status)}</p>
                </div>
              </div>
            </div>

            {analysis.error_message && status === "failed" ? (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-600/20 bg-amber-500/10 p-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 size-4" />
                <p>{analysis.error_message}</p>
              </div>
            ) : null}
          </section>

          {competitors?.competitors ? (
            <AnalysisMap
              lat={analysis.latitude}
              lng={analysis.longitude}
              competitors={competitors.competitors}
              brandName={data.brand.brand_name}
            />
          ) : (
            <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
              <p className="text-sm font-semibold text-foreground">경쟁점 지도</p>
              <p className="mt-2 text-sm text-muted-foreground">경쟁점 데이터가 아직 없습니다.</p>
            </section>
          )}

          {competitors?.competitors && competitors.competitors.length > 0 ? (
            <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">주요 경쟁점 현황</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    거리순 상위 10개 · 예상매출은 리뷰수 기반 추정치
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  총 {competitors.total}개
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-2 pr-4 text-left text-xs font-medium text-muted-foreground">순위</th>
                      <th className="pb-2 pr-4 text-left text-xs font-medium text-muted-foreground">상호</th>
                      <th className="pb-2 pr-4 text-right text-xs font-medium text-muted-foreground">거리</th>
                      <th className="pb-2 pr-4 text-right text-xs font-medium text-muted-foreground">예상매출(추정)</th>
                      <th className="pb-2 text-left text-xs font-medium text-muted-foreground">구분</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[...competitors.competitors]
                      .sort((a, b) => a.distance_m - b.distance_m)
                      .slice(0, 10)
                      .map((c, i) => {
                        const distLabel =
                          c.distance_m >= 1000
                            ? `${(c.distance_m / 1000).toFixed(1)}km`
                            : `${c.distance_m}m`;
                        const estRevenue =
                          c.review_count > 0
                            ? `약 ${Math.round((c.review_count * 200) / 100) * 100 > 0 ? Math.round(c.review_count * 200).toLocaleString() : "-"}만원`
                            : "-";
                        const isFranchise = c.type === "프랜차이즈";
                        return (
                          <tr key={c.place_id} className="group">
                            <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">{i + 1}</td>
                            <td className="py-2.5 pr-4">
                              <div className="max-w-[200px]">
                                <p className="truncate font-medium text-foreground">{c.name}</p>
                                {c.rating != null ? (
                                  <p className="mt-0.5 text-xs text-muted-foreground">
                                    ★ {c.rating.toFixed(1)} ({c.review_count}개 리뷰)
                                  </p>
                                ) : null}
                              </div>
                            </td>
                            <td className="py-2.5 pr-4 text-right tabular-nums text-foreground">{distLabel}</td>
                            <td className="py-2.5 pr-4 text-right tabular-nums text-foreground">{estRevenue}</td>
                            <td className="py-2.5">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1",
                                  isFranchise
                                    ? "bg-violet-500/10 text-violet-700 ring-violet-600/20"
                                    : "bg-sky-500/10 text-sky-700 ring-sky-600/20",
                                )}
                              >
                                {c.type}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
              <p className="text-sm font-semibold text-foreground">인구 (반경별)</p>
              <p className="mt-1 text-sm text-muted-foreground">500m/1km/2km 기준 주거/직장인구</p>
              <div className="mt-4">
                {population ? (
                  <PopulationChart data={population} />
                ) : (
                  <div className="rounded-xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">
                    인구 데이터가 아직 없습니다.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
              <p className="text-sm font-semibold text-foreground">경쟁점 구성</p>
              <p className="mt-1 text-sm text-muted-foreground">프랜차이즈 vs 개인점</p>
              <div className="mt-4">
                {competitors ? (
                  <CompetitorChart data={competitors} />
                ) : (
                  <div className="rounded-xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">
                    경쟁점 데이터가 아직 없습니다.
                  </div>
                )}
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">보고서</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {status === "completed" ? "생성된 보고서를 확인하세요." : "보고서를 생성 중입니다."}
                </p>
              </div>
              <Link
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  void fetchOne();
                  toast.success("새로고침했습니다.");
                }}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl")}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                새로고침
              </Link>
            </div>

            <div className="mt-5">
              <ReportViewer
                analysisId={analysis.id}
                onCompleteAction={(score, rec) => {
                  toast.success(`보고서 완료 · ${Math.round(score)}점`);
                  toast.message(rec);
                  router.refresh();
                }}
              />
            </div>
          </section>
        </div>
      )}
    </PageContainer>
  );
}
