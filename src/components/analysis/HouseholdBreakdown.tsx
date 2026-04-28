"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { cn } from "@/lib/utils";
import type { HouseholdBreakdownSection } from "@/types/analysis";

import { SectionCard } from "./SectionCard";

type ComplexRow = { name: string; households: number; distance: number };

function formatDistance(meters: number) {
  if (!Number.isFinite(meters)) return "-";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
  return `${Math.round(meters)}m`;
}

export function HouseholdBreakdown({
  data,
  loading = false,
}: {
  data: HouseholdBreakdownSection;
  loading?: boolean;
}) {
  const complexes: ComplexRow[] = [...(data.complexes ?? [])].sort((a, b) => a.distance - b.distance);
  const maxHouseholds = Math.max(1, ...complexes.map((c) => c.households));
  const hasAny = data.total > 0 && complexes.length > 0;

  return (
    <SectionCard title="🏘️ 주변 세대수" subtitle={`반경 ${data.radiusMeters}m 이내`} loading={loading} skeletonLines={8}>
      {!hasAny ? (
        <p className="text-sm text-muted-foreground">주변 아파트 데이터가 없습니다.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <p className="text-3xl font-bold text-foreground">{data.total.toLocaleString()}세대</p>
            <p className="text-xs text-muted-foreground">총합</p>
          </div>

          {complexes.length >= 5 ? (
            <div className={cn("rounded-xl border border-border bg-muted/10 p-3", "h-[240px]")}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={complexes.slice(0, 10)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    interval={0}
                    tickLine={false}
                    axisLine={false}
                    height={42}
                    tickFormatter={(v: string) => (v.length > 6 ? `${v.slice(0, 6)}…` : v)}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={34}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    contentStyle={{
                      borderRadius: 12,
                      borderColor: "var(--border)",
                      backgroundColor: "var(--background)",
                      color: "var(--foreground)",
                    }}
                    labelStyle={{ color: "var(--muted-foreground)" }}
                    formatter={(value: unknown) => {
                      const n = typeof value === "number" ? value : Number(value);
                      return [Number.isFinite(n) ? `${n.toLocaleString()}세대` : "-", "세대수"];
                    }}
                  />
                  <Bar dataKey="households" radius={[8, 8, 8, 8]} fill="var(--chart-1)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          <div className="space-y-3">
            {complexes.map((c) => {
              const pct = Math.max(0, Math.min(100, Math.round((c.households / maxHouseholds) * 100)));
              return (
                <div key={`${c.name}-${c.distance}`} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium text-foreground">
                      {c.name}
                      <span className="text-muted-foreground"> · </span>
                      <span className="text-muted-foreground">{c.households.toLocaleString()}세대</span>
                      <span className="text-muted-foreground"> · </span>
                      <span className="text-muted-foreground">{formatDistance(c.distance)}</span>
                    </p>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary/80" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
