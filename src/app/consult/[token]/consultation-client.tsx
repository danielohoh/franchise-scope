"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChevronLeft, ChevronRight, Globe, LoaderCircle, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { DbChatMessage } from "@/types/database";

// ── 타입 ──────────────────────────────────────────────────

type Props = { token: string; brandName: string };

type StartResponse = {
  session_id: string; brand_name: string; brand_id: string;
  messages: DbChatMessage[]; error?: string;
};

type StoredSession = { session_id: string; name: string; phone: string };

type ClarifyQuestion = { text: string; choices: string[] };
type QuestionAnswers = Record<number, string>;

// ── 리포트 타입 (서버 reportSchema 와 동기화) ──────────────

type KpiItem = {
  label: string; value: string;
  note?: string; color?: "default" | "green" | "blue" | "red";
};

type ChartDataItem = Record<string, unknown> & { name?: string; value?: number; highlight?: boolean; color?: string };

type AnyChart = {
  type: string; title: string; subtitle?: string;
  data: ChartDataItem[];
};

type ReportSection = {
  title: string; content: string;
  citations?: Array<{ label: string; url?: string }>;
};

type ReportData = {
  intro?: string;
  kpis: KpiItem[];
  charts: AnyChart[];
  sections: ReportSection[];
};

// ── SSE 이벤트 타입 ──────────────────────────────────────

type SearchStartEvent = { message: string; queries: string[] };
type SearchResultEvent = { query: string; count: number };
type ReportEvent = ReportData;
type TextDeltaEvent = { delta: string };
type ClarifyEvent = { questions: ClarifyQuestion[] };

// ── 유틸 ──────────────────────────────────────────────────

function buildAnswerMessage(questions: ClarifyQuestion[], answers: QuestionAnswers): string {
  const lines = questions.map((q, i) => `- ${q.text}: ${answers[i] ?? "건너뜀"}`);
  return `[답변]\n${lines.join("\n")}`;
}

// ── 차트 색상 ─────────────────────────────────────────────

const DONUT_COLORS = ["#3b82f6", "#22c55e", "#60a5fa", "#ef4444", "#f59e0b", "#8b5cf6"];

// ── 서브 컴포넌트: 리포트 렌더러 ──────────────────────────

function KpiCards({ kpis }: { kpis: KpiItem[] }) {
  const colorMap: Record<string, string> = {
    green: "text-green-600",
    blue: "text-blue-600",
    red: "text-red-600",
    default: "text-gray-900",
  };
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {kpis.map((kpi, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <p className="text-xs text-gray-500 leading-tight mb-1">{kpi.label}</p>
          <p className={`text-base font-bold leading-tight ${colorMap[kpi.color ?? "default"] ?? "text-gray-900"}`}>
            {kpi.value}
          </p>
          {kpi.note ? <p className="text-[10px] text-gray-400 mt-0.5">{kpi.note}</p> : null}
        </div>
      ))}
    </div>
  );
}

