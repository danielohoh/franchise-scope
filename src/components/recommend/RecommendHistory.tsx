"use client";

import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DbRecommendationResult } from "@/types/recommend";

function formatMMDD(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}.${dd}`;
}

function clip(text: string, max = 20) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function RecommendHistory({
  history,
  onSelect,
}: {
  history: DbRecommendationResult[];
  onSelect: (result: DbRecommendationResult) => void;
}) {
  if (history.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        아직 추천 이력이 없습니다. 조건을 입력하고 첫 추천을 받아보세요.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {history.map((h) => (
        <button
          key={h.id}
          type="button"
          onClick={() => onSelect(h)}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border border-border bg-background px-3 py-2",
            "text-left transition hover:bg-muted/40",
          )}
        >
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Clock className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {(h.region_name ?? "-").trim() || "-"} | {clip(h.prompt_text)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{h.result_count}건 매칭</p>
          </div>
          <div className="shrink-0 text-xs text-muted-foreground">{formatMMDD(h.created_at)}</div>
        </button>
      ))}
    </div>
  );
}
