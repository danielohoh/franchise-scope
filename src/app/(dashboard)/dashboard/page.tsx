import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarDays,
  FileText,
  Plus,
  Sparkles,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/PageContainer";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AnalysisStatus, Recommendation } from "@/types/database";

// 인증 + 실시간 데이터 → 정적 생성 비활성화
export const dynamic = "force-dynamic";

// ── Types ────────────────────────────────────────────────────────────────────

type DashboardAnalysisRow = {
  id: string;
  address: string;
  brand_name: string;
  total_score: number | null;
  recommendation: Recommendation | null;
  status: AnalysisStatus;
  created_at: string;
};

type DashboardData = {
  userName: string;
  brandName: string | null;
  disclosureCount: number;
  completedCount: number;
  thisMonthCount: number;
  recentAnalyses: DashboardAnalysisRow[];
};

// ── Demo fallback ────────────────────────────────────────────────────────────

const DEMO_DATA: DashboardData = {
  userName: "데모 사용자",
  brandName: "데모 브랜드",
  disclosureCount: 0,
  completedCount: 0,
  thisMonthCount: 0,
  recentAnalyses: [],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatToday(): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function statusLabel(status: AnalysisStatus): string {
  if (status === "pending") return "대기";
  if (status === "collecting") return "수집 중";
  if (status === "collected") return "수집 완료";
  if (status === "generating") return "보고서 생성";
  if (status === "completed") return "완료";
  return "실패";
}

function statusBadgeClass(status: AnalysisStatus): string {
  if (status === "completed") return "bg-emerald-500/10 text-emerald-700 ring-emerald-600/20";
  if (status === "failed") return "bg-rose-500/10 text-rose-700 ring-rose-600/20";
  if (status === "collecting" || status === "generating")
    return "bg-sky-500/10 text-sky-700 ring-sky-600/20";
  if (status === "collected") return "bg-indigo-500/10 text-indigo-700 ring-indigo-600/20";
  return "bg-muted text-muted-foreground ring-border";
}

function recommendationBadgeClass(rec: Recommendation | null): string {
  if (rec === "적극추천") return "bg-emerald-500/10 text-emerald-700 ring-emerald-600/20";
  if (rec === "조건부추천") return "bg-sky-500/10 text-sky-700 ring-sky-600/20";
  if (rec === "재검토필요") return "bg-amber-500/10 text-amber-700 ring-amber-600/20";
  if (rec === "반려") return "bg-rose-500/10 text-rose-700 ring-rose-600/20";
  return "bg-muted text-muted-foreground ring-border";
}

// ── Server data load ────────────────────────────────────────────────────────

async function loadDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // 이번 달 1일 00:00 (로컬 KST 기준이지만 created_at은 UTC ISO이므로 약간의 오차 허용)
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { data: profile },
    { data: brand },
    recentRes,
    disclosureCountRes,
    completedCountRes,
    thisMonthCountRes,
  ] = await Promise.all([
    supabase.from("users").select("name").eq("id", user.id).maybeSingle(),
    supabase
      .from("brands")
      .select("id, brand_name")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("analyses")
      .select("id, address, total_score, recommendation, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("disclosures")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("analyses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed"),
    supabase
      .from("analyses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", firstOfMonth),
  ]);

  if (!profile) {
    redirect("/auth/signup");
  }

  const userName = profile.name ?? user.email ?? "사용자";
  const brandName = brand?.brand_name ?? null;
  const brandLabel = brandName ?? "브랜드";

  const recentAnalyses: DashboardAnalysisRow[] = (recentRes.data ?? []).map((row) => ({
    id: row.id,
    address: row.address,
    brand_name: brandLabel,
    total_score: row.total_score,
    recommendation: row.recommendation,
    status: row.status,
    created_at: row.created_at,
  }));

  return {
    userName,
    brandName,
    disclosureCount: disclosureCountRes.count ?? 0,
    completedCount: completedCountRes.count ?? 0,
    thisMonthCount: thisMonthCountRes.count ?? 0,
    recentAnalyses,
  };
}

// ── UI sub-components (server-renderable) ───────────────────────────────────

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper?: string;
  accentClass?: string;
};

