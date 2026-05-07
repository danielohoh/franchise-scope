"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BrandAutoFillFields } from "@/types/brand";
import type { Database } from "@/types/database";

type BrandAutoFillProps = {
  brandId: string;
  onFill: (fields: BrandAutoFillFields) => void;
};

type ApiError = {
  message?: string;
};

type DisclosureRow = Database["public"]["Tables"]["disclosures"]["Row"];
type ParsedRow = Database["public"]["Tables"]["disclosure_parsed_data"]["Row"];

type DisclosureListResponse = {
  disclosures: Array<{
    id: string;
    parse_status: string;
  }>;
};

type DisclosureGetResponse = {
  disclosure: DisclosureRow;
  parsed_data: ParsedRow | null;
};

function toNumberOrUndefined(value: unknown) {
  if (typeof value !== "number") return undefined;
  if (!Number.isFinite(value)) return undefined;
  return value;
}

function toRoyaltyType(value: unknown): BrandAutoFillFields["royalty_type"] | undefined {
  if (value === "fixed" || value === "rate" || value === "none") return value;
  return undefined;
}

export function BrandAutoFill({ brandId, onFill }: BrandAutoFillProps) {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isLoading}
      onClick={() => {
        void (async () => {
          try {
            setIsLoading(true);

            const listRes = await fetch(`/api/disclosure?brand_id=${encodeURIComponent(brandId)}`);
            const listJson = (await listRes.json()) as DisclosureListResponse | ApiError;
            if (!listRes.ok) {
              const message = "message" in listJson ? listJson.message : undefined;
              throw new Error(message ?? "정보공개서 목록을 불러오지 못했습니다.");
            }

            const disclosures =
              "disclosures" in listJson && Array.isArray(listJson.disclosures) ? listJson.disclosures : [];
            const latestCompleted = disclosures.find((d) => d && d.parse_status === "completed");
            const disclosureId = latestCompleted?.id ?? null;
            if (!disclosureId) {
              throw new Error("완료된 정보공개서 파싱 결과가 없습니다. 먼저 정보공개서를 업로드/파싱해주세요.");
            }

            const detailRes = await fetch(`/api/disclosure/${encodeURIComponent(disclosureId)}`);
            const detailJson = (await detailRes.json()) as DisclosureGetResponse | ApiError;
            if (!detailRes.ok) {
              const message = "message" in detailJson ? detailJson.message : undefined;
              throw new Error(message ?? "정보공개서를 불러오지 못했습니다.");
            }

            const parsed = "parsed_data" in detailJson ? detailJson.parsed_data : null;
            const fees = parsed?.fees;
            const contract = parsed?.contract_terms;
            const franchisee = parsed?.franchisee_status;

            const fields: BrandAutoFillFields = {};

            if (fees && typeof fees === "object") {
              const feeObj = fees as Record<string, unknown>;
              fields.franchise_fee = toNumberOrUndefined(feeObj.franchise_fee);
              fields.education_fee = toNumberOrUndefined(feeObj.education_fee);

              const royalty = feeObj.royalty;
              if (royalty && typeof royalty === "object") {
                const royaltyObj = royalty as Record<string, unknown>;
                fields.royalty_type = toRoyaltyType(royaltyObj.type);
                fields.royalty_amount = toNumberOrUndefined(royaltyObj.amount);
              }

              const openingCosts = feeObj.opening_costs;
              if (openingCosts && typeof openingCosts === "object") {
                const oc = openingCosts as Record<string, unknown>;
                // NOTE: parsed opening_costs.interior is total interior. We store per pyeong if already per-pyeong.
                // If parser returns total, user can still adjust manually.
                fields.interior_cost_per_pyeong = toNumberOrUndefined(oc.interior);
              }
            }

            if (contract && typeof contract === "object") {
              const contractObj = contract as Record<string, unknown>;
              fields.territory_protection_meters = toNumberOrUndefined(contractObj.territory_meters);

              const contractPeriod = contractObj.contract_period;
              if (typeof contractPeriod === "string") {
                const match = contractPeriod.match(/(\d+(?:\.\d+)?)/);
                const years = match ? Number(match[1]) : NaN;
                if (Number.isFinite(years)) fields.contract_period_years = years;
              }
            }

            if (franchisee && typeof franchisee === "object") {
              const franchiseeObj = franchisee as Record<string, unknown>;
              // Try to derive total stores from latest year if present
              const years = franchiseeObj.years;
              if (Array.isArray(years)) {
                const sorted = years
                  .filter((y): y is Record<string, unknown> => typeof y === "object" && y !== null)
                  .map((y) => ({ year: toNumberOrUndefined(y.year), end: toNumberOrUndefined(y.end) }))
                  .filter(
                    (y): y is { year: number; end: number } =>
                      typeof y.year === "number" && typeof y.end === "number"
                  )
                  .sort((a, b) => a.year - b.year);

                const latest = sorted.at(-1);
                if (latest) fields.total_stores = latest.end;
              }
            }

            const compact = Object.fromEntries(
              Object.entries(fields).filter(([, value]) => value !== undefined)
            ) as BrandAutoFillFields;

            if (Object.keys(compact).length === 0) {
              throw new Error("자동 채울 수 있는 필드를 찾지 못했습니다. 파싱 결과를 확인해주세요.");
            }

            onFill(compact);
            toast.success("최근 파싱 결과에서 채웠습니다.");
          } catch (error) {
            console.error("[brand autofill] failed", error);
            toast.error(error instanceof Error ? error.message : "자동 채우기에 실패했습니다.");
          } finally {
            setIsLoading(false);
          }
        })();
      }}
    >
      <Wand2 className="size-4" />
      <span>{isLoading ? "자동 채우는 중..." : "정보공개서에서 자동 채우기"}</span>
    </Button>
  );
}
