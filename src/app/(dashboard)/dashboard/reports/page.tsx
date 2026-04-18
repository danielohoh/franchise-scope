"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { FileText, Plus, Trash2, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Recommendation, ReportStatus } from "@/types/database";

export const dynamic = "force-dynamic";

type ReportListItem = {
  id: string;
  address: string;
  report_title: string | null;
  recommendation: Recommendation | null;
  total_score: number | null;
  status: ReportStatus;
  error_message: string | null;
  file_url: string | null;
  created_at: string;
};

type ReportsResponse = { reports: ReportListItem[] };

type ApiError = { error?: string; message?: string };

const FILTER_TABS = [
  "전체",
  "적극추천",
  "조건부추천",
  "재검토필요",
  "반려",
] as const;

type FilterTab = (typeof FILTER_TABS)[number];

const IN_PROGRESS_STATUSES: ReadonlyArray<ReportStatus> = [
  "pending",
  "collecting",
  "analyzing",
  "generating",
];

const RECOMMENDATION_BADGE: Record<Recommendation, string> = {
  적극추천: "bg-emerald-50 text-emerald-700 border-emerald-200",
  조건부추천: "bg-yellow-50 text-yellow-800 border-yellow-200",
  재검토필요: "bg-orange-50 text-orange-800 border-orange-200",
  반려: "bg-red-50 text-red-700 border-red-200",
};

function formatKst(dateIso: string) {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR");
}

function StatusBadge({ status }: { status: ReportStatus }) {
  if (IN_PROGRESS_STATUSES.includes(status)) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500/50 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-blue-600" />
        </span>
        생성 중
      </span>
    );
  }

  if (status === "completed") {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        완료
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
      실패
    </span>
  );
}

function RecommendationBadge({ recommendation }: { recommendation: Recommendation | null }) {
  if (!recommendation) return <span className="text-gray-400">-</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        RECOMMENDATION_BADGE[recommendation] ?? "bg-gray-50 text-gray-700 border-gray-200",
      )}
    >
      {recommendation}
    </span>
  );
}

