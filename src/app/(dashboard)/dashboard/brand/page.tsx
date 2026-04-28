"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChevronDown, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Database, DbKnowledgeDoc, Industry } from "@/types/database";

type BrandRow = Database["public"]["Tables"]["brands"]["Row"];

type BrandsGetResponse = {
  brand: BrandRow | null;
};

type BrandsUpsertResponse = {
  brand: BrandRow;
};

type ApiError = {
  message: string;
};

type BrandUpsertBody = Omit<Database["public"]["Tables"]["brands"]["Insert"], "id" | "user_id" | "created_at" | "updated_at">;

const industries: ReadonlyArray<{ label: string; value: Industry }> = [
  { label: "외식", value: "외식" },
  { label: "도소매", value: "도소매" },
  { label: "서비스", value: "서비스" },
];

const subIndustryOptions: Record<Industry, ReadonlyArray<string>> = {
  외식: [
    "한식", "분식", "중식", "일식", "서양식", "기타 외국식",
    "패스트푸드", "치킨", "피자", "제과제빵", "아이스크림/빙수",
    "커피", "음료(커피외)", "주점", "기타 외식",
  ],
  도소매: [
    "편의점", "의류/패션", "화장품", "농수산물", "(건강)식품",
    "종합소매점", "기타도소매",
  ],
  서비스: [
    "교육(교과)", "교육(외국어)", "기타 교육", "육아관련(교육 외)",
    "부동산 중개", "임대", "숙박", "육아관련", "스포츠 관련",
    "이미용", "자동차 관련", "PC방", "오락", "배달", "안경",
    "세탁", "이사", "운송", "반려동물 관련", "약국", "인력 파견", "기타 서비스",
  ],
};

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function addCommasToDigits(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatCurrencyInput(value: string) {
  const digits = digitsOnly(value);
  if (!digits) return "";
  const normalized = digits.replace(/^0+(?=\d)/, "");
  return addCommasToDigits(normalized);
}

function isValidNonNegativeIntDigits(digits: string) {
  if (digits.length === 0) return false;
  if (!/^\d+$/.test(digits)) return false;
  if (digits.length > 15) return false; // JS safe integer guardrail
  const n = Number(digits);
  return Number.isSafeInteger(n) && n >= 0;
}

function parseCurrencyToNumber(value: string) {
  const digits = digitsOnly(value);
  if (!digits) return null;
  if (!isValidNonNegativeIntDigits(digits)) return null;
  return Number(digits);
}

function parseOptionalPercent(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 100) return null;
  return n;
}

