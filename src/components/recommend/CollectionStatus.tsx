"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

import { Button } from "@/components/ui/button";

export function CollectionStatus({
  regionCode,
  collectedCount,
  lastCollectedAt,
  status,
  progressCurrent,
  progressTotal,
  progressPage,
  onCollect,
}: {
  regionCode: string | null;
  collectedCount: number;
  lastCollectedAt: Date | null;
  status: "idle" | "collecting" | "done" | "error";
  progressCurrent?: number;
  progressTotal?: number;
  progressPage?: number;
  onCollect?: () => void;
}) {
  const lastCollectedLabel = lastCollectedAt
    ? formatDistanceToNow(lastCollectedAt, { addSuffix: true, locale: ko })
    : null;

  const isCollecting = status === "collecting";
  const hasData = collectedCount > 0;

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* ── 상태 텍스트 ── */}
        <div className="min-w-0 flex-1">
          {!regionCode ? (
            <p className="text-sm text-muted-foreground">지역을 선택해주세요</p>
          ) : isCollecting ? (
            <div className="space-y-2">
              <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                <Loader2 className="size-4 animate-spin text-primary" />
                서버에서 수집 중...
              </p>
              {progressCurrent !== undefined && progressCurrent > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{progressCurrent.toLocaleString()}건 수집됨</span>
                    {progressPage && <span>{progressPage}페이지</span>}
                  </div>
                  {progressTotal !== undefined && progressTotal > 0 && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.round((progressCurrent / progressTotal) * 100))}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : hasData ? (
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">
                수집된 매물:{" "}
                <span className="text-primary">{collectedCount.toLocaleString()}</span>건
              </p>
              <p className="text-xs text-muted-foreground">
                마지막 수집: {lastCollectedLabel ?? "-"}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              이 지역의 수집된 매물이 없습니다.
            </p>
          )}

          {status === "error" && (
            <p className="mt-1 text-xs text-destructive">
              수집 중 오류가 발생했습니다. 다시 시도해주세요.
            </p>
          )}
        </div>

        {/* ── 수집 버튼 ── */}
        {regionCode && onCollect && (
          <Button
            type="button"
            variant={hasData ? "outline" : "default"}
            size="sm"
            className="shrink-0 rounded-xl"
            disabled={isCollecting}
            onClick={onCollect}
          >
            {isCollecting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            {hasData ? "재수집" : "서버에서 수집"}
          </Button>
        )}
      </div>
    </div>
  );
}
