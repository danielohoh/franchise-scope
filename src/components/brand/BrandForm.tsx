"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChevronDown, Loader2 } from "lucide-react";

import type { DbBrand, Industry, PriceTier, RoyaltyType } from "@/types/database";
import type { BrandAutoFillFields } from "@/types/brand";
import { Button } from "@/components/ui/button";
import { BrandAutoFill } from "@/components/brand/BrandAutoFill";
import { cn } from "@/lib/utils";

type BrandFormProps = {
  brand?: DbBrand | null;
  onSuccess: () => void;
};

const industryOptions: ReadonlyArray<Industry> = ["외식", "도소매", "서비스"];
const priceTierOptions: ReadonlyArray<PriceTier> = ["저가", "중가", "프리미엄"];
const royaltyTypeOptions: ReadonlyArray<RoyaltyType> = ["fixed", "rate", "none"];

function parseNumber(value: string) {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const normalized = trimmed.replace(/,/g, "");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return n;
}

function formatNumberInput(value: string) {
  const digits = value.replace(/[^0-9.]/g, "");
  if (digits.length === 0) return "";

  const [intPart, fracPart] = digits.split(".");
  const intFormatted = intPart.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (fracPart === undefined) return intFormatted;
  return `${intFormatted}.${fracPart}`;
}

function toStringOrEmpty(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  if (!Number.isFinite(value)) return "";
  return String(value);
}

const formSchema = z
  .object({
    // 기본 정보
    brand_name: z.string().trim().min(1, "브랜드명을 입력해주세요"),
    company_name: z.string().trim().min(1, "법인명을 입력해주세요"),
    representative: z.string().trim().optional().default(""),
    business_number: z.string().trim().optional().default(""),
    address: z.string().trim().optional().default(""),
    phone: z.string().trim().optional().default(""),

    // 업종
    industry: z.union([z.literal(""), z.enum(["외식", "도소매", "서비스"])]).default(""),
    category: z.string().trim().optional().default(""),
    price_tier: z.union([z.literal(""), z.enum(["저가", "중가", "프리미엄"]) ]).default(""),

    // 가맹 조건
    franchise_fee: z.string().optional().default(""),
    education_fee: z.string().optional().default(""),
    deposit: z.string().optional().default(""),
    royalty_type: z.union([z.literal(""), z.enum(["fixed", "rate", "none"]) ]).default(""),
    royalty_amount: z.string().optional().default(""),

    // 매장 규격
    standard_size_min: z.string().optional().default(""),
    standard_size_max: z.string().optional().default(""),
    standard_staff_count: z.string().optional().default(""),
    territory_protection_meters: z.string().optional().default(""),
    contract_period_years: z.string().optional().default(""),

    // 비용 상세
    interior_cost_per_pyeong: z.string().optional().default(""),
    equipment_cost: z.string().optional().default(""),
    initial_supplies_cost: z.string().optional().default(""),
    signage_cost: z.string().optional().default(""),
    other_cost: z.string().optional().default(""),

    // 운영
    avg_ticket_price: z.string().optional().default(""),
    avg_monthly_revenue: z.string().optional().default(""),
    total_stores: z.string().optional().default(""),
    avg_close_rate: z.string().optional().default(""),
    delivery_ratio: z.string().optional().default(""),
    peak_hours: z.string().trim().optional().default(""),
    target_customer: z.string().trim().optional().default(""),
    notes: z.string().trim().optional().default(""),
    min_store_requirement: z.string().trim().optional().default(""),
  })
  .superRefine((data, ctx) => {
    if (data.industry === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["industry"],
        message: "업종을 선택해주세요",
      });
    }

    const royaltyAmount = parseNumber(data.royalty_amount);
    if (data.royalty_type === "rate" && royaltyAmount !== null) {
      if (royaltyAmount < 0 || royaltyAmount > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["royalty_amount"],
          message: "로열티 비율은 0~100% 범위여야 합니다.",
        });
      }
    }

    const closeRate = parseNumber(data.avg_close_rate);
    if (closeRate !== null && (closeRate < 0 || closeRate > 100)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["avg_close_rate"],
        message: "폐점률은 0~100% 범위여야 합니다.",
      });
    }

    const deliveryRatio = parseNumber(data.delivery_ratio);
    if (deliveryRatio !== null && (deliveryRatio < 0 || deliveryRatio > 100)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["delivery_ratio"],
        message: "배달 비율은 0~100% 범위여야 합니다.",
      });
    }
  });

