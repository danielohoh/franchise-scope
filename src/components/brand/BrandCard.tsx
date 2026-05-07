"use client";

import type { DbBrand } from "@/types/database";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BrandCardProps = {
  brand: DbBrand;
  onEdit: () => void;
  onDelete: () => void;
};

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString("ko-KR");
}

function formatKRW(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  if (!Number.isFinite(value)) return "-";
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatRoyalty(brand: DbBrand) {
  if (!brand.royalty_type || brand.royalty_type === "none") return "없음";
  if (brand.royalty_type === "fixed") {
    return brand.royalty_amount ? `${formatKRW(brand.royalty_amount)}/월` : "고정(금액 미입력)";
  }
  if (brand.royalty_type === "rate") {
    return brand.royalty_amount ? `${formatNumber(brand.royalty_amount)}%` : "정률(비율 미입력)";
  }
  return "-";
}

export function BrandCard({ brand, onEdit, onDelete }: BrandCardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-sm",
        "space-y-4"
      )}
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">브랜드 요약</p>
          <h3 className="text-lg font-semibold tracking-tight text-foreground">
            {brand.brand_name}
          </h3>
          <p className="text-sm text-muted-foreground">
            {brand.company_name ?? "법인명 미입력"}
            {brand.industry ? ` · ${brand.industry}` : null}
            {brand.category ? ` · ${brand.category}` : null}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onEdit}>
            수정
          </Button>
          <Button type="button" variant="destructive" onClick={onDelete}>
            삭제
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">가맹비</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{formatKRW(brand.franchise_fee)}</p>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">로열티</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{formatRoyalty(brand)}</p>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">총 점포수</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{formatNumber(brand.total_stores)}</p>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">계약기간</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {brand.contract_period_years !== null && brand.contract_period_years !== undefined
              ? `${formatNumber(brand.contract_period_years)}년`
              : "-"}
          </p>
        </div>
      </div>

      <div className="grid gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground sm:grid-cols-2">
        <div>
          <span className="font-medium text-foreground">대표자</span>
          <span className="ml-2">{brand.representative ?? "-"}</span>
        </div>
        <div>
          <span className="font-medium text-foreground">대표 전화</span>
          <span className="ml-2">{brand.phone ?? "-"}</span>
        </div>
        <div className="sm:col-span-2">
          <span className="font-medium text-foreground">본사 주소</span>
          <span className="ml-2">{brand.address ?? "-"}</span>
        </div>
      </div>
    </section>
  );
}
