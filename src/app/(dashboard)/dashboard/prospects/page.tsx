"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { formatPhoneNumber, toDigits } from "@/lib/auth/phone";
import type { DbProspect, ProspectStatus, AgeGroup } from "@/types/database";

export const dynamic = "force-dynamic";

// ────────── types & constants ──────────

interface ProspectsResponse {
  prospects: DbProspect[];
}
interface DeleteResponse {
  success?: boolean;
  error?: string;
}
interface CreateResponse {
  prospect?: DbProspect;
  error?: string;
}

const STATUS_LABELS: Record<ProspectStatus, string> = {
  inquiry: "문의",
  consulting: "상담중",
  report_requested: "보고서요청",
  contracted: "계약완료",
  rejected: "반려",
};
const STATUS_COLORS: Record<ProspectStatus, string> = {
  inquiry: "bg-gray-100 text-gray-700",
  consulting: "bg-blue-100 text-blue-700",
  report_requested: "bg-amber-100 text-amber-700",
  contracted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};
const AGE_GROUPS: AgeGroup[] = ["20대", "30대", "40대", "50대", "60대+"];
const FILTER_TABS: Array<{ label: string; value: "" | ProspectStatus }> = [
  { label: "전체", value: "" },
  { label: "문의", value: "inquiry" },
  { label: "상담중", value: "consulting" },
  { label: "보고서요청", value: "report_requested" },
  { label: "계약완료", value: "contracted" },
  { label: "반려", value: "rejected" },
];

// ────────── add form schema ──────────
const addSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요."),
  phone: z.string().optional(),
  email: z.string().email("이메일 형식이 올바르지 않습니다.").optional().or(z.literal("")),
  age_group: z.enum(["20대", "30대", "40대", "50대", "60대+"]).optional(),
  investment_budget_str: z.string().optional(),
  status: z.enum(["inquiry", "consulting", "report_requested", "contracted", "rejected"]),
  memo: z.string().optional(),
});
type AddForm = z.infer<typeof addSchema>;

