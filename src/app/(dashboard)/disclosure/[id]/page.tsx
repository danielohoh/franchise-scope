"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ExternalLink, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/PageContainer";
import { ParsedDataReview } from "@/components/disclosure/ParsedDataReview";
import { ParseProgressTracker } from "@/components/disclosure/ParseProgressTracker";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Brand } from "@/types/brand";
import type { Disclosure, DisclosureParsedData, ParsedFees } from "@/types/disclosure";
import { cn } from "@/lib/utils";

type ApiError = { message?: string; error?: string };

type DisclosureDetailResponse = {
  disclosure?: Disclosure;
  parsed_data?: DisclosureParsedData | null;
  parsedData?: DisclosureParsedData | null;
  brand?: { id: string; brand_name: string } | null;
} & Record<string, unknown>;

type BrandsGetResponse = { brand: Brand | null };

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "-";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 0 : 1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function extractAutoFillFromFees(fees: ParsedFees | null) {
  if (!fees) return {};

  const royaltyRate = fees.royalty?.type === "rate" ? fees.royalty.amount : null;

  return {
    franchise_fee: fees.franchise_fee,
    education_fee: fees.education_fee,
    deposit: fees.deposit,
    royalty_rate: royaltyRate,
  };
}

function parseSection<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") return null;
  return value as T;
}

