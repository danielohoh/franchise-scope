"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/PageContainer";
import { PdfUploader } from "@/components/disclosure/PdfUploader";
import { ParseProgressTracker } from "@/components/disclosure/ParseProgressTracker";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BrandOption = {
  id: string;
  brand_name: string;
};

type BrandsApiResponse =
  | { brand: BrandOption | null }
  | { brands: BrandOption[] }
  | { data: BrandOption[] };

type ApiError = { message?: string; error?: string };

type StepStatus = "todo" | "current" | "done";

function Stepper({
  steps,
}: {
  steps: Array<{ title: string; description: string; status: StepStatus }>;
}) {
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {steps.map((s, idx) => (
        <li
          key={s.title}
          className={cn(
            "rounded-2xl border bg-card p-4 shadow-sm",
            s.status === "done"
              ? "border-emerald-600/20"
              : s.status === "current"
                ? "border-primary/25"
                : "border-border",
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-xl border",
                s.status === "done"
                  ? "border-emerald-600/25 bg-emerald-500/10"
                  : s.status === "current"
                    ? "border-primary/25 bg-primary/10"
                    : "border-border bg-background",
              )}
            >
              {s.status === "done" ? (
                <CheckCircle2 className="size-4 text-emerald-700" />
              ) : (
                <span className="text-sm font-semibold text-foreground tabular-nums">{idx + 1}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-heading text-sm font-semibold text-foreground">{s.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function DisclosureUploadPage() {
  const router = useRouter();

  const [brands, setBrands] = React.useState<BrandOption[]>([]);
  const [brandId, setBrandId] = React.useState<string>("");
  const [loadingBrands, setLoadingBrands] = React.useState(true);

  const [disclosureId, setDisclosureId] = React.useState<string | null>(null);

  React.useEffect(() => {
    void (async () => {
      setLoadingBrands(true);
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
              ? (((json as ApiError).message ?? (json as ApiError).error) || "브랜드 정보를 불러오지 못했습니다.")
              : "브랜드 정보를 불러오지 못했습니다.";
          throw new Error(message);
        }

        const data = (json ?? {}) as BrandsApiResponse;
        const list: BrandOption[] =
          "brands" in data && Array.isArray(data.brands)
            ? data.brands
            : "data" in data && Array.isArray(data.data)
              ? data.data
              : "brand" in data && data.brand
                ? [data.brand]
                : [];

        setBrands(list);
        if (list.length === 1) setBrandId(list[0]!.id);
      } catch (error) {
        console.error("[disclosure upload] brands fetch failed", error);
        toast.error(error instanceof Error ? error.message : "브랜드 정보를 불러오지 못했습니다.");
        setBrands([]);
      } finally {
        setLoadingBrands(false);
      }
    })();
  }, []);

  const currentStep: 1 | 2 | 3 = disclosureId ? 3 : brandId ? 2 : 1;
  const steps = [
    {
      title: "브랜드 선택",
      description: "정보공개서를 연결할 브랜드를 선택합니다.",
      status: currentStep > 1 ? ("done" as const) : ("current" as const),
    },
    {
      title: "PDF 업로드",
      description: "20MB 이하 PDF 파일을 업로드합니다.",
      status: currentStep > 2 ? ("done" as const) : currentStep === 2 ? ("current" as const) : ("todo" as const),
    },
    {
      title: "자동 파싱",
      description: "섹션별 데이터를 추출하고 저장합니다.",
      status: currentStep === 3 ? ("current" as const) : ("todo" as const),
    },
  ];

  return (
    <PageContainer
      title="정보공개서 업로드"
      description="업로드 → 파싱 → 검토까지 한 번에 진행합니다."
      backHref="/disclosure"
    >
      <div className="space-y-6">
        <Stepper steps={steps} />

        <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-heading text-base font-semibold">Step 1. 브랜드 선택</h2>
              <p className="mt-1 text-sm text-muted-foreground">업로드한 문서는 선택한 브랜드에 귀속됩니다.</p>
            </div>
          </div>

          <div className="mt-4">
            {loadingBrands ? (
              <div className="h-11 w-full max-w-md animate-pulse rounded-xl bg-muted" />
            ) : brands.length === 0 ? (
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-sm font-medium text-foreground">등록된 브랜드가 없습니다.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  먼저 브랜드 정보를 등록한 뒤 정보공개서를 업로드해주세요.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link href="/brand" className={cn(buttonVariants({ variant: "default" }), "rounded-xl")}>
                    브랜드 등록하러 가기
                  </Link>
                  <Link href="/disclosure" className={cn(buttonVariants({ variant: "secondary" }), "rounded-xl")}>
                    목록으로
                  </Link>
                </div>
              </div>
            ) : (
              <div className="max-w-md">
                <label className="block text-xs font-medium text-muted-foreground">브랜드</label>
                <div className="mt-2 flex items-center gap-2">
                  <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.currentTarget.value)}
                    className={cn(
                      "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground",
                      "outline-none focus:ring-3 focus:ring-ring/30",
                      "disabled:opacity-70",
                    )}
                    disabled={brands.length <= 1 || Boolean(disclosureId)}
                  >
                    <option value="" disabled>
                      브랜드를 선택하세요
                    </option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.brand_name}
                      </option>
                    ))}
                  </select>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
          <div>
            <h2 className="font-heading text-base font-semibold">Step 2. PDF 업로드</h2>
            <p className="mt-1 text-sm text-muted-foreground">업로드가 완료되면 자동으로 파싱이 시작됩니다.</p>
          </div>

          <div className="mt-4">
            {brandId ? (
              <PdfUploader
                brandId={brandId}
                onUploadCompleteAction={(id) => {
                  setDisclosureId(id);
                }}
              />
            ) : (
              <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                브랜드를 선택하면 업로드를 진행할 수 있어요.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-base font-semibold">Step 3. 자동 파싱</h2>
              <p className="mt-1 text-sm text-muted-foreground">완료되면 상세 페이지로 이동합니다.</p>
            </div>
            {disclosureId ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                disclosure_id: <span className="font-mono text-foreground">{disclosureId}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-4">
            {disclosureId ? (
              <ParseProgressTracker
                disclosureId={disclosureId}
                onCompleteAction={() => {
                  router.push(`/disclosure/${disclosureId}`);
                }}
              />
            ) : (
              <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                PDF 업로드가 완료되면 자동 파싱이 시작됩니다.
              </div>
            )}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/disclosure" className={cn(buttonVariants({ variant: "secondary" }), "rounded-xl")}>
            목록으로
          </Link>
          <Button
            type="button"
            variant="ghost"
            className="rounded-xl"
            onClick={() => router.refresh()}
          >
            새로고침
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
