"use client";

import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip } from "recharts";

import { cn } from "@/lib/utils";
import type { CommercialStatusSection } from "@/types/analysis";

import { SectionCard } from "./SectionCard";

type DensityLevel = CommercialStatusSection["competitionDensity"]["level"];

function densityTone(level: DensityLevel) {
  switch (level) {
    case "낮음":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "보통":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "높음":
      return "border-orange-200 bg-orange-50 text-orange-800";
    case "매우높음":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-border bg-muted text-foreground";
  }
}

function toPercent(ratio: number) {
  if (!Number.isFinite(ratio)) return 0;
  if (ratio <= 1) return Math.round(ratio * 100);
  return Math.round(ratio);
}

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function CommercialStatus({
  data,
  loading = false,
}: {
  data: CommercialStatusSection | null;
  loading?: boolean;
}) {
  if (!loading && !data) {
    return (
      <SectionCard title="🏪 주변 상권 현황">
        <p className="text-sm text-muted-foreground">상권 데이터를 불러올 수 없습니다.</p>
      </SectionCard>
    );
  }

  const dist = (data?.industryDistribution ?? []).slice().sort((a, b) => b.count - a.count);
  const top5 = dist.slice(0, 5);
  const maxCount = Math.max(1, ...top5.map((d) => d.count));

  const density = data?.competitionDensity;
  const densityBadge = density ? (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
        densityTone(density.level),
      )}
      title={`동종 업종 ${density.sameIndustryCount.toLocaleString()} / 전체 ${density.totalShopCount.toLocaleString()}`}
    >
      밀도: {density.level}
    </span>
  ) : null;

  return (
    <SectionCard
      title="🏪 주변 상권 현황"
      subtitle={data ? `반경 ${data.searchRadiusM}m 기준` : undefined}
      rightSlot={densityBadge}
      loading={loading}
      skeletonLines={10}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">총 상가 수</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{data?.total.toLocaleString() ?? "-"}개</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">상권 유형</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{data?.commercialAreaType || "-"}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">동종/전체</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {density ? `${density.sameIndustryCount.toLocaleString()} / ${density.totalShopCount.toLocaleString()}` : "-"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">업종 분포 (Top 5)</p>
              <p className="text-xs text-muted-foreground">비중</p>
            </div>

            {top5.length === 0 ? (
              <p className="text-sm text-muted-foreground">업종 분포 데이터가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {top5.map((d) => {
                  const pct = toPercent(d.ratio);
                  const bar = Math.max(0, Math.min(100, Math.round((d.count / maxCount) * 100)));
                  return (
                    <div key={d.category} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-medium text-foreground">{d.category}</p>
                        <p className="shrink-0 text-xs text-muted-foreground">
                          {d.count.toLocaleString()}개 · {pct}%
                        </p>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-primary/80" style={{ width: `${bar}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {top5.length > 0 ? (
            <div className="rounded-xl border border-border bg-muted/10 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">업종 분포</p>
                <p className="text-xs text-muted-foreground">도넛</p>
              </div>
              <div className="mt-2 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        borderColor: "var(--border)",
                        backgroundColor: "var(--background)",
                        color: "var(--foreground)",
                      }}
                      formatter={(value: unknown, name: unknown) => {
                        const n = typeof value === "number" ? value : Number(value);
                        return [Number.isFinite(n) ? `${n.toLocaleString()}개` : "-", String(name ?? "")];
                      }}
                    />
                    <Pie
                      data={top5}
                      dataKey="count"
                      nameKey="category"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={2}
                      stroke="var(--background)"
                    >
                      {top5.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}