function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  loading: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs data-starting-style:opacity-0 data-ending-style:opacity-0 transition-opacity duration-150" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gray-100 bg-white p-5 shadow-lg outline-none">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex size-10 items-center justify-center rounded-2xl bg-red-50 text-red-700">
              <Trash2 className="size-5" />
            </div>
            <div className="min-w-0">
              <Dialog.Title className="text-sm font-semibold text-gray-900">{title}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-gray-600">{description}</Dialog.Description>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <Dialog.Close
              render={<Button type="button" variant="outline" className="rounded-xl" disabled={loading} />}
            >
              취소
            </Dialog.Close>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              disabled={loading}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState<FilterTab>("전체");
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReportListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refreshIntervalRef = useRef<number | null>(null);

  const hasInProgress = useMemo(
    () => reports.some((r) => IN_PROGRESS_STATUSES.includes(r.status)),
    [reports],
  );

  async function fetchReports({ showLoading }: { showLoading: boolean }) {
    if (showLoading) setLoading(true);
    else setRefreshing(true);

    try {
      const params = new URLSearchParams();
      if (tab !== "전체") params.set("recommendation", tab);

      const url = params.size > 0 ? `/api/reports?${params.toString()}` : "/api/reports";
      const res = await fetch(url, { method: "GET" });
      const json = (await res.json()) as ReportsResponse | ApiError;

      if (!res.ok) {
        const message = (json as ApiError).error ?? (json as ApiError).message ?? "목록을 불러오지 못했습니다.";
        throw new Error(message);
      }

      setReports((json as ReportsResponse).reports ?? []);
    } catch (error) {
      console.error("[reports] list fetch failed", error);
      toast.error(error instanceof Error ? error.message : "목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void fetchReports({ showLoading: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (!hasInProgress) {
      if (refreshIntervalRef.current) window.clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
      return;
    }

    refreshIntervalRef.current = window.setInterval(() => {
      void fetchReports({ showLoading: false });
    }, 2000);

    return () => {
      if (refreshIntervalRef.current) window.clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInProgress, tab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">보고서</h1>
          <p className="mt-1 text-sm text-gray-500">생성된 상권 분석 보고서를 확인하고 다운로드/관리할 수 있습니다.</p>
        </div>
        <Link href="/dashboard/reports/new" className="shrink-0">
          <Button className="rounded-xl px-4">
            <Plus className="size-4" />
            새 보고서 생성
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTER_TABS.map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
              )}
            >
              {t}
            </button>
          );
        })}

        {refreshing ? <span className="ml-1 text-xs text-gray-400">업데이트 중…</span> : null}
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-0 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-11 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-500">
              <FileText className="size-6" />
            </div>
            <p className="text-sm font-semibold text-gray-900">표시할 보고서가 없습니다</p>
            <p className="mt-1 text-sm text-gray-500">새 보고서를 생성해보세요.</p>
            <div className="mt-5">
              <Link href="/dashboard/reports/new">
                <Button className="rounded-xl px-4">
                  <Plus className="size-4" />
                  새 보고서 생성
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-left text-xs font-semibold text-gray-600">
                  <th className="px-5 py-3">보고서</th>
                  <th className="px-5 py-3">추천의견</th>
                  <th className="px-5 py-3">종합점수</th>
                  <th className="px-5 py-3">상태</th>
                  <th className="px-5 py-3">생성일</th>
                  <th className="px-5 py-3 text-right">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reports.map((r) => {
                  const title = (r.address ?? "").trim();
                  const clipped = title.length > 40 ? `${title.slice(0, 40)}…` : title;

                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <div className="min-w-[220px]">
                          <p className="font-semibold text-gray-900 truncate max-w-[420px]">{clipped || "-"}</p>
                          {r.status === "failed" && r.error_message ? (
                            <p className="mt-1 text-xs text-red-600 truncate max-w-[520px]">{r.error_message}</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <RecommendationBadge recommendation={r.recommendation} />
                      </td>
                      <td className="px-5 py-4 text-gray-700">
                        {r.total_score != null ? (
                          <span className="font-semibold">{r.total_score}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                        <span className="text-gray-400"> / 100</span>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-5 py-4 text-gray-600">{formatKst(r.created_at)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/dashboard/reports/${r.id}`} className="shrink-0">
                            <Button type="button" variant="outline" size="sm" className="rounded-xl">
                              <ExternalLink className="size-4" />
                              상세보기
                            </Button>
                          </Link>

                          {r.file_url ? (
                            <a href={`/api/reports/${r.id}/download`} className="shrink-0">
                              <Button type="button" variant="outline" size="sm" className="rounded-xl">
                                <Download className="size-4" />
                                docx
                              </Button>
                            </a>
                          ) : null}

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-xl"
                            onClick={() => {
                              setDeleteTarget(r);
                              setDeleteOpen(true);
                            }}
                          >
                            <Trash2 className="size-4 text-red-600" />
                            <span className="sr-only">삭제</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
          setDeleteOpen(next);
        }}
        title="보고서를 삭제할까요?"
        description={deleteTarget ? `\"${deleteTarget.address}\" 보고서가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.` : "이 작업은 되돌릴 수 없습니다."}
        confirmLabel={deleting ? "삭제 중..." : "삭제"}
        loading={deleting}
        onConfirm={() => {
          if (!deleteTarget) return;
          void (async () => {
            try {
              setDeleting(true);
              const res = await fetch(`/api/reports?id=${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" });
              const json = (await res.json()) as { success?: boolean } | ApiError;
              if (!res.ok) {
                const message = (json as ApiError).error ?? (json as ApiError).message ?? "삭제에 실패했습니다.";
                throw new Error(message);
              }

              setReports((prev) => prev.filter((r) => r.id !== deleteTarget.id));
              toast.success("삭제되었습니다.");
              setDeleteOpen(false);
              setDeleteTarget(null);
            } catch (error) {
              console.error("[reports] delete failed", error);
              toast.error(error instanceof Error ? error.message : "삭제에 실패했습니다.");
            } finally {
              setDeleting(false);
            }
          })();
        }}
      />
    </div>
  );
}
