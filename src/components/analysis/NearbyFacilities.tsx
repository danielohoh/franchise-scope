"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ChevronDown,
  MapPin,
  ShoppingBag,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { FacilitiesSection } from "@/types/analysis";

import { SectionCard } from "./SectionCard";

type FacilityCategory = FacilitiesSection["categories"][number];

function pickIcon(icon: string | null | undefined): LucideIcon {
  const key = (icon ?? "").toLowerCase();
  if (key.includes("user") || key.includes("people") || key.includes("population")) return Users;
  if (key.includes("shop") || key.includes("store") || key.includes("mart") || key.includes("shopping")) return ShoppingBag;
  if (key.includes("trend") || key.includes("growth")) return TrendingUp;
  if (key.includes("star") || key.includes("favorite")) return Star;
  if (key.includes("build") || key.includes("facility") || key.includes("office")) return Building2;
  if (key.includes("map") || key.includes("pin") || key.includes("location")) return MapPin;
  return MapPin;
}

function formatMeters(m: number) {
  if (!Number.isFinite(m)) return "-";
  if (m >= 1000) return `${(m / 1000).toFixed(1)}km`;
  return `${Math.round(m)}m`;
}

export function NearbyFacilities({
  data,
  loading = false,
}: {
  data: FacilitiesSection;
  loading?: boolean;
}) {
  const categories = useMemo(() => data.categories ?? [], [data.categories]);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const open = openKey ? categories.find((c) => c.key === openKey) ?? null : null;

  return (
    <SectionCard title="📍 주변 핵심 시설" loading={loading} skeletonLines={10}>
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">표시할 시설 카테고리가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
            {categories.slice(0, 6).map((c) => {
              const Icon = pickIcon(c.icon);
              const nearest = c.nearest;
              const isOpen = openKey === c.key;

              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setOpenKey((prev) => (prev === c.key ? null : c.key))}
                  className={cn(
                    "text-left rounded-xl border border-border bg-background p-3 transition",
                    "hover:bg-muted/40",
                    isOpen ? "border-primary" : null,
                  )}
                  aria-expanded={isOpen}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                      <Icon className="size-4" />
                    </span>
                    <ChevronDown className={cn("mt-1 size-4 text-muted-foreground transition", isOpen ? "rotate-180" : null)} />
                  </div>

                  <p className="mt-2 text-xs font-semibold text-foreground">{c.label}</p>
                  {nearest ? (
                    <div className="mt-1 space-y-0.5">
                      <p className="text-xs text-muted-foreground">가장 가까움 · {formatMeters(nearest.distance_m)}</p>
                      <p className="truncate text-xs text-foreground">{nearest.name}</p>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">반경 내 없음</p>
                  )}
                </button>
              );
            })}
          </div>

          {open ? (
            <div className="rounded-xl border border-border bg-muted/10 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">{open.label} · Top 5</p>
                <p className="text-xs text-muted-foreground">총 {open.total.toLocaleString()}개</p>
              </div>

              {open.items.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">반경 내 시설이 없습니다.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {open.items.slice(0, 5).map((it) => (
                    <li key={`${open.key}-${it.name}-${it.distance_m}`} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-foreground">{it.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{it.address}</p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-foreground">{formatMeters(it.distance_m)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}
