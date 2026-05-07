"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  FileText,
  Loader2,
  Save,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type {
  DisclosureParsedData,
  ParsedAvgSales,
  ParsedContractTerms,
  ParsedFees,
  ParsedFinancials,
  ParsedFranchiseeStatus,
} from "@/types/disclosure";
import { cn } from "@/lib/utils";

export type ParsedDataReviewProps = {
  disclosureId: string;
  parsedData: DisclosureParsedData;
  onSaveAction: (updates: Partial<DisclosureParsedData>) => Promise<void>;
};

type SectionKey = "fees" | "franchisee_status" | "avg_sales" | "financials" | "contract_terms";

type ParsedSectionMap = {
  fees: ParsedFees | null;
  franchisee_status: ParsedFranchiseeStatus | null;
  avg_sales: ParsedAvgSales | null;
  financials: ParsedFinancials | null;
  contract_terms: ParsedContractTerms | null;
};

type ConfidenceTone = "good" | "mid" | "bad" | "na";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function getConfidenceTone(conf: number | null | undefined): ConfidenceTone {
  if (typeof conf !== "number" || !Number.isFinite(conf)) return "na";
  if (conf >= 0.8) return "good";
  if (conf >= 0.6) return "mid";
  return "bad";
}

function ConfidenceChip({ value }: { value: number | null | undefined }) {
  const tone = getConfidenceTone(value);
  const text = typeof value === "number" && Number.isFinite(value) ? `${Math.round(clamp01(value) * 100)}%` : "-";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        tone === "good"
          ? "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-600/20"
          : tone === "mid"
            ? "bg-amber-500/10 text-amber-700 ring-1 ring-amber-600/20"
            : tone === "bad"
              ? "bg-rose-500/10 text-rose-700 ring-1 ring-rose-600/20"
              : "bg-muted text-muted-foreground ring-1 ring-border",
      )}
    >
      신뢰도 {text}
    </span>
  );
}

function formatKRW(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("ko-KR").format(Math.round(value));
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function toEditableJson(value: unknown) {
  return JSON.stringify(value ?? null, null, 2);
}

function parseSection<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") return null;
  return value as T;
}

function sectionConfidence(section: unknown): number | null {
  if (!section || typeof section !== "object") return null;
  const maybe = (section as { _confidence?: unknown })._confidence;
  return typeof maybe === "number" && Number.isFinite(maybe) ? maybe : null;
}

function fieldRing(sectionConf: number | null | undefined, value: unknown): string {
  if (value === null || value === undefined) return "ring-1 ring-rose-500/40";
  const c = sectionConf ?? 0;
  if (c >= 0.8) return "ring-1 ring-emerald-500/30";
  if (c >= 0.6) return "ring-1 ring-amber-400/30";
  return "ring-1 ring-rose-500/30";
}

