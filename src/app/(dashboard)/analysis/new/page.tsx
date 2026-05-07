"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/PageContainer";
import { BrandSelector } from "@/components/analysis/BrandSelector";
import { AddressInput } from "@/components/analysis/AddressInput";
import { CollectionProgress } from "@/components/analysis/CollectionProgress";
import { Button } from "@/components/ui/button";
import { useAnalysisStore } from "@/stores/analysis-store";
import { cn } from "@/lib/utils";

type ApiError = { message?: string; error?: string };

type AnalysisCreateResponse = {
  id?: string;
  analysis_id?: string;
  analysis?: { id?: string };
};

export default function AnalysisNewPage() {
  const router = useRouter();

  const step = useAnalysisStore((s) => s.step);
  const selectedBrandId = useAnalysisStore((s) => s.selectedBrandId);
  const selectedDisclosureId = useAnalysisStore((s) => s.selectedDisclosureId);
  const address = useAnalysisStore((s) => s.address);
  const latitude = useAnalysisStore((s) => s.latitude);
  const longitude = useAnalysisStore((s) => s.longitude);
  const targetSizePyeong = useAnalysisStore((s) => s.targetSizePyeong);
  const targetFloor = useAnalysisStore((s) => s.targetFloor);
  const targetRent = useAnalysisStore((s) => s.targetRent);
  const analysisId = useAnalysisStore((s) => s.analysisId);

  const setStep = useAnalysisStore((s) => s.setStep);
  const setBrand = useAnalysisStore((s) => s.setBrand);
  const setLocation = useAnalysisStore((s) => s.setLocation);
  const setOptions = useAnalysisStore((s) => s.setOptions);
  const setAnalysisId = useAnalysisStore((s) => s.setAnalysisId);
  const reset = useAnalysisStore((s) => s.reset);

  const [creating, setCreating] = React.useState(false);
  const [brandMeta, setBrandMeta] = React.useState<{
    id: string;
    industry: string;
    category: string | null;
    name: string;
  } | null>(null);

  React.useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  const canGoStep2 = Boolean(selectedBrandId);
  const canCreate =
    Boolean(selectedBrandId) && Boolean(address.trim()) && typeof latitude === "number" && typeof longitude === "number";

  const createAnalysis = React.useCallback(async () => {
    if (!canCreate || !selectedBrandId || latitude === null || longitude === null) return;

    setCreating(true);
    try {
      const payload = {
        brand_id: selectedBrandId,
        disclosure_id: selectedDisclosureId ?? undefined,
        address,
        latitude,
        longitude,
        target_size_pyeong: typeof targetSizePyeong === "number" ? targetSizePyeong : undefined,
        target_floor: targetFloor.trim().length > 0 ? targetFloor.trim() : undefined,
        target_rent: typeof targetRent === "number" ? targetRent : undefined,
      };

      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      let json: unknown = null;
      try {
        json = await response.json();
      } catch {
        // ignore
      }

      if (!response.ok) {
        const msg =
          json && typeof json === "object" && json !== null && ("message" in json || "error" in json)
            ? (((json as ApiError).message ?? (json as ApiError).error) || "상권분석 생성에 실패했습니다.")
            : "상권분석 생성에 실패했습니다.";
        throw new Error(msg);
      }

      const data = (json ?? {}) as AnalysisCreateResponse;
      const id = data.id ?? data.analysis_id ?? data.analysis?.id;
      if (!id) throw new Error("analysis_id를 받지 못했습니다.");

      setAnalysisId(id);
      setStep(3);
      toast.success("상권분석을 생성했습니다. 데이터 수집을 시작합니다.");
    } catch (e) {
      console.error("[analysis create] failed", e);
      toast.error(e instanceof Error ? e.message : "상권분석 생성에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  }, [address, canCreate, latitude, longitude, selectedBrandId, selectedDisclosureId, setAnalysisId, setStep, targetFloor, targetRent, targetSizePyeong]);

  return (
    <PageContainer
      title="새 상권분석"
      description="3단계로 빠르게 분석을 생성합니다."
      backHref="/analysis"
      action={
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-border">
            STEP {step}/3
          </span>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={cn(
                "rounded-2xl border border-border bg-card p-4 shadow-sm",
                step === n ? "ring-2 ring-primary/20" : null,
              )}
            >
              <p className="text-xs font-medium text-muted-foreground">STEP {n}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {n === 1 ? "브랜드" : n === 2 ? "주소/옵션" : "수집"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {n === 1
                  ? "분석할 브랜드를 선택"
                  : n === 2
                    ? "주소 확인 및 매장 옵션 입력"
                    : "데이터 수집 후 결과 확인"}
              </p>
            </div>
          ))}
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <BrandSelector
              onSelect={(brandId, disclosureId, brandName) => {
                setBrand(brandId, disclosureId ?? undefined);
                setStep(2);
                setBrandMeta((prev) => ({
                  id: brandId,
                  industry: prev?.industry ?? "외식",
                  category: prev?.category ?? null,
                  name: brandName,
                }));
              }}
              onBrandMetaChange={(b) => {
                setBrandMeta({
                  id: b.id,
                  industry: b.industry,
                  category: b.category,
                  name: b.brand_name,
                });
              }}
            />
            <div className="flex justify-end">
              <Button type="button" size="lg" className="rounded-xl" disabled={!canGoStep2} onClick={() => setStep(2)}>
                다음
              </Button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <AddressInput
              value={address}
              onChangeAction={(addr, lat, lng) => {
                setLocation(addr, lat, lng);
              }}
            />

            <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">옵션 (선택)</p>
                <p className="text-sm text-muted-foreground">예상 매장 조건을 입력하면 투자/임대 추정에 반영됩니다.</p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">희망 평수(평)</span>
                  <input
                    inputMode="decimal"
                    value={targetSizePyeong === null ? "" : String(targetSizePyeong)}
                    onChange={(e) => {
                      const v = e.currentTarget.value.trim();
                      const n = v.length ? Number(v) : NaN;
                      setOptions({ sizePyeong: Number.isFinite(n) ? n : undefined });
                    }}
                    placeholder="예) 20"
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">층수</span>
                  <input
                    value={targetFloor}
                    onChange={(e) => setOptions({ floor: e.currentTarget.value })}
                    placeholder="예) 1층"
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">예상 임대료(월, 원)</span>
                  <input
                    inputMode="numeric"
                    value={targetRent === null ? "" : String(targetRent)}
                    onChange={(e) => {
                      const v = e.currentTarget.value.trim().replace(/,/g, "");
                      const n = v.length ? Number(v) : NaN;
                      setOptions({ rent: Number.isFinite(n) ? n : undefined });
                    }}
                    placeholder="예) 3000000"
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
                  />
                </label>
              </div>
            </section>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="ghost" className="rounded-xl" onClick={() => setStep(1)}>
                이전
              </Button>
              <Button
                type="button"
                size="lg"
                className="rounded-xl"
                onClick={() => void createAnalysis()}
                disabled={!canCreate || creating}
              >
                {creating ? <Loader2 className="size-4 animate-spin" /> : null}
                분석 시작
              </Button>
            </div>
          </div>
        ) : null}

        {step === 3 && analysisId && latitude !== null && longitude !== null && selectedBrandId ? (
          <CollectionProgress
            analysisId={analysisId}
            brand={{
              id: selectedBrandId,
              industry: brandMeta?.industry ?? "외식",
              category: brandMeta?.category ?? null,
            }}
            lat={latitude}
            lng={longitude}
            targetSizePyeong={typeof targetSizePyeong === "number" ? targetSizePyeong : undefined}
            onComplete={() => {
              router.push(`/analysis/${analysisId}`);
            }}
          />
        ) : step === 3 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
            <p className="text-sm text-muted-foreground">필수 정보가 부족합니다. 이전 단계로 돌아가 주세요.</p>
            <div className="mt-4">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setStep(1)}>
                처음으로
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
}