function StatCard({ icon, label, value, helper, accentClass }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {value}
          </p>
          {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
        </div>
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            accentClass ?? "bg-muted text-foreground",
          )}
          aria-hidden
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function NoBrandCTA() {
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            aria-hidden
          >
            <Sparkles className="size-6" />
          </div>
          <div className="space-y-1">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              먼저 브랜드를 등록하세요
            </h2>
            <p className="text-sm text-muted-foreground">
              브랜드 기본 정보가 등록되어야 정보공개서 업로드와 상권분석을 시작할 수 있어요.
            </p>
          </div>
        </div>
        <Link
          href="/brand"
          className={cn(buttonVariants({ size: "lg" }), "shrink-0 rounded-xl")}
        >
          브랜드 등록하기
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

function RecentAnalysesEmpty({ disabled }: { disabled: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-10 text-center text-card-foreground shadow-sm">
      <p className="text-base font-semibold text-foreground">아직 생성된 상권분석이 없습니다.</p>
      <p className="mt-2 text-sm text-muted-foreground">
        주소 하나로 빠르게 상권분석 보고서를 생성해보세요.
      </p>
      <div className="mt-6 flex justify-center">
        <Link
          href={disabled ? "/brand" : "/analysis/new"}
          aria-disabled={disabled}
          className={cn(
            buttonVariants({ size: "lg" }),
            "rounded-xl",
            disabled && "pointer-events-none opacity-60",
          )}
        >
          <Plus className="size-4" />
          {disabled ? "브랜드 등록 먼저" : "새 상권분석 시작"}
        </Link>
      </div>
    </div>
  );
}

function RecentAnalysesTable({ rows }: { rows: DashboardAnalysisRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[960px] w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">주소</th>
              <th className="px-4 py-3 text-left">브랜드</th>
              <th className="px-4 py-3 text-left">종합점수</th>
              <th className="px-4 py-3 text-left">권고</th>
              <th className="px-4 py-3 text-left">생성일</th>
              <th className="px-4 py-3 text-right">보기</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const isComplete = row.status === "completed";
              const recBadgeText = row.recommendation ?? statusLabel(row.status);
              const badgeClass = isComplete
                ? recommendationBadgeClass(row.recommendation)
                : statusBadgeClass(row.status);

              return (
                <tr key={row.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <Link
                      href={`/analysis/${row.id}`}
                      className="block min-w-[280px] font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {row.address}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">{row.brand_name}</span>
                  </td>
                  <td className="px-4 py-3">
                    {typeof row.total_score === "number" && Number.isFinite(row.total_score) ? (
                      <span className="font-semibold tabular-nums text-foreground">
                        {Math.round(row.total_score)}점
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                        badgeClass,
                      )}
                    >
                      {recBadgeText}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(row.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/analysis/${row.id}`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "rounded-xl",
                      )}
                    >
                      보기
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const data = isDemoMode ? DEMO_DATA : await loadDashboardData();

  const hasBrand = Boolean(data.brandName);
  const todayLabel = formatToday();

  const newAnalysisHref = hasBrand ? "/analysis/new" : "/brand";
  const newAnalysisLabel = hasBrand ? "새 상권분석 시작" : "브랜드 등록하기";

  return (
    <PageContainer
      title={`안녕하세요, ${data.userName}님`}
      description={todayLabel}
      action={
        <Link
          href={newAnalysisHref}
          className={cn(buttonVariants({ size: "lg" }), "rounded-xl")}
        >
          <Plus className="size-4" />
          {newAnalysisLabel}
        </Link>
      }
    >
      <div className="space-y-8">
        {!hasBrand ? <NoBrandCTA /> : null}

        {/* Quick stats */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Building2 className="size-5" />}
            label="등록 브랜드"
            value={data.brandName ?? "미등록"}
            helper={hasBrand ? "브랜드 정보 관리" : "지금 등록하세요"}
            accentClass="bg-primary/10 text-primary"
          />
          <StatCard
            icon={<FileText className="size-5" />}
            label="정보공개서"
            value={`${data.disclosureCount.toLocaleString()}건`}
            helper="누적 업로드"
            accentClass="bg-indigo-500/10 text-indigo-600"
          />
          <StatCard
            icon={<BarChart3 className="size-5" />}
            label="완료 분석"
            value={`${data.completedCount.toLocaleString()}건`}
            helper="보고서 생성 완료"
            accentClass="bg-emerald-500/10 text-emerald-600"
          />
          <StatCard
            icon={<CalendarDays className="size-5" />}
            label="이번달 분석"
            value={`${data.thisMonthCount.toLocaleString()}건`}
            helper="이번 달 생성"
            accentClass="bg-amber-500/10 text-amber-600"
          />
        </section>

        {/* Recent analyses */}
        <section className="space-y-4">
          <header className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
                최근 상권분석
              </h2>
              <p className="text-sm text-muted-foreground">최근 5건의 분석 결과를 확인하세요.</p>
            </div>
            <Link
              href="/analysis"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl")}
            >
              전체 보기
              <ArrowUpRight className="size-4" />
            </Link>
          </header>

          {data.recentAnalyses.length === 0 ? (
            <RecentAnalysesEmpty disabled={!hasBrand} />
          ) : (
            <RecentAnalysesTable rows={data.recentAnalyses} />
          )}
        </section>

        {/* Quick actions */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link
            href={hasBrand ? "/analysis/new" : "/brand"}
            className="group rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Plus className="size-5" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">새 상권분석</p>
                <p className="text-xs text-muted-foreground">
                  주소 하나로 입지·경쟁·수익성을 한 번에 분석합니다.
                </p>
              </div>
            </div>
          </Link>
          <Link
            href="/disclosure"
            aria-disabled={!hasBrand}
            className={cn(
              "group rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition hover:border-primary/40 hover:shadow-md",
              !hasBrand && "pointer-events-none opacity-60",
            )}
          >
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
                <FileText className="size-5" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">정보공개서 업로드</p>
                <p className="text-xs text-muted-foreground">
                  PDF를 올려 가맹조건·재무·매출 데이터를 자동 추출합니다.
                </p>
              </div>
            </div>
          </Link>
          <Link
            href="/dashboard/recommend"
            className="group rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <Sparkles className="size-5" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">AI 매물 추천</p>
                <p className="text-xs text-muted-foreground">
                  지역과 조건을 입력하면 최적 매물을 AI가 추천합니다.
                </p>
              </div>
            </div>
          </Link>
        </section>
      </div>
    </PageContainer>
  );
}