function CollapsibleCard({
  title,
  subtitle,
  right,
  children,
  defaultOpen = true,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <section className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 p-5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="min-w-0">
          <p className="font-heading text-base font-semibold text-foreground">{title}</p>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {right}
          <span className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-background">
            {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </span>
        </div>
      </button>
      {open ? <div className="border-t border-border p-5">{children}</div> : null}
    </section>
  );
}

function JsonEditModal({
  open,
  title,
  initial,
  onCancel,
  onSave,
  busy,
}: {
  open: boolean;
  title: string;
  initial: string;
  onCancel: () => void;
  onSave: (next: string) => void;
  busy: boolean;
}) {
  const [value, setValue] = React.useState(initial);

  React.useEffect(() => {
    if (!open) return;
    setValue(initial);
  }, [initial, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-background shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <p className="font-heading text-base font-semibold">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">JSON 형태로 직접 수정할 수 있어요.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={onCancel} disabled={busy}>
            닫기
          </Button>
        </div>

        <div className="p-4">
          <textarea
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
            className={cn(
              "h-[46vh] w-full resize-none rounded-xl border border-border bg-card p-3",
              "font-mono text-xs text-foreground outline-none",
              "focus:ring-3 focus:ring-ring/30",
            )}
            spellCheck={false}
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="secondary" className="rounded-xl" onClick={onCancel} disabled={busy}>
            취소
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            onClick={() => onSave(value)}
            disabled={busy}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            저장
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ParsedDataReview({ disclosureId, parsedData, onSaveAction }: ParsedDataReviewProps) {
  const [openModal, setOpenModal] = React.useState<SectionKey | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isMarkingReviewed, setIsMarkingReviewed] = React.useState(false);

  const sections: ParsedSectionMap = React.useMemo(
    () => ({
      fees: parseSection<ParsedFees>(parsedData.fees),
      franchisee_status: parseSection<ParsedFranchiseeStatus>(parsedData.franchisee_status),
      avg_sales: parseSection<ParsedAvgSales>(parsedData.avg_sales),
      financials: parseSection<ParsedFinancials>(parsedData.financials),
      contract_terms: parseSection<ParsedContractTerms>(parsedData.contract_terms),
    }),
    [parsedData],
  );

  const overallConfidence = parsedData.parse_confidence;
  const overallPercent =
    typeof overallConfidence === "number" && Number.isFinite(overallConfidence)
      ? Math.round(clamp01(overallConfidence) * 100)
      : 0;

  const modalTitle: Record<SectionKey, string> = {
    fees: "가맹비/개점비용 직접 수정",
    franchisee_status: "가맹점 현황 직접 수정",
    avg_sales: "평균 매출 직접 수정",
    financials: "재무제표 직접 수정",
    contract_terms: "계약 조건 직접 수정",
  };

  const saveJson = React.useCallback(
    async (key: SectionKey, nextText: string) => {
      const next = safeJsonParse(nextText);
      if (next === null) {
        toast.error("JSON 형식이 올바르지 않습니다.");
        return;
      }

      setIsSaving(true);
      try {
        await onSaveAction({ [key]: next } as Partial<DisclosureParsedData>);
        toast.success("저장되었습니다.");
        setOpenModal(null);
      } catch (error) {
        console.error("[disclosure review] save failed", error);
        toast.error(error instanceof Error ? error.message : "저장에 실패했습니다.");
      } finally {
        setIsSaving(false);
      }
    },
    [onSaveAction],
  );

  const markReviewed = React.useCallback(async () => {
    setIsMarkingReviewed(true);
    try {
      const response = await fetch(`/api/disclosure/${encodeURIComponent(disclosureId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manually_reviewed: true }),
      });

      if (!response.ok) {
        let json: unknown = null;
        try {
          json = await response.json();
        } catch {
          // ignore
        }
        const message =
          json && typeof json === "object" && json !== null && ("message" in json || "error" in json)
            ? (((json as { message?: string; error?: string }).message ??
                (json as { message?: string; error?: string }).error) || "검토 완료 처리에 실패했습니다.")
            : "검토 완료 처리에 실패했습니다.";
        throw new Error(message);
      }

      toast.success("검토 완료로 표시했습니다.");
    } catch (error) {
      console.error("[disclosure review] mark reviewed failed", error);
      toast.error(error instanceof Error ? error.message : "검토 완료 처리에 실패했습니다.");
    } finally {
      setIsMarkingReviewed(false);
    }
  }, [disclosureId]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="font-heading text-base font-semibold">파싱 결과 검토</h2>
            <p className="text-sm text-muted-foreground">자동 추출된 데이터를 확인하고 필요 시 직접 수정하세요.</p>
          </div>
          <Button
            type="button"
            className="rounded-xl"
            onClick={() => void markReviewed()}
            disabled={isMarkingReviewed}
          >
            {isMarkingReviewed ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            검토 완료
          </Button>
        </div>

        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>전체 신뢰도</span>
            <span className="tabular-nums">{overallConfidence == null ? "-" : `${overallPercent}%`}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-200",
                overallPercent >= 80
                  ? "bg-emerald-600"
                  : overallPercent >= 60
                    ? "bg-amber-500"
                    : "bg-rose-600",
              )}
              style={{ width: `${overallConfidence == null ? 0 : overallPercent}%` }}
            />
          </div>
        </div>
      </section>

      <CollapsibleCard
        title="가맹비/개점비용"
        subtitle="핵심 비용 항목을 빠르게 확인합니다."
        right={<ConfidenceChip value={sectionConfidence(sections.fees)} />}
      >
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-xl"
            onClick={() => setOpenModal("fees")}
          >
            <Edit3 className="size-4" />
            직접 수정
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div
            className={cn(
              "rounded-xl border border-border bg-background p-4",
              fieldRing(sectionConfidence(sections.fees), sections.fees?.franchise_fee),
            )}
          >
            <p className="text-xs font-medium text-muted-foreground">가맹비 (원)</p>
            <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">
              {formatKRW(sections.fees?.franchise_fee)}
            </p>
          </div>
          <div
            className={cn(
              "rounded-xl border border-border bg-background p-4",
              fieldRing(sectionConfidence(sections.fees), sections.fees?.education_fee),
            )}
          >
            <p className="text-xs font-medium text-muted-foreground">교육비 (원)</p>
            <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">
              {formatKRW(sections.fees?.education_fee)}
            </p>
          </div>
          <div
            className={cn(
              "rounded-xl border border-border bg-background p-4",
              fieldRing(sectionConfidence(sections.fees), sections.fees?.deposit),
            )}
          >
            <p className="text-xs font-medium text-muted-foreground">보증금 (원)</p>
            <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">
              {formatKRW(sections.fees?.deposit)}
            </p>
          </div>
        </div>

        <div
          className={cn(
            "mt-4 rounded-xl border border-border bg-background p-4",
            fieldRing(sectionConfidence(sections.fees), sections.fees?.royalty),
          )}
        >
          <p className="text-xs font-medium text-muted-foreground">로열티</p>
          <p className="mt-1 text-sm text-foreground">
            {sections.fees?.royalty
              ? sections.fees.royalty.type === "rate"
                ? `매출의 ${sections.fees.royalty.amount}%`
                : sections.fees.royalty.type === "fixed"
                  ? `월 ${formatKRW(sections.fees.royalty.amount)}원`
                  : "없음"
              : "-"}
          </p>
          {sections.fees?.royalty?.description ? (
            <p className="mt-1 text-xs text-muted-foreground">{sections.fees.royalty.description}</p>
          ) : null}
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="가맹점 현황"
        subtitle="최근 3개년 추이를 확인합니다."
        right={<ConfidenceChip value={sectionConfidence(sections.franchisee_status)} />}
      >
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-xl"
            onClick={() => setOpenModal("franchisee_status")}
          >
            <Edit3 className="size-4" />
            직접 수정
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-background">
          <table className="min-w-[720px] w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">연도</th>
                <th className="px-3 py-2 text-right">기초</th>
                <th className="px-3 py-2 text-right">신규</th>
                <th className="px-3 py-2 text-right">종료</th>
                <th className="px-3 py-2 text-right">해지</th>
                <th className="px-3 py-2 text-right">양도</th>
                <th className="px-3 py-2 text-right">기말</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(sections.franchisee_status?.years ?? []).length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-muted-foreground" colSpan={7}>
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                (sections.franchisee_status?.years ?? []).map((y) => (
                  <tr key={y.year} className="text-foreground">
                    <td className="px-3 py-2 font-medium">{y.year}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div className={fieldRing(sectionConfidence(sections.franchisee_status), y.start)}>{y.start}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div className={fieldRing(sectionConfidence(sections.franchisee_status), y.new_open)}>
                        {y.new_open}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div className={fieldRing(sectionConfidence(sections.franchisee_status), y.terminated)}>
                        {y.terminated}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div className={fieldRing(sectionConfidence(sections.franchisee_status), y.cancelled)}>
                        {y.cancelled}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div className={fieldRing(sectionConfidence(sections.franchisee_status), y.transferred)}>
                        {y.transferred}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div className={fieldRing(sectionConfidence(sections.franchisee_status), y.end)}>{y.end}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="평균 매출"
        subtitle="지역별 평균 매출 정보를 확인합니다."
        right={<ConfidenceChip value={sectionConfidence(sections.avg_sales)} />}
      >
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-xl"
            onClick={() => setOpenModal("avg_sales")}
          >
            <Edit3 className="size-4" />
            직접 수정
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-background">
          <table className="min-w-[820px] w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">지역</th>
                <th className="px-3 py-2 text-right">표본</th>
                <th className="px-3 py-2 text-right">산출</th>
                <th className="px-3 py-2 text-right">연간 평균(천원)</th>
                <th className="px-3 py-2 text-right">3.3㎡당(천원)</th>
                <th className="px-3 py-2 text-right">최대</th>
                <th className="px-3 py-2 text-right">최소</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(sections.avg_sales?.by_region ?? []).length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-muted-foreground" colSpan={7}>
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                (sections.avg_sales?.by_region ?? []).map((r) => (
                  <tr key={r.region} className="text-foreground">
                    <td className="px-3 py-2 font-medium">
                      <div className={fieldRing(sectionConfidence(sections.avg_sales), r.region)}>{r.region}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div className={fieldRing(sectionConfidence(sections.avg_sales), r.count)}>{r.count}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div className={fieldRing(sectionConfidence(sections.avg_sales), r.calculated_count)}>
                        {r.calculated_count}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div className={fieldRing(sectionConfidence(sections.avg_sales), r.avg_annual)}>
                        {formatKRW(r.avg_annual)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div className={fieldRing(sectionConfidence(sections.avg_sales), r.per_3_3sqm)}>
                        {formatKRW(r.per_3_3sqm)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div className={fieldRing(sectionConfidence(sections.avg_sales), r.max)}>{formatKRW(r.max)}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div className={fieldRing(sectionConfidence(sections.avg_sales), r.min)}>{formatKRW(r.min)}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="재무제표"
        subtitle="최근 연도별 주요 지표를 확인합니다."
        right={<ConfidenceChip value={sectionConfidence(sections.financials)} />}
      >
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-xl"
            onClick={() => setOpenModal("financials")}
          >
            <Edit3 className="size-4" />
            직접 수정
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-background">
          <table className="min-w-[820px] w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">연도</th>
                <th className="px-3 py-2 text-right">매출(천원)</th>
                <th className="px-3 py-2 text-right">영업이익</th>
                <th className="px-3 py-2 text-right">순이익</th>
                <th className="px-3 py-2 text-right">자산</th>
                <th className="px-3 py-2 text-right">부채</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(sections.financials?.years ?? []).length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-muted-foreground" colSpan={6}>
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                (sections.financials?.years ?? []).map((y) => (
                  <tr key={y.year} className="text-foreground">
                    <td className="px-3 py-2 font-medium">{y.year}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div className={fieldRing(sectionConfidence(sections.financials), y.revenue)}>
                        {formatKRW(y.revenue)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div className={fieldRing(sectionConfidence(sections.financials), y.operating_profit)}>
                        {formatKRW(y.operating_profit)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div className={fieldRing(sectionConfidence(sections.financials), y.net_income)}>
                        {formatKRW(y.net_income)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div className={fieldRing(sectionConfidence(sections.financials), y.total_assets)}>
                        {formatKRW(y.total_assets)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div className={fieldRing(sectionConfidence(sections.financials), y.total_liabilities)}>
                        {formatKRW(y.total_liabilities)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="계약 조건"
        subtitle="계약/갱신 및 영업 조건을 확인합니다."
        right={<ConfidenceChip value={sectionConfidence(sections.contract_terms)} />}
      >
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-xl"
            onClick={() => setOpenModal("contract_terms")}
          >
            <Edit3 className="size-4" />
            직접 수정
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div
            className={cn(
              "rounded-xl border border-border bg-background p-4",
              fieldRing(sectionConfidence(sections.contract_terms), sections.contract_terms?.contract_period),
            )}
          >
            <p className="text-xs font-medium text-muted-foreground">계약기간</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {sections.contract_terms?.contract_period ?? "-"}
            </p>
          </div>

          <div
            className={cn(
              "rounded-xl border border-border bg-background p-4",
              fieldRing(sectionConfidence(sections.contract_terms), sections.contract_terms?.renewal_period),
            )}
          >
            <p className="text-xs font-medium text-muted-foreground">갱신기간</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {sections.contract_terms?.renewal_period ?? "-"}
            </p>
          </div>

          <div
            className={cn(
              "rounded-xl border border-border bg-background p-4",
              fieldRing(sectionConfidence(sections.contract_terms), sections.contract_terms?.territory_meters),
            )}
          >
            <p className="text-xs font-medium text-muted-foreground">영업지역 보호거리</p>
            <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">
              {typeof sections.contract_terms?.territory_meters === "number" &&
              Number.isFinite(sections.contract_terms.territory_meters)
                ? `${sections.contract_terms.territory_meters}m`
                : "-"}
            </p>
          </div>

          <div
            className={cn(
              "rounded-xl border border-border bg-background p-4",
              fieldRing(sectionConfidence(sections.contract_terms), sections.contract_terms?.operating_hours),
            )}
          >
            <p className="text-xs font-medium text-muted-foreground">영업시간</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {sections.contract_terms?.operating_hours ?? "-"}
            </p>
          </div>

          <div
            className={cn(
              "rounded-xl border border-border bg-background p-4",
              fieldRing(sectionConfidence(sections.contract_terms), sections.contract_terms?.operating_days),
            )}
          >
            <p className="text-xs font-medium text-muted-foreground">영업일수</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {sections.contract_terms?.operating_days ?? "-"}
            </p>
          </div>

          <div
            className={cn(
              "rounded-xl border border-border bg-background p-4",
              fieldRing(sectionConfidence(sections.contract_terms), sections.contract_terms?.non_compete),
            )}
          >
            <p className="text-xs font-medium text-muted-foreground">비경쟁조항</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {sections.contract_terms?.non_compete ?? "-"}
            </p>
          </div>
        </div>
      </CollapsibleCard>

      <JsonEditModal
        open={openModal !== null}
        title={openModal ? modalTitle[openModal] : ""}
        initial={
          openModal === "fees"
            ? toEditableJson(parsedData.fees)
            : openModal === "franchisee_status"
              ? toEditableJson(parsedData.franchisee_status)
              : openModal === "avg_sales"
                ? toEditableJson(parsedData.avg_sales)
                : openModal === "financials"
                  ? toEditableJson(parsedData.financials)
                  : openModal === "contract_terms"
                    ? toEditableJson(parsedData.contract_terms)
                    : ""
        }
        onCancel={() => setOpenModal(null)}
        onSave={(next) => {
          if (!openModal) return;
          void saveJson(openModal, next);
        }}
        busy={isSaving}
      />

      <div className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="font-heading text-base font-semibold">원문</p>
            <p className="text-sm text-muted-foreground">
              원문 텍스트는 추출 과정에서 생성됩니다. (필요 시 서버에서 제공)
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
            <FileText className="size-3.5" />
            disclosure_id: <span className="font-mono text-foreground">{disclosureId}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