// ────────── component ──────────

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<DbProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"" | ProspectStatus>("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("created_at_desc");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      if (sort) params.set("sort", sort);
      const res = await fetch(`/api/prospects?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as ProspectsResponse;
        setProspects(data.prospects ?? []);
      }
    } catch (err) {
      console.error("fetchProspects error", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, sort]);

  useEffect(() => { void fetchProspects(); }, [fetchProspects]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/prospects/${id}`, { method: "DELETE" });
      const data = (await res.json()) as DeleteResponse;
      if (!res.ok) { toast.error(data.error ?? "삭제 실패"); return; }
      toast.success("삭제되었습니다.");
      setDeleteTarget(null);
      void fetchProspects();
    } catch (err) {
      console.error("delete error", err);
      toast.error("네트워크 오류가 발생했습니다.");
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">예비 창업자 관리</h1>
        <button
          onClick={() => setSheetOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1F4E79] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a4268] transition-colors"
        >
          <Plus className="h-4 w-4" />
          추가
        </button>
      </div>

      {/* 필터 탭 */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === tab.value
                ? "bg-[#1F4E79] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 검색 + 정렬 */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="이름, 연락처 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
        >
          <option value="created_at_desc">최신순</option>
          <option value="name_asc">이름순</option>
        </select>
      </div>

      {/* 테이블 */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : prospects.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-sm text-gray-500 mb-3">등록된 예비 창업자가 없습니다.</p>
            <button
              onClick={() => setSheetOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1F4E79] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a4268]"
            >
              <Plus className="h-4 w-4" />
              첫 번째 창업자 추가
            </button>
          </div>
        ) : (
          <>
            {/* 데스크톱 테이블 */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 bg-gray-50">
                    <th className="px-5 py-3">이름</th>
                    <th className="px-5 py-3">연락처</th>
                    <th className="px-5 py-3">희망지역</th>
                    <th className="px-5 py-3">상태</th>
                    <th className="px-5 py-3">상담일자</th>
                    <th className="px-5 py-3">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {prospects.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 group">
                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        <Link href={`/dashboard/prospects/${p.id}`} className="hover:text-[#1F4E79] hover:underline">
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">{p.phone ?? "-"}</td>
                      <td className="px-5 py-3.5 text-gray-600 max-w-[120px] truncate">{p.preferred_region ?? "-"}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status]}`}>
                          {STATUS_LABELS[p.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">
                        {p.consultation_date ? new Date(p.consultation_date).toLocaleDateString("ko-KR") : "-"}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/dashboard/prospects/${p.id}`}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-[#1F4E79] hover:bg-blue-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            onClick={() => setDeleteTarget(p.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* 모바일 카드 */}
            <div className="md:hidden divide-y divide-gray-100">
              {prospects.map((p) => (
                <div key={p.id} className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <Link href={`/dashboard/prospects/${p.id}`} className="font-medium text-gray-900 hover:text-[#1F4E79]">
                      {p.name}
                    </Link>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status]}`}>
                      {STATUS_LABELS[p.status]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{p.phone ?? "-"} · {p.preferred_region ?? "-"}</p>
                  <div className="flex gap-2 mt-2">
                    <Link href={`/dashboard/prospects/${p.id}`} className="text-xs text-[#1F4E79] hover:underline">수정</Link>
                    <button onClick={() => setDeleteTarget(p.id)} className="text-xs text-red-500 hover:underline">삭제</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 삭제 확인 Dialog */}
      {deleteTarget && (
        <DeleteDialog
          onConfirm={() => void handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* 추가 Sheet */}
      {sheetOpen && (
        <AddSheet
          onClose={() => setSheetOpen(false)}
          onSaved={() => { setSheetOpen(false); void fetchProspects(); }}
        />
      )}
    </div>
  );
}

// ── DeleteDialog ──────────────────────────────────────────────
function DeleteDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-base font-semibold text-gray-900 mb-2">삭제 확인</h3>
        <p className="text-sm text-gray-600 mb-5">
          정말 삭제하시겠습니까? 연결된 보고서도 함께 삭제됩니다.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            취소
          </button>
          <button onClick={onConfirm} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600">
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AddSheet ──────────────────────────────────────────────────
function AddSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<AddForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(addSchema) as any,
    defaultValues: { status: "inquiry" as const },
  });

  const phoneValue = watch("phone") ?? "";

  const onSubmit = async (values: AddForm) => {
    try {
      const digits = toDigits(values.investment_budget_str ?? "");
      const budget = digits ? parseInt(digits, 10) : null;
      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          phone: values.phone || null,
          email: values.email || null,
          age_group: values.age_group ?? null,
          investment_budget: budget,
          status: values.status,
          memo: values.memo || null,
        }),
      });
      const data = (await res.json()) as CreateResponse;
      if (!res.ok) { toast.error(data.error ?? "저장 실패"); return; }
      toast.success("예비 창업자가 추가되었습니다.");
      onSaved();
    } catch (err) {
      console.error("add prospect error", err);
      toast.error("네트워크 오류가 발생했습니다.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md h-full shadow-xl flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">예비 창업자 추가</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 p-5 space-y-4">
          <Field label="이름" required error={errors.name?.message}>
            <input {...register("name")} placeholder="홍길동" className={inputCls} />
          </Field>

          <Field label="연락처">
            <input
              value={formatPhoneNumber(phoneValue)}
              onChange={(e) => setValue("phone", formatPhoneNumber(toDigits(e.target.value)))}
              placeholder="010-0000-0000"
              inputMode="numeric"
              className={inputCls}
            />
          </Field>

          <Field label="이메일">
            <input {...register("email")} type="email" placeholder="hong@example.com" className={inputCls} />
          </Field>

          <Field label="연령대">
            <select {...register("age_group")} className={inputCls}>
              <option value="">선택</option>
              {AGE_GROUPS.map((ag) => <option key={ag} value={ag}>{ag}</option>)}
            </select>
          </Field>

          <Field label="투자 예산 (원)">
            <input
              value={watch("investment_budget_str") ?? ""}
              onChange={(e) => setValue("investment_budget_str", toDigits(e.target.value).replace(/\B(?=(\d{3})+(?!\d))/g, ","))}
              placeholder="50,000,000"
              inputMode="numeric"
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

          <Field label="메모">
            <textarea {...register("memo")} rows={3} placeholder="내부 메모" className={`${inputCls} resize-none`} />
          </Field>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              취소
            </button>
            <button type="submit" disabled={isSubmitting} className="flex-1 rounded-xl bg-[#1F4E79] py-2.5 text-sm font-medium text-white hover:bg-[#1a4268] disabled:bg-gray-300">
              {isSubmitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────
const inputCls = "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] bg-white";

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
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