type FormInputValues = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

type BrandPayload = {
  brand_name: string;
  company_name: string;
  representative?: string;
  business_number?: string;
  address?: string;
  phone?: string;
  industry: Industry;
  category?: string;
  price_tier?: PriceTier;
  franchise_fee: number | null;
  education_fee: number | null;
  deposit: number | null;
  royalty_type: RoyaltyType | null;
  royalty_amount: number | null;
  standard_size_min: number | null;
  standard_size_max: number | null;
  standard_staff_count: number | null;
  territory_protection_meters: number | null;
  contract_period_years: number | null;
  interior_cost_per_pyeong: number | null;
  equipment_cost: number | null;
  initial_supplies_cost: number | null;
  signage_cost: number | null;
  other_cost: number | null;
  avg_ticket_price: number | null;
  avg_monthly_revenue: number | null;
  total_stores: number | null;
  avg_close_rate: number | null;
  delivery_ratio: number | null;
  peak_hours?: string;
  target_customer?: string;
  notes?: string;
  min_store_requirement?: string;
};

function buildDefaults(brand?: DbBrand | null): FormInputValues {
  return {
    brand_name: brand?.brand_name ?? "",
    company_name: brand?.company_name ?? "",
    representative: brand?.representative ?? "",
    business_number: brand?.business_number ?? "",
    address: brand?.address ?? "",
    phone: brand?.phone ?? "",

    industry: brand?.industry ?? "",
    category: brand?.category ?? "",
    price_tier: brand?.price_tier ?? "",

    franchise_fee: brand?.franchise_fee ? brand.franchise_fee.toLocaleString("ko-KR") : "",
    education_fee: brand?.education_fee ? brand.education_fee.toLocaleString("ko-KR") : "",
    deposit: brand?.deposit ? brand.deposit.toLocaleString("ko-KR") : "",

    royalty_type: brand?.royalty_type ?? "",
    royalty_amount: brand?.royalty_amount ? brand.royalty_amount.toLocaleString("ko-KR") : "",

    standard_size_min: toStringOrEmpty(brand?.standard_size_min),
    standard_size_max: toStringOrEmpty(brand?.standard_size_max),
    standard_staff_count: toStringOrEmpty(brand?.standard_staff_count),
    territory_protection_meters: toStringOrEmpty(brand?.territory_protection_meters),
    contract_period_years: toStringOrEmpty(brand?.contract_period_years),

    interior_cost_per_pyeong: brand?.interior_cost_per_pyeong
      ? brand.interior_cost_per_pyeong.toLocaleString("ko-KR")
      : "",
    equipment_cost: brand?.equipment_cost ? brand.equipment_cost.toLocaleString("ko-KR") : "",
    initial_supplies_cost: brand?.initial_supplies_cost ? brand.initial_supplies_cost.toLocaleString("ko-KR") : "",
    signage_cost: brand?.signage_cost ? brand.signage_cost.toLocaleString("ko-KR") : "",
    other_cost: brand?.other_cost ? brand.other_cost.toLocaleString("ko-KR") : "",

    avg_ticket_price: brand?.avg_ticket_price ? brand.avg_ticket_price.toLocaleString("ko-KR") : "",
    avg_monthly_revenue: brand?.avg_monthly_revenue ? brand.avg_monthly_revenue.toLocaleString("ko-KR") : "",
    total_stores: toStringOrEmpty(brand?.total_stores),
    avg_close_rate: toStringOrEmpty(brand?.avg_close_rate),
    delivery_ratio: toStringOrEmpty(brand?.delivery_ratio),
    peak_hours: brand?.peak_hours ?? "",
    target_customer: brand?.target_customer ?? "",
    notes: brand?.notes ?? "",
    min_store_requirement: brand?.min_store_requirement ?? "",
  };
}

