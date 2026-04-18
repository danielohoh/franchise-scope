"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Plus, Download } from "lucide-react";

import { formatPhoneNumber, toDigits } from "@/lib/auth/phone";
import type { DbProspect, DbReport, AgeGroup, Recommendation } from "@/types/database";

export const dynamic = "force-dynamic";

// ──── Types ────────────────────────────────────────────────
interface ProspectResponse { prospect: DbProspect }
interface ReportsResponse { reports: DbReport[] }
interface SaveResponse { prospect?: DbProspect; error?: string }

const STATUS_LABELS = {
  inquiry: "문의", consulting: "상담중",
  report_requested: "보고서요청", contracted: "계약완료", rejected: "반려",
} as const;

const REC_COLORS: Record<Recommendation, string> = {
  "적극추천": "bg-green-100 text-green-800",
  "조건부추천": "bg-yellow-100 text-yellow-800",
  "재검토필요": "bg-orange-100 text-orange-800",
  "반려": "bg-red-100 text-red-800",
};

// ──── Schema ──────────────────────────────────────────────
const editSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요."),
  phone: z.string().optional(),
  email: z.string().email("이메일 형식이 올바르지 않습니다.").optional().or(z.literal("")),
  age_group: z.enum(["20대", "30대", "40대", "50대", "60대+"]).optional().nullable(),
  investment_budget_str: z.string().optional(),
  experience: z.string().optional(),
  preferred_region: z.string().optional(),
  consultation_date: z.string().optional(),
  status: z.enum(["inquiry", "consulting", "report_requested", "contracted", "rejected"]),
  memo: z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

