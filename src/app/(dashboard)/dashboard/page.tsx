"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  FileText,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";

import type { DbReport, Recommendation } from "@/types/database";

export const dynamic = "force-dynamic";

interface ReportsApiResponse {
  reports: DbReport[];
}

interface ProspectsApiResponse {
  prospects: Array<{ id: string; name: string; status: string }>;
}

const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  "적극추천": "적극추천",
  "조건부추천": "조건부추천",
  "재검토필요": "재검토필요",
  "반려": "반려",
};

const RECOMMENDATION_COLORS: Record<Recommendation, string> = {
  "적극추천": "bg-green-100 text-green-800",
  "조건부추천": "bg-yellow-100 text-yellow-800",
  "재검토필요": "bg-orange-100 text-orange-800",
  "반려": "bg-red-100 text-red-800",
};

export default function DashboardPage() {
  const [reports, setReports] = useState<DbReport[]>([]);
  const [prospects, setProspects] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [reportsRes, prospectsRes] = await Promise.all([
          fetch("/api/reports"),
          fetch("/api/prospects"),
        ]);
        if (reportsRes.ok) {
          const data = (await reportsRes.json()) as ReportsApiResponse;
          setReports(data.reports ?? []);
        }
        if (prospectsRes.ok) {
          const data = (await prospectsRes.json()) as ProspectsApiResponse;
          setProspects(data.prospects ?? []);
        }
      } catch (err) {
        console.error("Dashboard data fetch error", err);
      } finally {
        setLoading(false);
      }
    }
    void fetchData();
  }, []);

  const completedReports = reports.filter((r) => r.status === "completed");
  const thisMonthReports = reports.filter((r) => {
    const date = new Date(r.created_at);
    const now = new Date();
    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  });
  const avgScore =
    completedReports.length > 0
      ? Math.round(
          completedReports.reduce((sum, r) => sum + (r.total_score ?? 0), 0) /
            completedReports.length
        )
      : 0;

  const recent5 = [...reports]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <Link
          href="/dashboard/reports/new"
          className="inline-flex items-center gap-2 rounded-xl bg-[#1F4E79] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a4268] transition-colors"
        >
          <Plus className="h-4 w-4" />
          새 보고서 생성
        </Link>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<FileText className="h-5 w-5" />}
          label="총 보고서 수"
          value={loading ? "..." : String(reports.length)}
          color="text-[#1F4E79]"
          bgColor="bg-blue-50"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="이번달 생성"
          value={loading ? "..." : String(thisMonthReports.length)}
          color="text-emerald-700"
          bgColor="bg-emerald-50"
        />
        <StatCard
          icon={<BarChart3 className="h-5 w-5" />}
          label="평균 종합 점수"
          value={loading ? "..." : completedReports.length > 0 ? `${avgScore}점` : "-"}
          color="text-purple-700"
          bgColor="bg-purple-50"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="예비 창업자 수"
          value={loading ? "..." : String(prospects.length)}
          color="text-amber-700"
          bgColor="bg-amber-50"
        />
      </div>

      {/* 최근 보고서 */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">최근 보고서</h2>
          <Link
            href="/dashboard/reports"
            className="text-sm text-[#1F4E79] hover:underline"
          >
            전체 보기 →
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : recent5.length === 0 ? (
          <EmptyState
            message="아직 생성된 보고서가 없습니다."
            actionLabel="첫 보고서 생성하기"
            actionHref="/dashboard/reports/new"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500">
                  <th className="pb-3 pr-4">주소</th>
                  <th className="pb-3 pr-4">추천의견</th>
                  <th className="pb-3 pr-4">종합점수</th>
                  <th className="pb-3 pr-4">생성일</th>
                  <th className="pb-3">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recent5.map((report) => (
                  <tr key={report.id} className="group hover:bg-gray-50">
                    <td className="py-3 pr-4 font-medium text-gray-900 max-w-[200px] truncate">
                      {report.address}
                    </td>
                    <td className="py-3 pr-4">
                      {report.recommendation ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            RECOMMENDATION_COLORS[report.recommendation as Recommendation] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {RECOMMENDATION_LABELS[report.recommendation as Recommendation] ?? report.recommendation}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-gray-700">
                      {report.total_score != null ? `${report.total_score}점` : "-"}
                    </td>
                    <td className="py-3 pr-4 text-gray-500">
                      {new Date(report.created_at).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/dashboard/reports/${report.id}`}
                        className="text-[#1F4E79] hover:underline text-xs"
                      >
                        상세보기
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 예비 창업자 빠른 접근 */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">예비 창업자</h2>
          <Link
            href="/dashboard/prospects"
            className="text-sm text-[#1F4E79] hover:underline"
          >
            전체 관리 →
          </Link>
        </div>

        {loading ? (
          <div className="h-10 animate-pulse rounded-lg bg-gray-100" />
        ) : prospects.length === 0 ? (
          <EmptyState
            message="등록된 예비 창업자가 없습니다."
            actionLabel="예비 창업자 추가"
            actionHref="/dashboard/prospects"
          />
        ) : (
          <p className="text-sm text-gray-600">
            총 <span className="font-semibold text-gray-900">{prospects.length}명</span>의 예비 창업자가 등록되어 있습니다.
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  bgColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${bgColor} ${color} mb-3`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function EmptyState({
  message,
  actionLabel,
  actionHref,
}: {
  message: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <p className="text-sm text-gray-500 mb-3">{message}</p>
      <Link
        href={actionHref}
        className="inline-flex items-center gap-1.5 rounded-xl bg-[#1F4E79] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a4268] transition-colors"
      >
        <Plus className="h-4 w-4" />
        {actionLabel}
      </Link>
    </div>
  );
}
