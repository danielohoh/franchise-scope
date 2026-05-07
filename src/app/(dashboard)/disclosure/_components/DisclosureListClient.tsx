"use client";

import * as React from "react";
import Link from "next/link";
import { MoreVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/PageContainer";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Disclosure, DisclosureParseStatus } from "@/types/disclosure";
import { cn } from "@/lib/utils";

export type DisclosureListClientProps = {
  initialBrandId: string | null;
};

type DisclosureListItem = Disclosure & {
  brand_name?: string | null;
  parse_confidence?: number | null;
};

type DisclosuresGetResponse = {
  disclosures: DisclosureListItem[];
};

type ApiError = { message?: string; error?: string };

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseStatusLabel(status: DisclosureParseStatus) {
  if (status === "uploaded") return "업로드됨";
  if (status === "extracting_text") return "텍스트 추출";
  if (status === "parsing") return "파싱 중";
  if (status === "completed") return "완료";
  return "실패";
}

function statusBadgeClass(status: DisclosureParseStatus) {
  if (status === "completed") return "bg-emerald-500/10 text-emerald-700 ring-emerald-600/20";
  if (status === "failed") return "bg-rose-500/10 text-rose-700 ring-rose-600/20";
  if (status === "parsing" || status === "extracting_text")
    return "bg-sky-500/10 text-sky-700 ring-sky-600/20";
  return "bg-muted text-muted-foreground ring-border";
}

function confidenceTone(conf: number | null | undefined) {
  if (typeof conf !== "number" || !Number.isFinite(conf)) return "na";
  if (conf >= 0.8) return "good";
  if (conf >= 0.6) return "mid";
  return "bad";
}

function ConfidenceCell({ value }: { value: number | null | undefined }) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const tone = confidenceTone(value);

  return (
    <div className="min-w-[120px]">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">{percent}%</span>
        <span className="sr-only">신뢰도</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "good" ? "bg-emerald-600" : tone === "mid" ? "bg-amber-500" : "bg-rose-600",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function DisclosureListClient({ initialBrandId }: DisclosureListClientProps) {
  const [brandId] = React.useState<string | null>(initialBrandId);
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<DisclosureListItem[]>([]);

  const fetchList = React.useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL("/api/disclosure", window.location.origin);
      if (brandId) url.searchParams.set("brand_id", brandId);

      const response = await fetch(url.toString(), { method: "GET" });
      let json: unknown = null;

      try {
        json = await response.json();
      } catch {
        // ignore
      }

      if (!response.ok) {
        const message =
          json && typeof json === "object" && json !== null && ("message" in json || "error" in json)
            ? (((json as ApiError).message ?? (json as ApiError).error) || "정보공개서 목록을 불러오지 못했습니다.")
            : "정보공개서 목록을 불러오지 못했습니다.";
        throw new Error(message);
      }

      const data = (json ?? {}) as DisclosuresGetResponse;
      setItems(Array.isArray(data.disclosures) ? data.disclosures : []);
    } catch (error) {
      console.error("[disclosure list] fetch failed", error);
      toast.error(error instanceof Error ? error.message : "정보공개서 목록을 불러오지 못했습니다.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  React.useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const handleDelete = React.useCallback(
    async (id: string) => {
      const ok = window.confirm("정보공개서를 삭제할까요? 이 작업은 되돌릴 수 없습니다.");
      if (!ok) return;

      try {
        const response = await fetch(`/api/disclosure/${encodeURIComponent(id)}`, { method: "DELETE" });
        let json: unknown = null;
        try {
          json = await response.json();
        } catch {
          // ignore
        }
        if (!response.ok) {
          const message =
            json && typeof json === "object" && json !== null && ("message" in json || "error" in json)
              ? (((json as ApiError).message ?? (json as ApiError).error) || "삭제에 실패했습니다.")
              : "삭제에 실패했습니다.";
          throw new Error(message);
        }

        toast.success("삭제되었습니다.");
        setItems((prev) => prev.filter((x) => x.id !== id));
      } catch (error) {
        console.error("[disclosure list] delete failed", error);
        toast.error(error instanceof Error ? error.message : "삭제에 실패했습니다.");
      }
    },
    [],
  );

  return (
    <PageContainer
      title="정보공개서 관리"
      description="업로드한 정보공개서의 파싱 상태를 확인하고, 검토/수정할 수 있습니다."
      action={
        <Link href="/disclosure/upload" className={cn(buttonVariants({ size: "lg" }), "rounded-xl")}
        >
          <Plus className="size-4" />
          정보공개서 업로드
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
          <p className="text-base font-semibold text-foreground">아직 업로드된 정보공개서가 없습니다.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            PDF를 업로드하면 자동 파싱이 시작되고, 결과를 검토/수정할 수 있어요.
          </p>
          <div className="mt-6 flex justify-center">
            <Link href="/disclosure/upload" className={cn(buttonVariants({ size: "lg" }), "rounded-xl")}
            >
              <Plus className="size-4" />
              정보공개서 업로드
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[960px] w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">브랜드</th>
                  <th className="px-4 py-3 text-left">파일명</th>
                  <th className="px-4 py-3 text-left">등록일</th>
                  <th className="px-4 py-3 text-left">파싱 상태</th>
                  <th className="px-4 py-3 text-left">신뢰도</th>
                  <th className="px-4 py-3 text-right">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{d.brand_name ?? "-"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/disclosure/${d.id}`}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {d.file_name}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">{Math.round(d.file_size / 1024)}KB</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(d.created_at)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                          statusBadgeClass(d.parse_status),
                        )}
                      >
                        {parseStatusLabel(d.parse_status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ConfidenceCell value={d.parse_confidence ?? null} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="rounded-xl"
                            />
                          }
                        >
                          <MoreVertical className="size-4" />
                          <span className="sr-only">메뉴</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            onSelect={() => {
                              window.location.assign(`/disclosure/${d.id}`);
                            }}
                          >
                            상세 보기
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => {
                              void handleDelete(d.id);
                            }}
                          >
                            <Trash2 className="size-4" />
                            삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-end">
        <Button type="button" variant="secondary" className="rounded-xl" onClick={() => void fetchList()}>
          새로고침
        </Button>
      </div>
    </PageContainer>
  );
}
