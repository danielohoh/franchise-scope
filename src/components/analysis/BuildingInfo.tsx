"use client";

import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { BuildingInfoSection } from "@/types/analysis";

import { SectionCard } from "./SectionCard";

export function BuildingInfo({
  data,
  loading = false,
}: {
  data: BuildingInfoSection | null;
  loading?: boolean;
}) {
  if (!loading && !data) {
    return (
      <SectionCard title="🏢 건물 기본 정보">
        <p className="text-sm text-muted-foreground">건축물대장 데이터를 불러올 수 없습니다.</p>
      </SectionCard>
    );
  }

  const items: Array<{ label: string; value: string }> = [
    {
      label: "준공연도",
      value: data?.builtYear ? `${data.builtYear}년` : "미확인",
    },
    {
      label: "지상층수",
      value: data?.groundFloors ? `${data.groundFloors}층` : "미확인",
    },
    {
      label: "지하층수",
      value: data?.undergroundFloors ? `${data.undergroundFloors}층` : "-",
    },
    {
      label: "주차대수",
      value: data?.parkingCount ? `${data.parkingCount}대` : "미확인",
    },
    {
      label: "주용도",
      value: (data?.mainPurpose ?? "").trim() || "미확인",
    },
    {
      label: "연면적",
      value: data?.totalArea != null ? `${data.totalArea.toLocaleString()}㎡` : "미확인",
    },
  ];

  const rightSlot = data?.isNeighborhoodFacility ? (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border",
        "border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700",
      )}
    >
      <CheckCircle2 className="size-3.5" />
      ✓ 근린생활시설
    </span>
  ) : null;

  return (
    <SectionCard
      title="🏢 건물 기본 정보"
      rightSlot={rightSlot}
      loading={loading}
      skeletonLines={6}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <div key={it.label} className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">{it.label}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{it.value}</p>
            </div>
          ))}
        </div>

        {data?.exclusiveRatio != null ? (
          <p className="text-xs text-muted-foreground">
            전용률: <span className="font-medium text-foreground">{data.exclusiveRatio}%</span>
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}
