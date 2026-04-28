"use client";

import { ExternalLink, BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MatchedListing } from "@/types/recommend";

function formatPrice(amount: number | null): string {
  if (!amount) return "-";
  if (amount >= 10000) return `${(amount / 10000).toFixed(1)}억`;
  return `${amount.toLocaleString()}만`;
}

function formatAreaPyeong(area: number | null) {
  if (!area) return "-";
  const rounded = area >= 10 ? Math.round(area) : Math.round(area * 10) / 10;
  return `${rounded}평`;
}

function getTitle(listing: MatchedListing) {
  const parts = [listing.detail_address, listing.building_name, listing.article_name]
    .map((v) => (v ?? "").trim())
    .filter(Boolean);
  return parts[0] ?? "매물";
}

function scoreTone(score: number) {
  if (score >= 90) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (score >= 70) return "border-yellow-200 bg-yellow-50 text-yellow-800";
  return "border-orange-200 bg-orange-50 text-orange-800";
}

export function ListingCard({
  listing,
  rank,
  onSelect,
  isSelected,
  recommendationId,
}: {
  listing: MatchedListing;
  rank: number;
  onSelect: (listing: MatchedListing) => void;
  isSelected: boolean;
  recommendationId: string;
}) {
  const router = useRouter();
  const score = Math.max(0, Math.min(100, listing.matchScore));
  const title = getTitle(listing);

  const tradeType = (listing.trade_type ?? "").trim();
  const priceLine =
    tradeType.includes("월세")
      ? `보증 ${formatPrice(listing.deposit)} / 월세 ${formatPrice(listing.monthly_rent)}`
      : tradeType.includes("매매")
        ? `매매가 ${formatPrice(listing.sale_price)}`
        : `보증 ${formatPrice(listing.deposit)} / 월세 ${formatPrice(listing.monthly_rent)}`;

  const parkingLabel =
    listing.parking_available === true
      ? `주차 ${listing.parking_count != null ? `${listing.parking_count}대` : "가능"}`
      : listing.parking_available === false
        ? "주차 불가"
        : "주차 정보 미확인";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(listing)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(listing);
      }}
      className={cn(
        "relative cursor-pointer rounded-xl border border-border bg-background p-4 transition",
        "hover:bg-muted/40",
        isSelected ? "border-primary" : null,
      )}
    >
      <div className="absolute left-4 top-4 flex size-8 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground">
        #{rank}
      </div>

      <div
        className={cn(
          "absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
          scoreTone(score),
        )}
      >
        <span aria-hidden>⭐</span>
        {Math.round(score)}%
      </div>

      <div className="min-w-0 pl-10 pr-24">
        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatAreaPyeong(listing.area_pyeong)} | {priceLine}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {parkingLabel}
          {listing.building_use ? ` | ${listing.building_use}` : null}
        </p>
        {listing.nearbyHouseholds != null && listing.nearbyHouseholds > 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            주변 세대수: <span className="font-medium text-foreground">{listing.nearbyHouseholds.toLocaleString()}</span>세대
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 pl-10">
        <a
          href={listing.naver_url ?? "#"}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={cn(!listing.naver_url ? "pointer-events-none" : null)}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={!listing.naver_url}
          >
            <ExternalLink className="size-4" />
            부동산 매물 보기
          </Button>
        </a>

        <Button
          type="button"
          size="sm"
          className="rounded-xl"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/dashboard/recommend/${recommendationId}/analysis/${listing.id}`);
          }}
        >
          <BarChart3 className="size-4" />
          상세 분석
        </Button>
      </div>
    </div>
  );
}