function buildPayload(values: FormValues): BrandPayload {
  const payload: BrandPayload = {
    brand_name: values.brand_name.trim(),
    company_name: values.company_name.trim(),
    representative: values.representative.trim() || undefined,
    business_number: values.business_number.trim() || undefined,
    address: values.address.trim() || undefined,
    phone: values.phone.trim() || undefined,

    industry: values.industry as Industry,
    category: values.category.trim() || undefined,
    price_tier: values.price_tier ? (values.price_tier as PriceTier) : undefined,

    franchise_fee: parseNumber(values.franchise_fee),
    education_fee: parseNumber(values.education_fee),
    deposit: parseNumber(values.deposit),

    royalty_type: values.royalty_type ? (values.royalty_type as RoyaltyType) : null,
    royalty_amount: values.royalty_type === "none" ? null : parseNumber(values.royalty_amount),

    standard_size_min: parseNumber(values.standard_size_min),
    standard_size_max: parseNumber(values.standard_size_max),
    standard_staff_count: parseNumber(values.standard_staff_count),
    territory_protection_meters: parseNumber(values.territory_protection_meters),
    contract_period_years: parseNumber(values.contract_period_years),

    interior_cost_per_pyeong: parseNumber(values.interior_cost_per_pyeong),
    equipment_cost: parseNumber(values.equipment_cost),
    initial_supplies_cost: parseNumber(values.initial_supplies_cost),
    signage_cost: parseNumber(values.signage_cost),
    other_cost: parseNumber(values.other_cost),

    avg_ticket_price: parseNumber(values.avg_ticket_price),
    avg_monthly_revenue: parseNumber(values.avg_monthly_revenue),
    total_stores: parseNumber(values.total_stores),
    avg_close_rate: parseNumber(values.avg_close_rate),
    delivery_ratio: parseNumber(values.delivery_ratio),
    peak_hours: values.peak_hours.trim() || undefined,
    target_customer: values.target_customer.trim() || undefined,
    notes: values.notes.trim() || undefined,
    min_store_requirement: values.min_store_requirement.trim() || undefined,
  };

  return payload;
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <input
      value={value}
      inputMode={inputMode}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground",
        "placeholder:text-muted-foreground",
        "outline-none transition",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
      )}
    />
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
  unit,
  inputMode = "numeric",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  unit?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40">
      <input
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(e) => onChange(formatNumberInput(e.target.value))}
        className="h-7 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      {unit ? <span className="shrink-0 text-xs font-medium text-muted-foreground">{unit}</span> : null}
    </div>
  );
}

function Section({
  title,
  description,
  defaultOpen,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      className="group rounded-2xl border border-border bg-card shadow-sm"
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-5">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-border p-5 pt-4">
        {children}
      </div>
    </details>
  );
}

