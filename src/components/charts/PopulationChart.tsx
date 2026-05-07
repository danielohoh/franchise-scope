"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle } from "lucide-react";

import type { CollectedPopulationData } from "@/types/analysis";

type PopulationChartProps = {
  data: CollectedPopulationData;
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
    console.error("[PopulationChart] render error", error);
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

export function PopulationChart({ data }: PopulationChartProps) {
  const rows = [
    { radius: "500m", residential: data.radius_500m.residential, workers: data.radius_500m.workers },
    { radius: "1km", residential: data.radius_1km.residential, workers: data.radius_1km.workers },
    { radius: "2km", residential: data.radius_2km.residential, workers: data.radius_2km.workers },
  ];

  return (
    <ErrorBoundary>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
            <XAxis dataKey="radius" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={48} />
            <Tooltip
              cursor={{ fill: "color-mix(in oklab, var(--chart-1) 10%, transparent)" }}
              formatter={(value) => {
                const n = typeof value === "number" ? value : Number(value);
                return Number.isFinite(n) ? n.toLocaleString("ko-KR") : "-";
              }}
            />
            <Legend />
            <Bar name="주거인구" dataKey="residential" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
            <Bar name="직장인구" dataKey="workers" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ErrorBoundary>
  );
}
