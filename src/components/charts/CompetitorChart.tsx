"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { CollectedCompetitorData } from "@/types/analysis";

type CompetitorChartProps = {
  data: CollectedCompetitorData;
};

type ErrorBoundaryProps = { children: React.ReactNode };
type ErrorBoundaryState = { hasError: boolean; message: string | null };

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, message: error instanceof Error ? error.message : "차트 렌더링에 실패했습니다." };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error("[CompetitorChart] render error", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-start gap-2 rounded-xl border border-amber-600/20 bg-amber-500/10 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4" />
          <p>{this.state.message ?? "차트를 표시할 수 없습니다."}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export function CompetitorChart({ data }: CompetitorChartProps) {
  const franchise = data.competitors.filter((c) => c.type === "프랜차이즈").length;
  const indie = data.competitors.filter((c) => c.type === "개인점").length;

  const rows = [
    { name: "프랜차이즈", value: franchise, color: "var(--chart-2)" },
    { name: "개인점", value: indie, color: "var(--chart-5)" },
  ].filter((x) => x.value > 0);

  return (
    <ErrorBoundary>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              formatter={(value) => {
                const n = typeof value === "number" ? value : Number(value);
                return Number.isFinite(n) ? n.toLocaleString("ko-KR") : "-";
              }}
            />
            <Legend />
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius={48} outerRadius={82} paddingAngle={3}>
              {rows.map((r) => (
                <Cell key={r.name} fill={r.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ErrorBoundary>
  );
}
