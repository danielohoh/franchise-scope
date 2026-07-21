"use client";

import { cn } from "@/lib/utils";
import type { InvestmentSection } from "@/types/analysis";

import { SectionCard } from "./SectionCard";

function fmtWan(value: number | null | undefined) {
  if (value == null) return "-";
  return `${value.toLocaleString()}만원`;
}

export function InvestmentAnalysis({
  data,
  loading = false,
}: {
  data: InvestmentSection;
  loading?: boolean;
}) {
  const kpis = [
    {
      label: "월세/평",
      value: data.pricePerPyeong.monthlyRent != null ? `${data.pricePerPyeong.monthlyRent}만/평` : "-",
    },
    {
      label: "보증금/평",
      value: data.pricePerPyeong.deposit != null ? `${data.pricePerPyeong.deposit}만/평` : "-",
    },
    {
      label: "연간 임대료",
      value: data.annualCost.rent != null ? fmtWan(data.annualCost.rent) : "-",
    },
    {
      label: "표면수익률 (매매만)",
      value: data.surfaceYieldPercent != null ? `${data.surfaceYieldPercent}%` : "N/A (월세)",
    },
  ] as const;

  const scenarios = data.breakEvenScenarios;

  return (
    <SectionCard title="💰 투자 수익성 분석" subtitle={data.tradeType ? `거래 유형: ${data.tradeType}` : undefined} loading={loading} skeletonLines={10}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className={cn("rounded-lg border border-border bg-muted/20 p-3", "min-h-[68px]")}
            >
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{k.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-background p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">BEP 시나리오</p>
            <p className="text-xs text-muted-foreground">월 마진 기반 회수 추정</p>
          </div>

          {scenarios && scenarios.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-2">시나리오</th>
                    <th className="px-2">월 마진</th>
                    <th className="px-2">회수 기간</th>
                    <th className="px-2">연수 환산</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((s) => {
                    const years = s.breakEvenMonths / 12;
                    return (
                      <tr key={s.label} className="rounded-lg">
                        <td className="px-2 py-2">
                          <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
                            {s.label}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-sm font-medium text-foreground">{fmtWan(s.monthlyMargin)}</td>
                        <td className="px-2 py-2 text-sm text-foreground">{s.breakEvenMonths.toLocaleString()}개월</td>
                        <td className="px-2 py-2 text-sm text-muted-foreground">{years.toFixed(1)}년</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">BEP 시나리오 데이터가 없습니다.</p>
          )}

          <p className="mt-3 text-xs text-muted-foreground">⚠️ 추정치 (시설투자비 포함, 운영 이익 기준)</p>
        </div>
      </div>
    </SectionCard>
  );
}