// ──── Component ───────────────────────────────────────────
export default function ProspectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : params.id?.[0] ?? "";

  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<DbReport[]>([]);
  const [name, setName] = useState("");

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: { status: "inquiry" },
  });

  const phoneValue = watch("phone") ?? "";
  const budgetStr = watch("investment_budget_str") ?? "";

  useEffect(() => {
    if (!id) return;
    async function load() {
      setLoading(true);
      try {
        const [pRes, rRes] = await Promise.all([
          fetch(`/api/prospects/${id}`),
          fetch(`/api/reports?prospect_id=${id}`),
        ]);
        if (pRes.ok) {
          const pd = (await pRes.json()) as ProspectResponse;
          const p = pd.prospect;
          setName(p.name);
          reset({
            name: p.name,
            phone: p.phone ?? "",
            email: p.email ?? "",
            age_group: (p.age_group as AgeGroup | null) ?? undefined,
            investment_budget_str: p.investment_budget != null
              ? p.investment_budget.toLocaleString("ko-KR")
              : "",
            experience: p.experience ?? "",
            preferred_region: p.preferred_region ?? "",
            consultation_date: p.consultation_date ?? "",
            status: p.status,
            memo: p.memo ?? "",
          });
        }
        if (rRes.ok) {
          const rd = (await rRes.json()) as ReportsResponse;
          setReports(rd.reports ?? []);
        }
      } catch (err) {
        console.error("load prospect detail error", err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id, reset]);

  const onSubmit = async (values: EditForm) => {
    try {
      const digits = toDigits(values.investment_budget_str ?? "");
      const budget = digits ? parseInt(digits, 10) : null;
      const res = await fetch(`/api/prospects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          phone: values.phone || null,
          email: values.email || null,
          age_group: values.age_group ?? null,
          investment_budget: budget,
          experience: values.experience || null,
          preferred_region: values.preferred_region || null,
          consultation_date: values.consultation_date || null,
          status: values.status,
          memo: values.memo || null,
        }),
      });
      const data = (await res.json()) as SaveResponse;
      if (!res.ok) { toast.error(data.error ?? "저장 실패"); return; }
      setName(values.name);
      toast.success("저장되었습니다.");
    } catch (err) {
      console.error("save prospect error", err);
      toast.error("네트워크 오류가 발생했습니다.");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        {[1,2,3,4].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />)}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* 헤더 */}
      <div>
        <Link href="/dashboard/prospects" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1F4E79] mb-3">
          <ArrowLeft className="h-4 w-4" />
          예비 창업자 목록
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
      </div>

      {/* 수정 폼 */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-5">기본 정보</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="이름" required error={errors.name?.message}>
              <input {...register("name")} className={inputCls} />
            </Field>
            <Field label="연락처">
              <input
                value={formatPhoneNumber(phoneValue)}
                onChange={(e) => setValue("phone", formatPhoneNumber(toDigits(e.target.value)))}
                inputMode="numeric"
                placeholder="010-0000-0000"
                className={inputCls}
              />
            </Field>
            <Field label="이메일" error={errors.email?.message}>
              <input {...register("email")} type="email" placeholder="hong@example.com" className={inputCls} />
            </Field>
            <Field label="연령대">
              <select {...register("age_group")} className={inputCls}>
                <option value="">선택</option>
                {(["20대","30대","40대","50대","60대+"] as AgeGroup[]).map(ag => (
                  <option key={ag} value={ag}>{ag}</option>
                ))}
              </select>
            </Field>
            <Field label="투자 예산 (원)">
              <input
                value={budgetStr}
                onChange={(e) => {
                  const raw = toDigits(e.target.value);
                  setValue("investment_budget_str", raw ? parseInt(raw, 10).toLocaleString("ko-KR") : "");
                }}
                inputMode="numeric"
                placeholder="50,000,000"
                className={inputCls}
              />
            </Field>
            <Field label="상태">
              <select {...register("status")} className={inputCls}>
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="희망 지역">
              <input {...register("preferred_region")} placeholder="서울 강남구" className={inputCls} />
            </Field>
            <Field label="상담 일자">
              <input {...register("consultation_date")} type="date" className={inputCls} />
            </Field>
          </div>

          <Field label="창업/업종 경험">
            <textarea {...register("experience")} rows={2} placeholder="이전 창업 경험, 관련 업종 경험 등" className={`${inputCls} resize-none`} />
          </Field>
          <Field label="내부 메모">
            <textarea {...register("memo")} rows={3} placeholder="담당자 메모 (고객에게 보이지 않음)" className={`${inputCls} resize-none`} />
          </Field>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-[#1F4E79] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#1a4268] disabled:bg-gray-300"
            >
              {isSubmitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </section>

      {/* 관련 보고서 */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">관련 보고서</h2>
          <Link
            href={`/dashboard/reports/new?prospect_id=${id}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1F4E79] px-3 py-2 text-xs font-medium text-white hover:bg-[#1a4268]"
          >
            <Plus className="h-3.5 w-3.5" />
            새 보고서 생성
          </Link>
        </div>

        {reports.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">관련 보고서가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500">
                  <th className="pb-2 pr-4">주소</th>
                  <th className="pb-2 pr-4">추천의견</th>
                  <th className="pb-2 pr-4">점수</th>
                  <th className="pb-2 pr-4">생성일</th>
                  <th className="pb-2">다운로드</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="py-2.5 pr-4 max-w-[180px] truncate">
                      <Link href={`/dashboard/reports/${r.id}`} className="text-[#1F4E79] hover:underline">
                        {r.address}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4">
                      {r.recommendation ? (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${REC_COLORS[r.recommendation]}`}>
                          {r.recommendation}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-700">
                      {r.total_score != null ? `${r.total_score}점` : "-"}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-500">
                      {new Date(r.created_at).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="py-2.5">
                      {r.file_url ? (
                        <a
                          href={`/api/reports/${r.id}/download`}
                          className="inline-flex items-center gap-1 text-xs text-[#1F4E79] hover:underline"
                        >
                          <Download className="h-3.5 w-3.5" />
                          docx
                        </a>
                      ) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ──── Helpers ─────────────────────────────────────────────
const inputCls = "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] bg-white";

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