function parseOptionalInt(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

function parseRequiredNumber(value: string) {
  const trimmed = value.trim();
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return n;
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

const currencyRequired = z
  .string()
  .min(1, "필수 항목입니다.")
  .refine((v) => isValidNonNegativeIntDigits(digitsOnly(v)), "숫자만 입력해주세요.");

const currencyOptional = z
  .string()
  .optional()
  .refine(
    (v) => {
      if (v === undefined) return true;
      if (v.trim().length === 0) return true;
      return isValidNonNegativeIntDigits(digitsOnly(v));
    },
    { message: "숫자만 입력해주세요." },
  );

const percentOptional = z
  .string()
  .optional()
  .refine(
    (v) => {
      if (v === undefined) return true;
      if (v.trim().length === 0) return true;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n <= 100;
    },
    { message: "0~100 범위로 입력해주세요." },
  );

const intOptional = z
  .string()
  .optional()
  .refine(
    (v) => {
      if (v === undefined) return true;
      if (v.trim().length === 0) return true;
      const n = Number(v);
      return Number.isFinite(n) && Number.isInteger(n) && n >= 0;
    },
    { message: "0 이상의 정수만 입력해주세요." },
  );

const brandFormSchema = z.object({
  // 필수 섹션
  brand_name: z.string().trim().min(1, "브랜드명은 필수입니다.").max(200),
  industry: z.custom<Industry>((value) => typeof value === "string" && industries.some((i) => i.value === value), {
    message: "업종을 선택해주세요.",
  }),
  sub_industry: z.string().trim().min(1, "세부 업종은 필수입니다.").max(100),
  avg_store_size_pyeong: z
    .string()
    .min(1, "평균 점포 면적은 필수입니다.")
    .refine((v) => parseRequiredNumber(v) !== null, "0 이상의 숫자를 입력해주세요."),
  franchise_fee: currencyRequired,
  education_fee: currencyRequired,
  deposit: currencyRequired,

  // 선택 섹션
  interior_cost_per_pyeong: currencyOptional,
  equipment_cost: currencyOptional,
  initial_supplies_cost: currencyOptional,
  signage_cost: currencyOptional,
  other_cost: currencyOptional,

  royalty_rate: percentOptional,
  ad_contribution_rate: percentOptional,
  supply_cost_rate: percentOptional,

  avg_ticket_price: currencyOptional,
  avg_monthly_revenue: currencyOptional,

  min_store_requirement: z.string().optional(),
  target_customer: z.string().optional(),
  delivery_ratio: percentOptional,
  peak_hours: z.string().optional(),

  total_stores: intOptional,
  avg_close_rate: percentOptional,
  notes: z.string().optional(),
});

type BrandFormValues = z.infer<typeof brandFormSchema>;

const requiredKeys: ReadonlyArray<keyof BrandFormValues> = [
  "brand_name",
  "industry",
  "sub_industry",
  "avg_store_size_pyeong",
  "franchise_fee",
  "education_fee",
  "deposit",
];

const optionalKeys: ReadonlyArray<keyof BrandFormValues> = [
  "interior_cost_per_pyeong",
  "equipment_cost",
  "initial_supplies_cost",
  "signage_cost",
  "other_cost",
  "royalty_rate",
  "ad_contribution_rate",
  "supply_cost_rate",
  "avg_ticket_price",
  "avg_monthly_revenue",
  "min_store_requirement",
  "target_customer",
  "delivery_ratio",
  "peak_hours",
  "total_stores",
  "avg_close_rate",
  "notes",
];

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {required ? <span className="text-sm font-semibold text-red-600">*</span> : null}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-red-600">{message}</p>;
}

function TextInput(props: ComponentProps<"input">) {
  const { className, ...rest } = props;
  return (
    <input
      {...rest}
      className={cn(
        "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition",
        "placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10",
        className,
      )}
    />
  );
}

function TextArea(props: ComponentProps<"textarea">) {
  const { className, ...rest } = props;
  return (
    <textarea
      {...rest}
      className={cn(
        "min-h-24 w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition",
        "placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10",
        className,
      )}
    />
  );
}

function SelectInput(props: ComponentProps<"select">) {
  const { className, children, ...rest } = props;
  return (
    <div className="relative">
      <select
        {...rest}
        className={cn(
          "h-11 w-full appearance-none rounded-xl border border-input bg-background px-3 pr-10 text-sm text-foreground shadow-sm outline-none transition",
          "focus:border-primary focus:ring-4 focus:ring-primary/10",
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export default function BrandPage() {
  const router = useRouter();
  const [brandId, setBrandId] = useState<string | null>(null);
  const [isPrefilling, setIsPrefilling] = useState(true);
  const [knowledgeDocs, setKnowledgeDocs] = useState<DbKnowledgeDoc[]>([]);
  const [isKnowledgeLoading, setIsKnowledgeLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<BrandFormValues>({
    resolver: zodResolver(brandFormSchema),
    defaultValues: {
      brand_name: "",
      industry: "외식",
      sub_industry: "한식",
      avg_store_size_pyeong: "",
      franchise_fee: "",
      education_fee: "",
      deposit: "",

      interior_cost_per_pyeong: "",
      equipment_cost: "",
      initial_supplies_cost: "",
      signage_cost: "",
      other_cost: "",

      royalty_rate: "",
      ad_contribution_rate: "",
      supply_cost_rate: "",

      avg_ticket_price: "",
      avg_monthly_revenue: "",

      min_store_requirement: "",
      target_customer: "",
      delivery_ratio: "",
      peak_hours: "",

      total_stores: "",
      avg_close_rate: "",
      notes: "",
    },
    mode: "onBlur",
  });

  useEffect(() => {
    let cancelled = false;

    async function prefill() {
      try {
        setIsPrefilling(true);
        const response = await fetch("/api/brands", { method: "GET" });
        const result = (await response.json()) as BrandsGetResponse | ApiError;

        if (!response.ok) {
          const message = "message" in result ? result.message : "브랜드 정보를 불러오지 못했습니다.";
          throw new Error(message);
        }

        if (cancelled) return;

        const brand = (result as BrandsGetResponse).brand;
        if (!brand) {
          setBrandId(null);
          return;
        }

        setBrandId(brand.id);
        reset({
          brand_name: brand.brand_name ?? "",
          industry: brand.industry,
          sub_industry: brand.sub_industry ?? "",
          avg_store_size_pyeong:
            brand.avg_store_size_pyeong === null || brand.avg_store_size_pyeong === undefined
              ? ""
              : String(brand.avg_store_size_pyeong),
          franchise_fee: brand.franchise_fee === null ? "" : addCommasToDigits(String(brand.franchise_fee)),
          education_fee: brand.education_fee === null ? "" : addCommasToDigits(String(brand.education_fee)),
          deposit: brand.deposit === null ? "" : addCommasToDigits(String(brand.deposit)),

          interior_cost_per_pyeong:
            brand.interior_cost_per_pyeong === null ? "" : addCommasToDigits(String(brand.interior_cost_per_pyeong)),
          equipment_cost: brand.equipment_cost === null ? "" : addCommasToDigits(String(brand.equipment_cost)),
          initial_supplies_cost:
            brand.initial_supplies_cost === null ? "" : addCommasToDigits(String(brand.initial_supplies_cost)),
          signage_cost: brand.signage_cost === null ? "" : addCommasToDigits(String(brand.signage_cost)),
          other_cost: brand.other_cost === null ? "" : addCommasToDigits(String(brand.other_cost)),

          royalty_rate: brand.royalty_rate === null ? "" : String(brand.royalty_rate),
          ad_contribution_rate: brand.ad_contribution_rate === null ? "" : String(brand.ad_contribution_rate),
          supply_cost_rate: brand.supply_cost_rate === null ? "" : String(brand.supply_cost_rate),

          avg_ticket_price: brand.avg_ticket_price === null ? "" : addCommasToDigits(String(brand.avg_ticket_price)),
          avg_monthly_revenue:
            brand.avg_monthly_revenue === null ? "" : addCommasToDigits(String(brand.avg_monthly_revenue)),

          min_store_requirement: brand.min_store_requirement ?? "",
          target_customer: brand.target_customer ?? "",
          delivery_ratio: brand.delivery_ratio === null ? "" : String(brand.delivery_ratio),
          peak_hours: brand.peak_hours ?? "",

          total_stores: brand.total_stores === null ? "" : String(brand.total_stores),
          avg_close_rate: brand.avg_close_rate === null ? "" : String(brand.avg_close_rate),
          notes: brand.notes ?? "",
        });
      } catch (error) {
        console.error("[brand page] prefill failed", error);
        toast.error(error instanceof Error ? error.message : "브랜드 정보를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setIsPrefilling(false);
      }
    }

    void prefill();

    return () => {
      cancelled = true;
    };
  }, [reset]);

  const fetchKnowledgeDocs = async () => {
    try {
      setIsKnowledgeLoading(true);
      const response = await fetch("/api/knowledge");
      const json = (await response.json()) as { docs?: DbKnowledgeDoc[]; error?: string };
      if (!response.ok) throw new Error(json.error ?? "FAQ 문서를 불러오지 못했습니다.");
      setKnowledgeDocs(json.docs ?? []);
    } catch (error) {
      console.error("[brand page] fetchKnowledgeDocs failed", error);
      toast.error(error instanceof Error ? error.message : "FAQ 문서를 불러오지 못했습니다.");
    } finally {
      setIsKnowledgeLoading(false);
    }
  };

  useEffect(() => {
    void fetchKnowledgeDocs();
  }, []);

  const handleUploadKnowledge = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/knowledge", {
        method: "POST",
        body: formData,
      });

      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "문서 업로드에 실패했습니다.");

      toast.success("FAQ 문서를 업로드했습니다.");
      await fetchKnowledgeDocs();
      event.target.value = "";
    } catch (error) {
      console.error("[brand page] handleUploadKnowledge failed", error);
      toast.error(error instanceof Error ? error.message : "문서 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteKnowledge = async (id: string) => {
    try {
      const response = await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "문서 삭제에 실패했습니다.");
      toast.success("FAQ 문서를 삭제했습니다.");
      await fetchKnowledgeDocs();
    } catch (error) {
      console.error("[brand page] handleDeleteKnowledge failed", error);
      toast.error(error instanceof Error ? error.message : "문서 삭제에 실패했습니다.");
    }
  };

  const watchedIndustry = watch("industry");

  // Reset sub_industry when industry changes (but not during initial prefill)
  useEffect(() => {
    if (isPrefilling) return;
    const options = subIndustryOptions[watchedIndustry] ?? [];
    const currentSub = getValues("sub_industry");
    if (!options.includes(currentSub)) {
      setValue("sub_industry", options[0] ?? "", { shouldDirty: true });
    }
  }, [watchedIndustry, isPrefilling, getValues, setValue]);

  const values = watch();
  const completion = useMemo(() => {
    const total = requiredKeys.length + optionalKeys.length;
    const filled = [...requiredKeys, ...optionalKeys].reduce((acc, key) => {
      const value = values[key];
      if (typeof value === "string") {
        return acc + (value.trim().length > 0 ? 1 : 0);
      }
      return acc;
    }, 0);

    return Math.round((filled / total) * 100);
  }, [values]);

  const onSubmit = async (formValues: BrandFormValues) => {
    const avgStoreSize = parseRequiredNumber(formValues.avg_store_size_pyeong);
    const franchiseFee = parseCurrencyToNumber(formValues.franchise_fee);
    const educationFee = parseCurrencyToNumber(formValues.education_fee);
    const deposit = parseCurrencyToNumber(formValues.deposit);

    if (avgStoreSize === null || franchiseFee === null || educationFee === null || deposit === null) {
      toast.error("필수 입력값을 확인해주세요.");
      return;
    }

    const payload: BrandUpsertBody = {
      brand_name: formValues.brand_name.trim(),
      industry: formValues.industry,
      sub_industry: emptyToNull(formValues.sub_industry),
      avg_store_size_pyeong: avgStoreSize,
      franchise_fee: franchiseFee,
      education_fee: educationFee,
      deposit,
      logo_url: null,
      interior_cost_per_pyeong: parseCurrencyToNumber(formValues.interior_cost_per_pyeong ?? ""),
      equipment_cost: parseCurrencyToNumber(formValues.equipment_cost ?? ""),
      initial_supplies_cost: parseCurrencyToNumber(formValues.initial_supplies_cost ?? ""),
      signage_cost: parseCurrencyToNumber(formValues.signage_cost ?? ""),
      other_cost: parseCurrencyToNumber(formValues.other_cost ?? ""),
      royalty_rate: parseOptionalPercent(formValues.royalty_rate ?? ""),
      ad_contribution_rate: parseOptionalPercent(formValues.ad_contribution_rate ?? ""),
      supply_cost_rate: parseOptionalPercent(formValues.supply_cost_rate ?? ""),
      avg_ticket_price: parseCurrencyToNumber(formValues.avg_ticket_price ?? ""),
      avg_monthly_revenue: parseCurrencyToNumber(formValues.avg_monthly_revenue ?? ""),
      min_store_requirement: emptyToNull(formValues.min_store_requirement ?? ""),
      target_customer: emptyToNull(formValues.target_customer ?? ""),
      delivery_ratio: parseOptionalPercent(formValues.delivery_ratio ?? ""),
      peak_hours: emptyToNull(formValues.peak_hours ?? ""),
      total_stores: parseOptionalInt(formValues.total_stores ?? ""),
      avg_close_rate: parseOptionalPercent(formValues.avg_close_rate ?? ""),
      notes: emptyToNull(formValues.notes ?? ""),
    };

    try {
      const method = brandId ? "PUT" : "POST";
      const url = brandId ? `/api/brands/${brandId}` : "/api/brands";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as BrandsUpsertResponse | ApiError;
      if (!response.ok) {
        const message = "message" in result ? result.message : "저장에 실패했습니다.";
        throw new Error(message);
      }

      const saved = (result as BrandsUpsertResponse).brand;
      setBrandId(saved.id);
      toast.success("브랜드 정보가 저장되었습니다.");
      // 레이아웃 서버 컴포넌트 재실행 → 네비게이션 hasBrand 상태 갱신
      router.refresh();
    } catch (error) {
      console.error("[brand page] save failed", error);
      toast.error(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Brand</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">브랜드 정보 등록/수정</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              필수 정보부터 입력하고, 필요하면 추가 정보를 확장해 상세 데이터를 쌓아주세요.
            </p>
          </div>

          <div className="w-full max-w-sm">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">완성도</span>
              <span className="tabular-nums text-muted-foreground">{completion}%</span>
            </div>
            <div className="mt-2">
              <ProgressBar value={completion} />
            </div>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">필수 정보</h2>
            {isPrefilling ? (
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                불러오는 중
              </span>
            ) : null}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel label="브랜드명" required />
              <TextInput placeholder="예: 프랜차이즈스코프" {...register("brand_name")} />
              <FieldError message={errors.brand_name?.message} />
            </div>

            <div className="space-y-2">
              <FieldLabel label="업종" required />
              <SelectInput {...register("industry")}>
                {industries.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
              <FieldError message={errors.industry?.message} />
            </div>

            <div className="space-y-2">
              <FieldLabel label="세부 업종" required />
              <SelectInput {...register("sub_industry")}>
                {(subIndustryOptions[watchedIndustry] ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </SelectInput>
              <FieldError message={errors.sub_industry?.message} />
            </div>

            <div className="space-y-2">
              <FieldLabel label="평균 점포 면적 (평)" required />
              <TextInput inputMode="decimal" placeholder="예: 18.5" {...register("avg_store_size_pyeong")} />
              <FieldError message={errors.avg_store_size_pyeong?.message} />
            </div>

            <div className="space-y-2">
              <FieldLabel label="가맹비 (원)" required />
              <TextInput
                inputMode="numeric"
                placeholder="예: 10,000,000"
                {...register("franchise_fee")}
                onChange={(event) => {
                  const formatted = formatCurrencyInput(event.target.value);
                  setValue("franchise_fee", formatted, { shouldDirty: true, shouldValidate: true });
                }}
              />
              <FieldError message={errors.franchise_fee?.message} />
            </div>

            <div className="space-y-2">
              <FieldLabel label="교육비 (원)" required />
              <TextInput
                inputMode="numeric"
                placeholder="예: 2,000,000"
                {...register("education_fee")}
                onChange={(event) => {
                  const formatted = formatCurrencyInput(event.target.value);
                  setValue("education_fee", formatted, { shouldDirty: true, shouldValidate: true });
                }}
              />
              <FieldError message={errors.education_fee?.message} />
            </div>

            <div className="space-y-2 lg:col-span-2">
              <FieldLabel label="보증금 (원)" required />
              <TextInput
                inputMode="numeric"
                placeholder="예: 5,000,000"
                {...register("deposit")}
                onChange={(event) => {
                  const formatted = formatCurrencyInput(event.target.value);
                  setValue("deposit", formatted, { shouldDirty: true, shouldValidate: true });
                }}
              />
              <FieldError message={errors.deposit?.message} />
            </div>
          </div>
        </section>

        <details className="group rounded-2xl border border-border bg-card shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6">
            <div>
              <h2 className="text-base font-semibold text-foreground">추가 정보 (선택)</h2>
              <p className="mt-1 text-sm text-muted-foreground">투자 비용/지표/운영 정보까지 확장 입력</p>
            </div>
            <ChevronDown className="size-5 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-border p-6">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel label="인테리어 평당 단가 (원)" />
                <TextInput
                  inputMode="numeric"
                  placeholder="예: 1,800,000"
                  {...register("interior_cost_per_pyeong")}
                  onChange={(event) => {
                    const formatted = formatCurrencyInput(event.target.value);
                    setValue("interior_cost_per_pyeong", formatted, { shouldDirty: true, shouldValidate: true });
                  }}
                />
                <FieldError message={errors.interior_cost_per_pyeong?.message} />
              </div>

              <div className="space-y-2">
                <FieldLabel label="주방기기 비용 (원)" />
                <TextInput
                  inputMode="numeric"
                  placeholder="예: 12,000,000"
                  {...register("equipment_cost")}
                  onChange={(event) => {
                    const formatted = formatCurrencyInput(event.target.value);
                    setValue("equipment_cost", formatted, { shouldDirty: true, shouldValidate: true });
                  }}
                />
                <FieldError message={errors.equipment_cost?.message} />
              </div>

              <div className="space-y-2">
                <FieldLabel label="초도 원부자재 (원)" />
                <TextInput
                  inputMode="numeric"
                  placeholder="예: 3,500,000"
                  {...register("initial_supplies_cost")}
                  onChange={(event) => {
                    const formatted = formatCurrencyInput(event.target.value);
                    setValue("initial_supplies_cost", formatted, { shouldDirty: true, shouldValidate: true });
                  }}
                />
                <FieldError message={errors.initial_supplies_cost?.message} />
              </div>

              <div className="space-y-2">
                <FieldLabel label="간판 비용 (원)" />
                <TextInput
                  inputMode="numeric"
                  placeholder="예: 2,200,000"
                  {...register("signage_cost")}
                  onChange={(event) => {
                    const formatted = formatCurrencyInput(event.target.value);
                    setValue("signage_cost", formatted, { shouldDirty: true, shouldValidate: true });
                  }}
                />
                <FieldError message={errors.signage_cost?.message} />
              </div>

              <div className="space-y-2 lg:col-span-2">
                <FieldLabel label="기타 비용 (원)" />
                <TextInput
                  inputMode="numeric"
                  placeholder="예: 1,000,000"
                  {...register("other_cost")}
                  onChange={(event) => {
                    const formatted = formatCurrencyInput(event.target.value);
                    setValue("other_cost", formatted, { shouldDirty: true, shouldValidate: true });
                  }}
                />
                <FieldError message={errors.other_cost?.message} />
              </div>

              <div className="space-y-2">
                <FieldLabel label="로열티율 (%)" />
                <TextInput inputMode="decimal" placeholder="예: 3.5" {...register("royalty_rate")} />
                <FieldError message={errors.royalty_rate?.message} />
              </div>

              <div className="space-y-2">
                <FieldLabel label="광고분담금율 (%)" />
                <TextInput inputMode="decimal" placeholder="예: 1" {...register("ad_contribution_rate")} />
                <FieldError message={errors.ad_contribution_rate?.message} />
              </div>

              <div className="space-y-2 lg:col-span-2">
                <FieldLabel label="본사 공급원가율 (%)" />
                <TextInput inputMode="decimal" placeholder="예: 35" {...register("supply_cost_rate")} />
                <FieldError message={errors.supply_cost_rate?.message} />
              </div>

              <div className="space-y-2">
                <FieldLabel label="평균 객단가 (원)" />
                <TextInput
                  inputMode="numeric"
                  placeholder="예: 15,000"
                  {...register("avg_ticket_price")}
                  onChange={(event) => {
                    const formatted = formatCurrencyInput(event.target.value);
                    setValue("avg_ticket_price", formatted, { shouldDirty: true, shouldValidate: true });
                  }}
                />
                <FieldError message={errors.avg_ticket_price?.message} />
              </div>

              <div className="space-y-2">
                <FieldLabel label="자사 가맹점 평균 월매출 (원)" />
                <TextInput
                  inputMode="numeric"
                  placeholder="예: 60,000,000"
                  {...register("avg_monthly_revenue")}
                  onChange={(event) => {
                    const formatted = formatCurrencyInput(event.target.value);
                    setValue("avg_monthly_revenue", formatted, { shouldDirty: true, shouldValidate: true });
                  }}
                />
                <FieldError message={errors.avg_monthly_revenue?.message} />
              </div>

              <div className="space-y-2 lg:col-span-2">
                <FieldLabel label="개설 기준" />
                <TextArea placeholder="예: 상권/면적/주차 등 필수 조건" {...register("min_store_requirement")} />
              </div>

              <div className="space-y-2">
                <FieldLabel label="핵심 타깃" />
                <TextInput placeholder="예: 20~30대 직장인" {...register("target_customer")} />
              </div>

              <div className="space-y-2">
                <FieldLabel label="배달 비중 (%)" />
                <TextInput inputMode="decimal" placeholder="예: 45" {...register("delivery_ratio")} />
                <FieldError message={errors.delivery_ratio?.message} />
              </div>

              <div className="space-y-2 lg:col-span-2">
                <FieldLabel label="피크 시간대" />
                <TextInput placeholder="예: 12~14시, 18~21시" {...register("peak_hours")} />
              </div>

              <div className="space-y-2">
                <FieldLabel label="전체 가맹점 수" />
                <TextInput inputMode="numeric" placeholder="예: 120" {...register("total_stores")} />
                <FieldError message={errors.total_stores?.message} />
              </div>

              <div className="space-y-2">
                <FieldLabel label="평균 폐점률 (%)" />
                <TextInput inputMode="decimal" placeholder="예: 2.4" {...register("avg_close_rate")} />
                <FieldError message={errors.avg_close_rate?.message} />
              </div>

              <div className="space-y-2 lg:col-span-2">
                <FieldLabel label="기타 참고사항" />
                <TextArea placeholder="추가로 기록해둘 내용이 있다면 입력하세요." {...register("notes")} />
              </div>
            </div>
          </div>
        </details>

        <div className="flex items-center justify-end gap-3">
          <Button type="submit" size="lg" className="h-11 rounded-xl" disabled={isSubmitting || isPrefilling}>
            {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
            저장
          </Button>
        </div>
      </form>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">AI 상담 지식베이스 (FAQ)</h2>
            <p className="mt-1 text-sm text-muted-foreground">PDF/DOCX/TXT/MD 문서를 업로드하면 AI 상담에서 참고합니다.</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-input px-3 py-2 text-sm hover:bg-muted">
            {isUploading ? <LoaderCircle className="size-4 animate-spin" /> : null}
            파일 업로드
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="hidden"
              onChange={(event) => void handleUploadKnowledge(event)}
              disabled={isUploading}
            />
          </label>
        </div>

        <div className="mt-4 rounded-xl border border-border">
          {isKnowledgeLoading ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" /> 불러오는 중...
            </div>
          ) : knowledgeDocs.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">업로드된 FAQ 문서가 없습니다.</p>
          ) : (
            <ul className="divide-y divide-border">
              {knowledgeDocs.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleString("ko-KR")}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => void handleDeleteKnowledge(doc.id)}>
                    삭제
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
