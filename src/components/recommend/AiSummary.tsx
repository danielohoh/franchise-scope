"use client";

import { cn } from "@/lib/utils";

export function AiSummary({
  summary,
  isLoading,
}: {
  summary: string | null;
  isLoading: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">🤖 AI 분석 요약</h2>
        <span className="text-xs text-muted-foreground">요약</span>
      </div>

      <div className="mt-3">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-3 w-11/12 animate-pulse rounded bg-muted" />
            <div className="h-3 w-10/12 animate-pulse rounded bg-muted" />
            <div className="h-3 w-9/12 animate-pulse rounded bg-muted" />
          </div>
        ) : summary ? (
          <p className={cn("text-sm text-foreground leading-relaxed", "whitespace-pre-wrap")}>{summary}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            아직 요약이 없습니다. 결과를 불러오면 AI 분석 요약이 표시됩니다.
          </p>
        )}
      </div>
    </section>
  );
}
