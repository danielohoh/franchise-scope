"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

type LinkItem = {
  id: string;
  label: string | null;
  token: string;
  status: "active" | "expired" | "closed";
  expires_at: string | null;
  session_count: number;
};

type SessionItem = {
  id: string;
  contact_name: string | null;
  contact_phone: string | null;
  status: string;
  last_active_at: string;
  callback_requested: boolean;
};

export default function ConsultationsPage() {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [linkRes, sessionRes] = await Promise.all([
        fetch("/api/consultations/links"),
        fetch("/api/consultations/sessions"),
      ]);

      const linkJson = (await linkRes.json()) as { links?: LinkItem[]; error?: string };
      const sessionJson = (await sessionRes.json()) as { sessions?: SessionItem[]; error?: string };

      if (!linkRes.ok) throw new Error(linkJson.error ?? "상담 링크 목록 조회 실패");
      if (!sessionRes.ok) throw new Error(sessionJson.error ?? "상담 세션 목록 조회 실패");

      setLinks(linkJson.links ?? []);
      setSessions(sessionJson.sessions ?? []);
    } catch (error) {
      console.error("[consultations/page] fetchAll failed", error);
      toast.error(error instanceof Error ? error.message : "상담 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
  }, []);

  const createLink = async () => {
    try {
      const res = await fetch("/api/consultations/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() || undefined }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "상담 링크 생성 실패");
      toast.success("상담 링크가 생성되었습니다.");
      setLabel("");
      await fetchAll();
    } catch (error) {
      console.error("[consultations/page] createLink failed", error);
      toast.error(error instanceof Error ? error.message : "상담 링크 생성에 실패했습니다.");
    }
  };

  const closeLink = async (id: string) => {
    try {
      const res = await fetch(`/api/consultations/links/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "상담 링크 종료 실패");
      toast.success("상담 링크가 종료되었습니다.");
      await fetchAll();
    } catch (error) {
      console.error("[consultations/page] closeLink failed", error);
      toast.error(error instanceof Error ? error.message : "상담 링크 종료에 실패했습니다.");
    }
  };

  const baseUrl = useMemo(() => appUrl || window.location.origin, []);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">상담 링크 관리</h1>
        </div>

        <div className="mb-4 flex gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="링크 라벨 (예: 4월 박람회)"
            className="h-11 flex-1 rounded-xl border border-gray-200 px-3 text-sm"
          />
          <Button type="button" onClick={() => void createLink()}>새 링크 생성</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="py-2">라벨</th><th className="py-2">링크 URL</th><th className="py-2">상태</th><th className="py-2">세션 수</th><th className="py-2">만료일</th><th className="py-2">삭제</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {links.map((link) => {
                const url = `${baseUrl}/consult/${link.token}`;
                return (
                  <tr key={link.id}>
                    <td className="py-3">{link.label ?? "-"}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="max-w-[260px] truncate text-gray-600">{url}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(url);
                            toast.success("링크를 복사했습니다.");
                          }}
                          className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
                        >
                          <Copy className="size-4" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3">{link.status}</td>
                    <td className="py-3">{link.session_count}</td>
                    <td className="py-3">{link.expires_at ? new Date(link.expires_at).toLocaleDateString("ko-KR") : "-"}</td>
                    <td className="py-3">
                      <Button type="button" variant="outline" onClick={() => void closeLink(link.id)}>종료</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && links.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">생성된 상담 링크가 없습니다.</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">최근 상담 세션 목록</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="py-2">이름/전화번호</th><th className="py-2">상태</th><th className="py-2">마지막 활동</th><th className="py-2">콜백 요청</th><th className="py-2">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td className="py-3">{session.contact_name ?? "이름 미입력"} / {session.contact_phone ?? "전화 미입력"}</td>
                  <td className="py-3">{session.status}</td>
                  <td className="py-3">{new Date(session.last_active_at).toLocaleString("ko-KR")}</td>
                  <td className="py-3">{session.callback_requested ? "요청" : "-"}</td>
                  <td className="py-3"><Link href={`/dashboard/consultations/${session.id}`} className="text-[#1F4E79] hover:underline">상세보기</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && sessions.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">상담 세션이 없습니다.</p> : null}
        </div>
      </section>
    </div>
  );
}
