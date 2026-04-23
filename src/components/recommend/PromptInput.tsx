"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "1층, 30평대, 월세 200만원 이하",
  "대단지 앞 근린상가, 주차 가능한 50평",
  "역세권 상가, 매매가 5억 이하",
  "주변 아파트 2만세대 이상, 50평 내외, 주차가능",
] as const;

export function PromptInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  disabled: boolean;
}) {
  const canSubmit = !disabled && !isLoading && value.trim().length > 0;

  return (
    <section className="space-y-3">
      <div>
        <label className="text-sm font-semibold text-foreground">어떤 매장을 찾으시나요?</label>
        <p className="mt-1 text-xs text-muted-foreground">
          원하는 조건을 자연어로 입력하면 AI가 수집된 매물 중에서 가장 적합한 후보를 추천합니다.
        </p>
      </div>

      <textarea
        rows={4}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="예: 1층, 40평 내외, 월세 200만원 이하, 주차 가능"
        className={cn(
          "w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:bg-muted",
        )}
      />

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            disabled={disabled || isLoading}
            onClick={() => onChange(example)}
            className={cn(
              "inline-flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium",
              "text-muted-foreground hover:bg-muted hover:text-foreground transition",
              "disabled:opacity-50 disabled:pointer-events-none",
            )}
          >
            {example}
          </button>
        ))}
      </div>

      <Button
        type="button"
        className="w-full rounded-xl px-4 py-2.5"
        disabled={!canSubmit}
        onClick={onSubmit}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            분석 중...
          </span>
        ) : (
          "🔍 AI 추천 받기"
        )}
      </Button>
    </section>
  );
}