function DonutChartBlock({ chart }: { chart: AnyChart }) {
  const data = chart.data
    .map((d) => ({ name: String(d.name ?? ""), value: Number(d.value ?? 0) }))
    .filter((d) => d.value > 0);
  if (data.length === 0) return null;
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-gray-700 mb-3">{chart.title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
            {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
          </Pie>
          <Legend
            formatter={(value: string) => {
              const item = data.find((d) => d.name === value);
              const pct = total > 0 ? Math.round(((item?.value ?? 0) / total) * 100) : 0;
              return (
                <span className="text-xs text-gray-700">
                  {value} {item?.value ? `${item.value.toLocaleString()}만` : ""} ({pct}%)
                </span>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function BarChartBlock({ chart }: { chart: AnyChart }) {
  const data = chart.data
    .map((d) => ({
      name: String(d.name ?? ""),
      value: Number(d.value ?? 0),
      fill: d.highlight ? "#22c55e" : typeof d.color === "string" ? d.color : "#94a3b8",
    }))
    .filter((d) => d.name);
  if (data.length === 0) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-gray-700 mb-0.5">{chart.title}</p>
      {chart.subtitle ? <p className="text-[10px] text-gray-400 mb-3">{chart.subtitle}</p> : null}
      <ResponsiveContainer width="100%" height={data.length * 36 + 16}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
          <XAxis type="number" tickFormatter={(v) => `${String(v)}%`} tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={56} />
          <Tooltip />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CitationChip({ label, url }: { label: string; url?: string }) {
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 hover:bg-blue-100 transition-colors"
      >
        <Globe className="size-2.5" />{label}
      </a>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">
      <Globe className="size-2.5" />{label}
    </span>
  );
}

function ReportRenderer({ data }: { data: ReportData }) {
  return (
    <div className="space-y-4 py-2">
      {/* 인트로 */}
      {data.intro ? <p className="text-sm text-gray-700 font-medium">{data.intro}</p> : null}

      {/* KPI 카드 */}
      {data.kpis.length > 0 ? <KpiCards kpis={data.kpis} /> : null}

      {/* 차트 */}
      {data.charts.map((chart, i) =>
        chart.type === "donut" ? (
          <DonutChartBlock key={i} chart={chart} />
        ) : chart.type === "bar" ? (
          <BarChartBlock key={i} chart={chart} />
        ) : null,
      )}

      {/* 텍스트 섹션 */}
      {data.sections.map((section, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-2">
          <h3 className="text-sm font-bold text-gray-900">{section.title}</h3>
          <p className="text-sm text-gray-700 leading-relaxed">{section.content}</p>
          {section.citations && section.citations.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {section.citations.map((c, ci) => (
                <CitationChip key={ci} label={c.label} url={c.url} />
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ── 서브 컴포넌트: 검색 진행 상태 ──────────────────────────

function SearchProgress({ message, done }: { message: string; done: boolean }) {
  return (
    <div className="flex items-start gap-2.5 py-1">
      <div className="mt-0.5 shrink-0">
        {done ? (
          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
            <Globe className="size-3 text-blue-600" />
          </div>
        ) : (
          <LoaderCircle className="size-5 animate-spin text-blue-500" />
        )}
      </div>
      <p className="text-sm text-gray-700">{message}</p>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────

export default function ConsultationClient({ token, brandName }: Props) {
  const [phase, setPhase] = useState<"loading" | "verify" | "chat">("loading");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sessionId, setSessionId] = useState("");

  // 채팅
  const [messages, setMessages] = useState<Array<
    | { type: "text"; id: string; role: "user" | "assistant"; content: string }
    | { type: "report"; id: string; data: ReportData }
    | { type: "search_progress"; id: string; message: string; done: boolean }
  >>([]);
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // 질문 카드
  const [activeQuestions, setActiveQuestions] = useState<ClarifyQuestion[] | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionAnswers, setQuestionAnswers] = useState<QuestionAnswers>({});
  const [customInput, setCustomInput] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  // 콜백
  const [callbackOpen, setCallbackOpen] = useState(false);
  const [preferredTime, setPreferredTime] = useState("");
  const [isCallbackLoading, setIsCallbackLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const sessionStorageKey = useMemo(() => `fs_session_${token}`, [token]);

  // ── 세션 복원 ──────────────────────────────────────────

  useEffect(() => {
    const stored = localStorage.getItem(sessionStorageKey);
    if (!stored) { setPhase("verify"); return; }
    let parsed: StoredSession | null = null;
    try { parsed = JSON.parse(stored) as StoredSession; } catch {
      localStorage.removeItem(sessionStorageKey); setPhase("verify"); return;
    }
    void (async () => {
      try {
        const res = await fetch("/api/consult/start", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, name: parsed!.name, phone: parsed!.phone }),
        });
        const json = (await res.json()) as StartResponse;
        if (!res.ok) throw new Error(json.error);
        setName(parsed!.name); setPhone(parsed!.phone);
        setSessionId(json.session_id);
        // 기존 메시지 복원
        const restored = (json.messages ?? []).flatMap((m): typeof messages => {
          // [REPORT_JSON] 블록 → 리포트 카드
          if (m.role === "assistant" && m.content.startsWith("[REPORT_JSON]")) {
            const jsonStr = m.content.slice("[REPORT_JSON]".length, -"[/REPORT_JSON]".length);
            try {
              return [{ type: "report", id: m.id, data: JSON.parse(jsonStr) as ReportData }];
            } catch { return []; }
          }
          // [답변] 태그 사용자 메시지는 숨김
          if (m.role === "user" && m.content.startsWith("[답변]")) return [];
          // [CLARIFY] 블록 제거 후 표시
          const cleanContent = m.content
            .replace(/\[CLARIFY\][\s\S]*?\[\/CLARIFY\]/g, "")
            .trim();
          if (!cleanContent) return [];
          return [{ type: "text", id: m.id, role: m.role, content: cleanContent }];
        });
        setMessages(restored);
        setPhase("chat");
      } catch {
        localStorage.removeItem(sessionStorageKey); setPhase("verify");
      }
    })();
  }, [token, sessionStorageKey]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamingText, activeQuestions]);

  // ── 세션 시작 ──────────────────────────────────────────

  const handleStart = async () => {
    if (!name.trim() || !phone.trim()) { toast.error("이름과 휴대폰 번호를 입력해 주세요."); return; }
    try {
      setIsStarting(true);
      const res = await fetch("/api/consult/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: name.trim(), phone: phone.trim() }),
      });
      const json = (await res.json()) as StartResponse;
      if (!res.ok) throw new Error(json.error);
      localStorage.setItem(sessionStorageKey, JSON.stringify({ session_id: json.session_id, name: name.trim(), phone: phone.trim() }));
      setSessionId(json.session_id); setMessages([]); setPhase("chat");
    } catch (e) { toast.error(e instanceof Error ? e.message : "상담 시작 실패"); }
    finally { setIsStarting(false); }
  };

  // ── 메시지 전송 (커스텀 SSE 파싱) ─────────────────────

  const sendMessage = async (text: string) => {
    if (!sessionId || !text.trim() || isSending) return;
    const outgoing = text.trim();
    setInput(""); setIsSending(true); setStreamingText("");

    const isAnswerMsg = outgoing.startsWith("[답변]");
    if (!isAnswerMsg) {
      setMessages((prev) => [...prev, { type: "text", id: crypto.randomUUID(), role: "user", content: outgoing }]);
    }

    // 검색 진행 메시지 ID (나중에 "완료"로 업데이트)
    let searchProgressId: string | null = null;

    try {
      const res = await fetch("/api/consult/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: outgoing }),
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "서버 오류");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";
      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
        }

        // SSE 파싱 — done=true이면 buffer 전체를 flush
        const lines = buffer.split("\n");
        buffer = done ? "" : (lines.pop() ?? "");

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const rawData = line.slice(6);
            try {
              const data = JSON.parse(rawData) as unknown;

              if (currentEvent === "search_start") {
                const ev = data as SearchStartEvent;
                if (ev.message) {
                  if (searchProgressId) {
                    // 기존 progress를 업데이트
                    setMessages((prev) => prev.map((m) =>
                      m.id === searchProgressId ? { ...m, message: ev.message } : m,
                    ));
                  } else {
                    searchProgressId = crypto.randomUUID();
                    setMessages((prev) => [...prev, {
                      type: "search_progress", id: searchProgressId!, message: ev.message, done: false,
                    }]);
                  }
                }
              } else if (currentEvent === "search_result") {
                // 검색 완료 표시
                if (searchProgressId) {
                  setMessages((prev) => prev.map((m) =>
                    m.id === searchProgressId ? { ...m, done: true } : m,
                  ));
                }
              } else if (currentEvent === "report") {
                const reportData = data as ReportData;
                // 검색 진행 메시지 제거
                if (searchProgressId) {
                  setMessages((prev) => prev.filter((m) => m.id !== searchProgressId));
                  searchProgressId = null;
                }
                setMessages((prev) => [...prev, { type: "report", id: crypto.randomUUID(), data: reportData }]);
              } else if (currentEvent === "text_delta") {
                const ev = data as TextDeltaEvent;
                accumulatedText += ev.delta;
                setStreamingText(accumulatedText);
              } else if (currentEvent === "clarify") {
                const ev = data as ClarifyEvent;
                if (ev.questions && ev.questions.length > 0) {
                  setActiveQuestions(ev.questions);
                  setQuestionIndex(0); setQuestionAnswers({}); setCustomInput(""); setShowCustom(false);
                }
              } else if (currentEvent === "done") {
                // 스트리밍 텍스트 → 메시지로 확정
                if (accumulatedText.trim()) {
                  setMessages((prev) => [...prev, {
                    type: "text", id: crypto.randomUUID(), role: "assistant",
                    content: accumulatedText.trim(),
                  }]);
                }
                // 검색 진행 메시지 정리
                if (searchProgressId) {
                  setMessages((prev) => prev.filter((m) => m.id !== searchProgressId));
                }
                accumulatedText = "";
                setStreamingText("");
              }
            } catch { /* JSON 파싱 실패 무시 */ }
          }
        }
        if (done) break;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "답변 생성 실패");
    } finally {
      setIsSending(false);
    }
  };

  // ── 질문 카드 ─────────────────────────────────────────

  const handleChoiceSelect = (choice: string) => {
    if (!activeQuestions) return;
    const next = { ...questionAnswers, [questionIndex]: choice };
    setQuestionAnswers(next); setShowCustom(false); setCustomInput("");
    if (questionIndex < activeQuestions.length - 1) {
      setQuestionIndex(questionIndex + 1);
    } else {
      setActiveQuestions(null);
      void sendMessage(buildAnswerMessage(activeQuestions, next));
    }
  };

  const handleSkip = () => {
    if (!activeQuestions) return;
    const next = { ...questionAnswers };
    if (questionIndex < activeQuestions.length - 1) {
      setQuestionIndex(questionIndex + 1); setQuestionAnswers(next); setShowCustom(false); setCustomInput("");
    } else {
      setActiveQuestions(null);
      void sendMessage(buildAnswerMessage(activeQuestions, next));
    }
  };

  const handleCustomSubmit = () => { if (customInput.trim()) handleChoiceSelect(customInput.trim()); };

  // ── 콜백 ──────────────────────────────────────────────

  const requestCallback = async () => {
    if (!preferredTime.trim()) { toast.error("선호 시간을 입력해 주세요."); return; }
    try {
      setIsCallbackLoading(true);
      const res = await fetch("/api/consult/callback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, preferred_time: preferredTime.trim() }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error);
      toast.success("담당자 연결 요청이 접수되었습니다."); setPreferredTime(""); setCallbackOpen(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "콜백 요청 실패"); }
    finally { setIsCallbackLoading(false); }
  };

  const currentQuestion = activeQuestions?.[questionIndex];

  // ── 렌더 ─────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50">
      {/* 헤더 */}
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-xs font-medium text-blue-600">{brandName}</p>
        <h1 className="text-base font-semibold text-gray-900">AI 가맹 상담</h1>
      </header>

      {/* 채팅 영역 */}
      <div className="flex-1 overflow-y-auto px-3 py-4">

        {phase === "loading" && (
          <div className="flex items-center justify-center h-full">
            <LoaderCircle className="size-6 animate-spin text-gray-400" />
          </div>
        )}

        {phase === "verify" && (
          <div className="flex items-center justify-center h-full">
            <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
              <p className="text-sm font-medium text-gray-700">상담 시작을 위해 이름과 휴대폰 번호를 입력해 주세요.</p>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름"
                className="h-11 w-full rounded-xl border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleStart(); }}
                placeholder="휴대폰 번호 (예: 010-1234-5678)"
                className="h-11 w-full rounded-xl border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              <Button type="button" onClick={() => void handleStart()} disabled={isStarting} className="w-full h-11">
                {isStarting ? <LoaderCircle className="size-4 animate-spin" /> : "상담 시작"}
              </Button>
            </div>
          </div>
        )}

        {phase === "chat" && (
          <div className="space-y-3 max-w-2xl mx-auto">
            {messages.length === 0 && !streamingText && (
              <p className="text-center text-sm text-gray-400 py-10">안녕하세요! 궁금하신 점을 편하게 질문해 주세요.</p>
            )}

            {messages.map((msg) => {
              if (msg.type === "search_progress") {
                return <SearchProgress key={msg.id} message={msg.message} done={msg.done} />;
              }
              if (msg.type === "report") {
                return (
                  <div key={msg.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                    <ReportRenderer data={msg.data} />
                  </div>
                );
              }
              // 일반 텍스트 메시지
              return (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-white text-gray-800 border border-gray-100 rounded-bl-sm"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              );
            })}

            {/* 스트리밍 중 */}
            {streamingText && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white border border-gray-100 px-3.5 py-2.5 text-sm leading-relaxed text-gray-800 shadow-sm whitespace-pre-wrap">
                  {streamingText}
                  <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-gray-400 animate-pulse rounded-sm align-middle" />
                </div>
              </div>
            )}

            {/* AI 로딩 (리포트 생성 중) */}
            {isSending && !streamingText && messages[messages.length - 1]?.type !== "search_progress" && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-3.5 py-2.5 shadow-sm">
                  <LoaderCircle className="size-4 animate-spin text-gray-400" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* 하단 영역 */}
      {phase === "chat" && (
        <div className="shrink-0">

          {/* 질문 카드 */}
          {activeQuestions && currentQuestion && (
            <div className="mx-3 mb-2 rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900 flex-1">{currentQuestion.text}</p>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button type="button" onClick={() => setQuestionIndex(Math.max(0, questionIndex - 1))}
                    disabled={questionIndex === 0} className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30">
                    <ChevronLeft className="size-4 text-gray-500" />
                  </button>
                  <span className="text-xs text-gray-500 tabular-nums px-1">
                    {activeQuestions.length}개 중 {questionIndex + 1}개
                  </span>
                  <button type="button" onClick={() => setQuestionIndex(Math.min(activeQuestions.length - 1, questionIndex + 1))}
                    disabled={questionIndex === activeQuestions.length - 1}
                    className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30">
                    <ChevronRight className="size-4 text-gray-500" />
                  </button>
                  <button type="button" onClick={() => setActiveQuestions(null)}
                    className="p-1 rounded-lg hover:bg-gray-100 ml-1">
                    <X className="size-4 text-gray-400" />
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {currentQuestion.choices.map((choice, ci) => {
                  const selected = questionAnswers[questionIndex] === choice;
                  return (
                    <button key={ci} type="button" onClick={() => handleChoiceSelect(choice)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${
                        selected ? "bg-blue-50 text-blue-700 font-medium" : "hover:bg-gray-50 text-gray-800"
                      }`}>
                      <span className={`shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-semibold ${
                        selected ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 text-gray-500"
                      }`}>{ci + 1}</span>
                      <span className="flex-1">{choice}</span>
                      {selected && <ChevronRight className="size-4 text-blue-400" />}
                    </button>
                  );
                })}
                <div className="px-4 py-2.5">
                  {showCustom ? (
                    <div className="flex gap-2 items-center">
                      <Pencil className="size-4 text-gray-400 shrink-0" />
                      <input autoFocus value={customInput} onChange={(e) => setCustomInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleCustomSubmit(); }}
                        placeholder="직접 입력..."
                        className="flex-1 h-8 text-sm bg-transparent border-b border-gray-300 outline-none focus:border-blue-500" />
                      <Button type="button" size="sm" onClick={handleCustomSubmit} disabled={!customInput.trim()}>확인</Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <button type="button" onClick={() => setShowCustom(true)}
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
                        <Pencil className="size-4" />기타
                      </button>
                      <button type="button" onClick={handleSkip}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700 px-4 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
                        건너뛰기
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 퀵 질문 칩 */}
          {messages.length === 0 && !isSending && (
            <div className="bg-white px-3 pt-2 pb-1 overflow-x-auto">
              <div className="flex gap-2 w-max">
                {[
                  "가맹비 얼마야?",
                  "초기 창업 비용 총 얼마야?",
                  "월 예상 수익이 어떻게 돼?",
                  "창업 절차 알려줘",
                  "로열티는 얼마야?",
                  "평균 매출이 어떻게 돼?",
                  "어떤 입지가 좋아?",
                  "폐점률이 어떻게 돼?",
                  "인테리어 비용 얼마야?",
                  "경쟁력이 뭐야?",
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void sendMessage(q)}
                    disabled={isSending}
                    className="shrink-0 rounded-full bg-gray-800 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-gray-700 active:bg-gray-900 transition-colors disabled:opacity-40"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 입력창 */}
          <div className="border-t border-gray-200 bg-white px-3 py-2.5 flex gap-2 items-end">
            <textarea value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(input); } }}
              placeholder="질문을 입력해 주세요"
              disabled={isSending}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 max-h-32 overflow-y-auto" />
            <Button type="button" onClick={() => void sendMessage(input)} disabled={isSending || !input.trim()} className="h-10 shrink-0">
              {isSending ? <LoaderCircle className="size-4 animate-spin" /> : "전송"}
            </Button>
          </div>
          <div className="bg-white px-3 pb-1">
            <button type="button" onClick={() => setCallbackOpen(true)}
              className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
              담당자 직접 상담 요청
            </button>
          </div>
          <p className="text-center text-[10px] text-gray-400 pb-2">본 상담은 AI 기반이며 법적 효력이 없습니다</p>
        </div>
      )}

      {/* 콜백 모달 */}
      {callbackOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-t-3xl sm:rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-gray-900">담당자 연결 요청</h2>
            <p className="mt-1 text-sm text-gray-500">원하시는 상담 가능 시간을 적어주세요.</p>
            <input value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)}
              placeholder="예: 평일 오후 3시 이후"
              className="mt-3 h-11 w-full rounded-xl border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setCallbackOpen(false)}>취소</Button>
              <Button type="button" onClick={() => void requestCallback()} disabled={isCallbackLoading}>
                {isCallbackLoading ? <LoaderCircle className="size-4 animate-spin" /> : "요청"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
