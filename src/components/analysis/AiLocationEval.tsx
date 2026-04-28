"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { LocationEval } from "@/types/analysis";

import { SectionCard } from "./SectionCard";

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-500";
  if (score >= 61) return "text-orange-500";
  return "text-red-500";
}

function clampScore(score: number) {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function ScoreDonut({ score }: { score: number }) {
  const v = clampScore(score);
  const r = 34;
  const c = 2 * Math.PI * r;
  const dash = (v / 100) * c;
  const tone = scoreTone(v);

  return (
    <div className="relative grid place-items-center">
      <svg width="96" height="96" viewBox="0 0 96 96" className="block">
        <circle cx="48" cy="48" r={r} stroke="var(--muted)" strokeWidth="10" fill="none" />
        <circle
          cx="48"
          cy="48"
          r={r}
          stroke="currentColor"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform="rotate(-90 48 48)"
          className={cn("transition-all duration-500", tone)}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-bold text-foreground">{v}</p>
        <p className="text-[11px] text-muted-foreground">/ 100점</p>
      </div>
    </div>
  );
}

function Chip({
  tone,
  icon,
  children,
}: {
  tone: "good" | "warn" | "info";
  icon?: "check" | "alert";
  children: string;
}) {
  const Icon = icon === "check" ? CheckCircle2 : icon === "alert" ? AlertCircle : null;

  const cls =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warn"
        ? "border-orange-200 bg-orange-50 text-orange-800"
        : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium", cls)}>
      {Icon ? <Icon className="size-3.5" /> : null}
      {children}
    </span>
  );
}

export function AiLocationEval({
  data,
  loading = false,
}: {
  data: LocationEval | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <SectionCard title="🤖 AI 입지 종합 평가">
        <p className="text-sm text-muted-foreground">AI가 분석 중입니다...</p>
        <div className="mt-3 space-y-2">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "h-3 animate-pulse rounded bg-muted",
                idx % 3 === 0 ? "w-11/12" : idx % 3 === 1 ? "w-10/12" : "w-9/12",
              )}
            />
          ))}
        </div>
      </SectionCard>
    );
  }

  if (!data) {
    return (
      <SectionCard title="🤖 AI 입지 종합 평가">
        <p className="text-sm text-muted-foreground">AI 분석 결과를 불러올 수 없습니다.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="🤖 AI 입지 종합 평가">
      <div className="space-y-4">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <ScoreDonut score={data.overallScore} />

          <div className="min-w-0 flex-1 space-y-3">
            {data.verdict ? (
              <p className="text-sm leading-relaxed text-foreground">{data.verdict}</p>
            ) : (
              <p className="text-sm text-muted-foreground">평가 문장이 없습니다.</p>
            )}
          </div>
        </div>

        {data.strengths.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">강점</p>
            <div className="flex flex-wrap gap-2">
              {data.strengths.map((s, idx) => (
                <Chip key={`${s}-${idx}`} tone="good" icon="check">
                  {s}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}

        {data.weaknesses.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">약점</p>
            <div className="flex flex-wrap gap-2">
              {data.weaknesses.map((w, idx) => (
                <Chip key={`${w}-${idx}`} tone="warn" icon="alert">
                  {w}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}

        {data.recommendedIndustries.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">추천 업종</p>
            <div className="flex flex-wrap gap-2">
              {data.recommendedIndustries.map((r, idx) => (
                <Chip key={`${r}-${idx}`} tone="info">
                  {r}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
