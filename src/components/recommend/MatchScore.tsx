"use client";

import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function MatchScore({ score, reasons }: { score: number; reasons: string[] }) {
  const clamped = Math.max(0, Math.min(100, score));

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">매칭 점수</p>
          <p className="mt-1 text-xs text-muted-foreground">조건과 주변 데이터 기반 AI 적합도</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-foreground">{Math.round(clamped)}%</p>
        </div>
      </div>

      <div className="mt-3 h-2 w-full rounded-full bg-muted">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${clamped}%` }} />
      </div>

      {reasons.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {reasons.map((r, idx) => (
            <span
              key={`${r}-${idx}`}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border",
                "border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700",
              )}
            >
              <CheckCircle2 className="size-3.5" />
              {r}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">매칭 이유가 없습니다.</p>
      )}
    </div>
  );
}
