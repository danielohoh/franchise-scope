"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { DbChatMessage, ExtractedProspectData } from "@/types/database";

type SessionDetailResponse = {
  session: {
    id: string;
    prospect_id: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    started_at: string;
    status: string;
    callback_requested: boolean;
    extracted_data: ExtractedProspectData | null;
  };
  messages: DbChatMessage[];
  error?: string;
};

export default function ConsultationDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [data, setData] = useState<SessionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (!id) return;

    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/consultations/sessions/${id}`);
        const json = (await res.json()) as SessionDetailResponse;
        if (!res.ok) throw new Error(json.error ?? "상세 조회 실패");
        setData(json);
      } catch (error) {
        console.error("[consultations/[id]] load failed", error);
        toast.error(error instanceof Error ? error.message : "상담 세션 상세를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const registerProspect = async () => {
    if (!data?.session) return;

    try {
      setRegistering(true);
      const extracted = data.session.extracted_data ?? {};
      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.session.contact_name ?? extracted.name ?? "상담 고객",
          phone: data.session.contact_phone ?? extracted.phone ?? null,
          preferred_region: extracted.preferred_region ?? null,
          investment_budget: extracted.investment_budget ?? null,
          experience: extracted.experience ?? null,
          consultation_date: new Date(data.session.started_at).toISOString().slice(0, 10),
          status: "consulting",
          memo: "AI 가맹 상담 세션에서 자동 등록",
        }),
      });

      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "예비 창업자 등록 실패");
      toast.success("예비 창업자로 등록했습니다.");
    } catch (error) {
      console.error("[consultations/[id]] registerProspect failed", error);
      toast.error(error instanceof Error ? error.message : "예비 창업자 등록에 실패했습니다.");
    } finally {
      setRegistering(false);
    }
  };

  if (loading || !data) {
    return <div className="h-24 animate-pulse rounded-xl bg-gray-100" />;
  }

  const extracted = data.session.extracted_data ?? {};

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">점주 정보</h1>
        <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-600 sm:grid-cols-2">
          <p>이름: {data.session.contact_name ?? "-"}</p>
          <p>전화: {data.session.contact_phone ?? "-"}</p>
          <p>시작시간: {new Date(data.session.started_at).toLocaleString("ko-KR")}</p>
          <p>상태: {data.session.status}</p>
          <p>콜백 요청: {data.session.callback_requested ? "요청" : "-"}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">AI 추출 정보</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-600 sm:grid-cols-2">
          <p>희망지역: {extracted.preferred_region ?? "-"}</p>
          <p>예산: {extracted.investment_budget?.toLocaleString("ko-KR") ?? "-"}</p>
          <p>준비도: {extracted.readiness_level ?? "-"}</p>
          <p>경험: {extracted.experience ?? "-"}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">채팅 히스토리</h2>
        <div className="mt-4 space-y-3">
          {data.messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}>
                {msg.content}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="button" onClick={() => void registerProspect()} disabled={registering}>
          {registering ? "등록 중..." : "예비 창업자로 등록"}
        </Button>
      </div>
    </div>
  );
}