export function BrandForm({ brand, onSuccess }: BrandFormProps) {
  const isEdit = Boolean(brand?.id);
  const [apiError, setApiError] = useState<string>("");

  const defaults = useMemo(() => buildDefaults(brand ?? null), [brand]);

  const {
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormInputValues>({
    defaultValues: defaults,
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);

  const royaltyType = watch("royalty_type");

  const onSubmit = handleSubmit(async (values) => {
    setApiError("");
    try {
      const parsed = formSchema.parse(values);
      const payload = buildPayload(parsed);

      const response = await fetch(isEdit ? `/api/brands/${brand!.id}` : "/api/brands", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await response.json()) as { brand?: DbBrand; message?: string };
      if (!response.ok) {
        throw new Error(json.message ?? "저장에 실패했습니다.");
      }

      toast.success(isEdit ? "브랜드 정보가 수정되었습니다." : "브랜드가 등록되었습니다.");
      onSuccess();
    } catch (error) {
      console.error("[brand save] failed", error);
      const message = error instanceof Error ? error.message : "저장에 실패했습니다.";
      setApiError(message);
      toast.error(message);
    }
  });

  const grid2 = "grid gap-4 sm:grid-cols-2";
  const grid3 = "grid gap-4 sm:grid-cols-3";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {brand?.id ? (
        <div className="flex items-center justify-end">
          <BrandAutoFill
            brandId={brand.id}
            onFill={(fields: BrandAutoFillFields) => {
              // Minimal mapping (numbers -> formatted strings)
              if (fields.company_name !== undefined) setValue("company_name", fields.company_name);
              if (fields.representative !== undefined) setValue("representative", fields.representative);

              if (fields.franchise_fee !== undefined) setValue("franchise_fee", fields.franchise_fee.toLocaleString("ko-KR"));
              if (fields.education_fee !== undefined) setValue("education_fee", fields.education_fee.toLocaleString("ko-KR"));
              if (fields.royalty_type !== undefined) setValue("royalty_type", fields.royalty_type);
              if (fields.royalty_amount !== undefined) setValue("royalty_amount", fields.royalty_amount.toLocaleString("ko-KR"));
              if (fields.interior_cost_per_pyeong !== undefined) {
                setValue("interior_cost_per_pyeong", fields.interior_cost_per_pyeong.toLocaleString("ko-KR"));
              }
              if (fields.territory_protection_meters !== undefined) {
                setValue("territory_protection_meters", String(fields.territory_protection_meters));
              }
              if (fields.contract_period_years !== undefined) {
                setValue("contract_period_years", String(fields.contract_period_years));
              }
              if (fields.total_stores !== undefined) setValue("total_stores", String(fields.total_stores));
            }}
          />
        </div>
      ) : null}

      <Section title="기본 정보" description="브랜드의 기본 식별 정보입니다." defaultOpen>
        <div className={grid2}>
          <Field label="브랜드명" required error={errors.brand_name?.message}>
            <TextInput
              value={watch("brand_name") ?? ""}
              onChange={(v) => setValue("brand_name", v)}
              placeholder="예: 프랜차이즈명"
            />
          </Field>

          <Field label="법인명" required error={errors.company_name?.message}>
            <TextInput
              value={watch("company_name") ?? ""}
              onChange={(v) => setValue("company_name", v)}
              placeholder="예: (주)프랜차이즈본사"
            />
          </Field>
        </div>

        <div className={grid2 + " mt-4"}>
          <Field label="대표자">
            <TextInput
              value={watch("representative") ?? ""}
              onChange={(v) => setValue("representative", v)}
              placeholder="예: 홍길동"
            />
          </Field>
          <Field label="사업자등록번호">
            <TextInput
              value={watch("business_number") ?? ""}
              onChange={(v) => setValue("business_number", v)}
              placeholder="예: 123-45-67890"
              inputMode="numeric"
            />
          </Field>
          <Field label="본사 주소">
            <TextInput
              value={watch("address") ?? ""}
              onChange={(v) => setValue("address", v)}
              placeholder="예: 서울특별시 강남구 ..."
            />
          </Field>
          <Field label="대표 전화">
            <TextInput
              value={watch("phone") ?? ""}
              onChange={(v) => setValue("phone", v)}
              placeholder="예: 02-1234-5678"
              inputMode="tel"
            />
          </Field>
        </div>
      </Section>

      <Section title="업종 분류" description="분석/추천에 사용되는 업종 분류입니다." defaultOpen>
        <div className={grid3}>
          <Field label="업종" required error={errors.industry?.message}>
            <select
              value={watch("industry") ?? ""}
              onChange={(e) => setValue("industry", e.target.value as FormValues["industry"])}
              className={cn(
                "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm",
                "text-foreground outline-none transition",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              )}
            >
              <option value="" disabled>
                업종 선택
              </option>
              {industryOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>

          <Field label="업종 세부">
            <TextInput
              value={watch("category") ?? ""}
              onChange={(v) => setValue("category", v)}
              placeholder="예: 커피, 치킨"
            />
          </Field>

          <Field label="가격대">
            <select
              value={watch("price_tier") ?? ""}
              onChange={(e) => setValue("price_tier", e.target.value as FormValues["price_tier"])}
              className={cn(
                "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm",
                "text-foreground outline-none transition",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              )}
            >
              <option value="">선택 안 함</option>
              {priceTierOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="가맹 조건" description="가맹 희망자에게 제시하는 핵심 비용입니다." defaultOpen>
        <div className={grid3}>
          <Field label="가맹비">
            <NumberInput
              value={watch("franchise_fee") ?? ""}
              onChange={(v) => setValue("franchise_fee", v)}
              placeholder="예: 10,000,000"
              unit="₩ 원"
            />
          </Field>
          <Field label="교육비">
            <NumberInput
              value={watch("education_fee") ?? ""}
              onChange={(v) => setValue("education_fee", v)}
              placeholder="예: 2,000,000"
              unit="₩ 원"
            />
          </Field>
          <Field label="보증금">
            <NumberInput
              value={watch("deposit") ?? ""}
              onChange={(v) => setValue("deposit", v)}
              placeholder="예: 5,000,000"
              unit="₩ 원"
            />
          </Field>
        </div>

        <div className={grid3 + " mt-4"}>
          <Field label="로열티 유형">
            <select
              value={watch("royalty_type") ?? ""}
              onChange={(e) => setValue("royalty_type", e.target.value as FormValues["royalty_type"])}
              className={cn(
                "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm",
                "text-foreground outline-none transition",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              )}
            >
              <option value="">선택 안 함</option>
              <option value="none">없음</option>
              <option value="fixed">고정(원/월)</option>
              <option value="rate">정률(%)</option>
            </select>
          </Field>
          {royaltyType && royaltyType !== "none" ? (
            <Field label="로열티 금액">
              <NumberInput
              value={watch("royalty_amount") ?? ""}
                onChange={(v) => setValue("royalty_amount", v)}
                placeholder={royaltyType === "rate" ? "예: 3" : "예: 300,000"}
                unit={royaltyType === "rate" ? "%" : "₩ 원"}
              />
            </Field>
          ) : (
            <div className="hidden sm:block" />
          )}
        </div>
      </Section>

      <Section title="매장 규격" description="표준 점포 조건(평수/인력/계약 등)" defaultOpen>
        <div className={grid3}>
          <Field label="최소 평수">
            <NumberInput
              value={watch("standard_size_min") ?? ""}
              onChange={(v) => setValue("standard_size_min", v)}
              placeholder="예: 10"
              unit="평"
              inputMode="decimal"
            />
          </Field>
          <Field label="최대 평수">
            <NumberInput
              value={watch("standard_size_max") ?? ""}
              onChange={(v) => setValue("standard_size_max", v)}
              placeholder="예: 25"
              unit="평"
              inputMode="decimal"
            />
          </Field>
          <Field label="표준 인력 수">
            <NumberInput
              value={watch("standard_staff_count") ?? ""}
              onChange={(v) => setValue("standard_staff_count", v)}
              placeholder="예: 3"
              unit="명"
            />
          </Field>
        </div>

        <div className={grid3 + " mt-4"}>
          <Field label="영업지역 보호 거리">
            <NumberInput
              value={watch("territory_protection_meters") ?? ""}
              onChange={(v) => setValue("territory_protection_meters", v)}
              placeholder="예: 500"
              unit="m"
            />
          </Field>
          <Field label="계약기간">
            <NumberInput
              value={watch("contract_period_years") ?? ""}
              onChange={(v) => setValue("contract_period_years", v)}
              placeholder="예: 2"
              unit="년"
              inputMode="decimal"
            />
          </Field>
          <div className="hidden sm:block" />
        </div>
      </Section>

      <Section title="비용 상세 (선택)" description="개점 비용 항목을 상세히 기록할 수 있어요.">
        <div className={grid3}>
          <Field label="인테리어 평당 비용">
            <NumberInput
              value={watch("interior_cost_per_pyeong") ?? ""}
              onChange={(v) => setValue("interior_cost_per_pyeong", v)}
              placeholder="예: 2,000,000"
              unit="₩ 원/평"
            />
          </Field>
          <Field label="주방설비">
            <NumberInput
              value={watch("equipment_cost") ?? ""}
              onChange={(v) => setValue("equipment_cost", v)}
              placeholder="예: 3,000,000"
              unit="₩ 원"
            />
          </Field>
          <Field label="초도물품">
            <NumberInput
              value={watch("initial_supplies_cost") ?? ""}
              onChange={(v) => setValue("initial_supplies_cost", v)}
              placeholder="예: 1,200,000"
              unit="₩ 원"
            />
          </Field>
          <Field label="간판">
            <NumberInput
              value={watch("signage_cost") ?? ""}
              onChange={(v) => setValue("signage_cost", v)}
              placeholder="예: 800,000"
              unit="₩ 원"
            />
          </Field>
          <Field label="기타">
            <NumberInput
              value={watch("other_cost") ?? ""}
              onChange={(v) => setValue("other_cost", v)}
              placeholder="예: 500,000"
              unit="₩ 원"
            />
          </Field>
        </div>
      </Section>

      <Section title="운영 정보 (선택)" description="분석 정확도를 높이는 운영 지표입니다.">
        <div className={grid3}>
          <Field label="평균 객단가">
            <NumberInput
              value={watch("avg_ticket_price") ?? ""}
              onChange={(v) => setValue("avg_ticket_price", v)}
              placeholder="예: 12,000"
              unit="₩ 원"
            />
          </Field>
          <Field label="월 평균 매출">
            <NumberInput
              value={watch("avg_monthly_revenue") ?? ""}
              onChange={(v) => setValue("avg_monthly_revenue", v)}
              placeholder="예: 50,000,000"
              unit="₩ 원"
            />
          </Field>
          <Field label="전체 점포수">
            <NumberInput
              value={watch("total_stores") ?? ""}
              onChange={(v) => setValue("total_stores", v)}
              placeholder="예: 120"
              unit="개"
            />
          </Field>
          <Field label="폐점률">
            <NumberInput
              value={watch("avg_close_rate") ?? ""}
              onChange={(v) => setValue("avg_close_rate", v)}
              placeholder="예: 3"
              unit="%"
              inputMode="decimal"
            />
          </Field>
          <Field label="배달 비율">
            <NumberInput
              value={watch("delivery_ratio") ?? ""}
              onChange={(v) => setValue("delivery_ratio", v)}
              placeholder="예: 40"
              unit="%"
              inputMode="decimal"
            />
          </Field>
          <Field label="피크 타임">
            <TextInput
              value={watch("peak_hours") ?? ""}
              onChange={(v) => setValue("peak_hours", v)}
              placeholder="예: 12:00~13:30, 18:00~20:00"
            />
          </Field>
        </div>

        <div className={grid2 + " mt-4"}>
          <Field label="타겟 고객">
            <TextInput
              value={watch("target_customer") ?? ""}
              onChange={(v) => setValue("target_customer", v)}
              placeholder="예: 20~30대 직장인"
            />
          </Field>
          <Field label="입지/매장 요구사항">
            <TextInput
              value={watch("min_store_requirement") ?? ""}
              onChange={(v) => setValue("min_store_requirement", v)}
              placeholder="예: 1층 권장, 배후수요 ..."
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="특이사항">
            <textarea
              value={watch("notes") ?? ""}
              onChange={(e) => setValue("notes", e.target.value)}
              rows={4}
              placeholder="운영/가맹 관련 특이사항을 기록해주세요"
              className={cn(
                "min-h-[96px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground",
                "placeholder:text-muted-foreground outline-none transition",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              )}
            />
          </Field>
        </div>
      </Section>

      {apiError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {apiError}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {isEdit ? "수정 저장" : "브랜드 등록"}
        </Button>
      </div>
    </form>
  );
}