export default function DisclosureDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [showParser, setShowParser] = React.useState(false);

  const [disclosure, setDisclosure] = React.useState<Disclosure | null>(null);
  const [parsed, setParsed] = React.useState<DisclosureParsedData | null>(null);

  const fetchDetail = React.useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/disclosure/${encodeURIComponent(id)}`, { method: "GET" });
      let json: unknown = null;
      try {
        json = await response.json();
      } catch {
        // ignore
      }

      if (!response.ok) {
        const message =
          json && typeof json === "object" && json !== null && ("message" in json || "error" in json)
            ? (((json as ApiError).message ?? (json as ApiError).error) || "정보공개서를 불러오지 못했습니다.")
            : "정보공개서를 불러오지 못했습니다.";
        throw new Error(message);
      }

      const data = (json ?? {}) as DisclosureDetailResponse;
      const d = (data.disclosure ?? (json as Disclosure)) as Disclosure;
      const pd = (data.parsed_data ?? data.parsedData ?? (data as { parsed?: DisclosureParsedData | null }).parsed ?? null) as
        | DisclosureParsedData
        | null;

      setDisclosure(d);
      setParsed(pd);
    } catch (error) {
      console.error("[disclosure detail] fetch failed", error);
      toast.error(error instanceof Error ? error.message : "정보공개서를 불러오지 못했습니다.");
      setDisclosure(null);
      setParsed(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const updateParsed = React.useCallback(
    async (updates: Partial<DisclosureParsedData>) => {
      if (!id) return;
      setSaving(true);
      try {
        const response = await fetch(`/api/disclosure/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        let json: unknown = null;
        try {
          json = await response.json();
        } catch {
          // ignore
        }

        if (!response.ok) {
          const message =
            json && typeof json === "object" && json !== null && ("message" in json || "error" in json)
              ? (((json as ApiError).message ?? (json as ApiError).error) || "저장에 실패했습니다.")
              : "저장에 실패했습니다.";
          throw new Error(message);
        }

        setParsed((prev) => (prev ? ({ ...prev, ...updates } as DisclosureParsedData) : prev));
      } catch (error) {
        console.error("[disclosure detail] save failed", error);
        toast.error(error instanceof Error ? error.message : "저장에 실패했습니다.");
        throw error;
      } finally {
        setSaving(false);
      }
    },
    [id],
  );

  const applyToBrand = React.useCallback(async () => {
    if (!disclosure) return;
    if (!parsed) {
      toast.error("파싱 데이터가 없습니다.");
      return;
    }

    setApplying(true);
    try {
      // 1) fetch current brand (to satisfy PUT schema requiring full payload)
      const brandRes = await fetch("/api/brands", { method: "GET" });
      const brandJson = (await brandRes.json().catch(() => null)) as unknown;
      if (!brandRes.ok) {
        const message =
          brandJson && typeof brandJson === "object" && brandJson !== null && ("message" in brandJson || "error" in brandJson)
            ? (((brandJson as ApiError).message ?? (brandJson as ApiError).error) || "브랜드 정보를 불러오지 못했습니다.")
            : "브랜드 정보를 불러오지 못했습니다.";
        throw new Error(message);
      }

      const brand = (brandJson as BrandsGetResponse).brand;
      if (!brand) {
        throw new Error("브랜드 정보가 없습니다. 먼저 브랜드를 등록해주세요.");
      }

      const fees = parseSection<ParsedFees>(parsed.fees);
      const fill = extractAutoFillFromFees(fees);

      const payload = {
        brand_name: brand.brand_name,
        industry: brand.industry,
        sub_industry: brand.sub_industry,
        avg_store_size_pyeong: brand.avg_store_size_pyeong,
        franchise_fee: fill.franchise_fee ?? brand.franchise_fee,
        education_fee: fill.education_fee ?? brand.education_fee,
        deposit: fill.deposit ?? brand.deposit,
        interior_cost_per_pyeong: brand.interior_cost_per_pyeong,
        equipment_cost: brand.equipment_cost,
        initial_supplies_cost: brand.initial_supplies_cost,
        signage_cost: brand.signage_cost,
        other_cost: brand.other_cost,
        royalty_rate: fill.royalty_rate ?? brand.royalty_rate,
        ad_contribution_rate: brand.ad_contribution_rate,
        supply_cost_rate: brand.supply_cost_rate,
        avg_ticket_price: brand.avg_ticket_price,
        avg_monthly_revenue: brand.avg_monthly_revenue,
        min_store_requirement: brand.min_store_requirement,
        target_customer: brand.target_customer,
        delivery_ratio: brand.delivery_ratio,
        peak_hours: brand.peak_hours,
        total_stores: brand.total_stores,
        avg_close_rate: brand.avg_close_rate,
        notes: brand.notes,
      };

      const putRes = await fetch(`/api/brands/${encodeURIComponent(disclosure.brand_id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const putJson = (await putRes.json().catch(() => null)) as unknown;
      if (!putRes.ok) {
        const message =
          putJson && typeof putJson === "object" && putJson !== null && ("message" in putJson || "error" in putJson)
            ? (((putJson as ApiError).message ?? (putJson as ApiError).error) || "브랜드 반영에 실패했습니다.")
            : "브랜드 반영에 실패했습니다.";
        throw new Error(message);
      }

      toast.success("브랜드에 반영했습니다.");
      router.refresh();
    } catch (error) {
      console.error("[disclosure detail] apply to brand failed", error);
      toast.error(error instanceof Error ? error.message : "브랜드 반영에 실패했습니다.");
    } finally {
      setApplying(false);
    }
  }, [disclosure, parsed, router]);

  return (
    <PageContainer
      title="정보공개서 상세"
      description="파싱 결과를 검토하고, 브랜드 정보에 반영할 수 있습니다."
      backHref="/disclosure"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="rounded-xl"
            onClick={() => void applyToBrand()}
            disabled={loading || applying}
          >
            {applying ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            브랜드에 적용
          </Button>
          {disclosure?.file_path ? (
            <Link
              href={disclosure.file_path}
              target="_blank"
              className={cn(buttonVariants({ variant: "outline" }), "rounded-xl")}
            >
              <ExternalLink className="size-4" />
              원본 보기
            </Link>
          ) : null}
        </div>
      }
    >
      {loading ? (
        <div className="space-y-4">
          <div className="h-28 animate-pulse rounded-2xl bg-muted" />
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : !disclosure ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-card-foreground shadow-sm">
          <p className="text-base font-semibold text-foreground">정보공개서를 찾을 수 없습니다.</p>
          <p className="mt-2 text-sm text-muted-foreground">목록으로 돌아가 다시 시도해주세요.</p>
          <div className="mt-6 flex justify-center">
            <Link href="/disclosure" className={cn(buttonVariants({ variant: "default" }), "rounded-xl")}>
              목록으로
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">파일</p>
                <p className="mt-1 truncate text-base font-semibold text-foreground">{disclosure.file_name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  업로드: {formatDateTime(disclosure.created_at)} · 크기: {formatBytes(disclosure.file_size)}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={parsed?.manually_reviewed ?? false}
                    disabled={!parsed || saving}
                    onChange={(e) => {
                      if (!parsed) return;
                      void updateParsed({ manually_reviewed: e.currentTarget.checked });
                    }}
                  />
                  <span className="text-foreground">검토 완료</span>
                </label>
              </div>
            </div>
          </section>

          {parsed ? (
            <ParsedDataReview
              disclosureId={disclosure.id}
              parsedData={parsed}
              onSaveAction={updateParsed}
            />
          ) : showParser ? (
            <ParseProgressTracker
              disclosureId={disclosure.id}
              onCompleteAction={() => {
                setShowParser(false);
                void fetchDetail();
              }}
            />
          ) : (
            <div className="rounded-2xl border border-border bg-card p-10 text-center text-card-foreground shadow-sm">
              <p className="text-base font-semibold text-foreground">파싱 데이터가 없습니다.</p>
              <p className="mt-2 text-sm text-muted-foreground">아래 버튼을 눌러 파싱을 시작하세요.</p>
              <div className="mt-6 flex justify-center">
                <Button
                  type="button"
                  variant="default"
                  className="rounded-xl"
                  onClick={() => setShowParser(true)}
                >
                  파싱 시작
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
