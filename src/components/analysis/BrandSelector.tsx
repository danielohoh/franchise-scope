"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import type { DbBrand, DbDisclosure, DisclosureParseStatus } from "@/types/database";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BrandSelectorProps = {
  onSelect: (brandId: string, disclosureId: string | null, brandName: string) => void;
  onBrandMetaChange?: (brand: { id: string; industry: string; category: string | null; brand_name: string }) => void;
};

type BrandsGetResponse =
  | { brand: DbBrand | null }
  | { brands: DbBrand[] };

type DisclosuresGetResponse = {
  disclosures: Array<DbDisclosure & { brands?: { brand_name?: string | null } | null }>;
};

type ApiError = { message?: string; error?: string };

function pickCompletedDisclosureId(items: DisclosuresGetResponse["disclosures"]): string | null {
  const completed = items.find((x) => x.parse_status === ("completed" satisfies DisclosureParseStatus));
  return completed?.id ?? null;
}

export function BrandSelector({ onSelect, onBrandMetaChange }: BrandSelectorProps) {
  const [loading, setLoading] = React.useState(true);
  const [brands, setBrands] = React.useState<DbBrand[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [disclosureId, setDisclosureId] = React.useState<string | null>(null);
  const [disclosureWarning, setDisclosureWarning] = React.useState<string | null>(null);

  const selectedBrand = React.useMemo(
    () => brands.find((b) => b.id === selectedId) ?? null,
    [brands, selectedId],
  );

  const fetchBrands = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/brands", { method: "GET" });

      let json: unknown = null;
      try {
        json = await response.json();
      } catch {
        // ignore
      }

      if (!response.ok) {
        const message =
          json && typeof json === "object" && json !== null && ("message" in json || "error" in json)
            ? (((json as ApiError).message ?? (json as ApiError).error) || "브랜드 목록을 불러오지 못했습니다.")
            : "브랜드 목록을 불러오지 못했습니다.";
        throw new Error(message);
      }

      const data = (json ?? {}) as BrandsGetResponse;
      const list =
        "brands" in data
          ? (Array.isArray(data.brands) ? data.brands : [])
          : data.brand
            ? [data.brand]
            : [];

      setBrands(list);
      if (list[0]) {
        setSelectedId(list[0].id);
      } else {
        setSelectedId("");
      }
    } catch (e) {
      console.error("[brand selector] fetch failed", e);
      toast.error(e instanceof Error ? e.message : "브랜드 목록을 불러오지 못했습니다.");
      setBrands([]);
      setSelectedId("");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDisclosure = React.useCallback(async (brandId: string) => {
    setDisclosureId(null);
    setDisclosureWarning(null);
    try {
      const url = new URL("/api/disclosure", window.location.origin);
      url.searchParams.set("brand_id", brandId);
      const response = await fetch(url.toString(), { method: "GET" });

      let json: unknown = null;
      try {
        json = await response.json();
      } catch {
        // ignore
      }

      if (!response.ok) {
        const message =
          json && typeof json === "object" && json !== null && ("message" in json || "error" in json)
            ? (((json as ApiError).message ?? (json as ApiError).error) || "정보공개서 목록을 불러오지 못했습니다.")
            : "정보공개서 목록을 불러오지 못했습니다.";
        throw new Error(message);
      }

      const data = (json ?? {}) as DisclosuresGetResponse;
      const disclosures = Array.isArray(data.disclosures) ? data.disclosures : [];
      const picked = pickCompletedDisclosureId(disclosures);
      setDisclosureId(picked);
      if (!picked) {
        setDisclosureWarning("완료된 정보공개서가 없습니다. (있어도 상권분석은 진행할 수 있어요)");
      }
      return picked;
    } catch (e) {
      console.error("[brand selector] disclosure fetch failed", e);
      setDisclosureWarning("정보공개서 상태를 확인하지 못했습니다. (상권분석은 진행할 수 있어요)");
      return null;
    }
  }, []);

  React.useEffect(() => {
    void fetchBrands();
  }, [fetchBrands]);

  React.useEffect(() => {
    if (!selectedBrand) return;
    void (async () => {
      const picked = await fetchDisclosure(selectedBrand.id);
      onSelect(selectedBrand.id, picked, selectedBrand.brand_name);
      onBrandMetaChange?.({
        id: selectedBrand.id,
        industry: selectedBrand.industry,
        category: selectedBrand.category ?? null,
        brand_name: selectedBrand.brand_name,
      });
    })();
  }, [fetchDisclosure, onBrandMetaChange, onSelect, selectedBrand]);

  if (loading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <div className="space-y-3">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        </div>
      </section>
    );
  }

  if (brands.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-10 text-center text-card-foreground shadow-sm">
        <p className="text-base font-semibold text-foreground">등록된 브랜드가 없습니다.</p>
        <p className="mt-2 text-sm text-muted-foreground">상권분석을 시작하려면 먼저 브랜드를 등록해주세요.</p>
        <div className="mt-6 flex justify-center">
          <Link href="/brand" className={cn(buttonVariants({ size: "lg" }), "rounded-xl")}>
            브랜드 등록하러 가기
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">브랜드 선택</p>
          <p className="text-sm text-muted-foreground">분석할 프랜차이즈 브랜드를 선택하세요.</p>
        </div>
        {selectedBrand ? (
          <div className="rounded-xl border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">업종</span>
            <span className="ml-2">{selectedBrand.industry}</span>
            {selectedBrand.category ? (
              <>
                <span className="mx-2">·</span>
                <span className="font-medium text-foreground">카테고리</span>
                <span className="ml-2">{selectedBrand.category}</span>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-5 space-y-3">
        <label className="block text-sm font-medium text-foreground">브랜드</label>
        <div className="relative">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.currentTarget.value)}
            className={cn(
              "h-10 w-full appearance-none rounded-xl border border-border bg-background px-3 pr-10 text-sm outline-none transition",
              "focus:border-ring focus:ring-3 focus:ring-ring/20",
            )}
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.brand_name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium text-foreground">정보공개서 연결</p>
            {disclosureId ? (
              <span className="text-xs font-medium text-emerald-700">연결됨</span>
            ) : (
              <span className="text-xs font-medium text-muted-foreground">미연결</span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {disclosureId ? "완료된 정보공개서를 자동으로 선택했습니다." : "연결된 완료 정보공개서가 없습니다."}
          </p>
          {disclosureWarning ? (
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 ring-1 ring-amber-600/20">
              <AlertTriangle className="mt-0.5 size-3.5" />
              <p>{disclosureWarning}</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
