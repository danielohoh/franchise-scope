// ============================================================
// POST /api/consult/chat
// 커스텀 SSE 스트림으로 웹검색 진행 상황 + AI 응답 반환
//
// SSE 이벤트 목록:
//   search_start   — 검색 시작 알림 (queries, message)
//   search_result  — 개별 쿼리 결과
//   report         — 리포트 모드 JSON 데이터
//   text_delta     — 일반 텍스트 스트리밍 조각
//   clarify        — [CLARIFY] 질문 카드 데이터
//   done           — 스트림 종료
// ============================================================

import { generateObject, generateText, streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildReportSearchQueries,
  isSearchConfigured,
  multiSearch,
  type SearchQueryResult,
} from "@/lib/search/web-search";
import { buildSystemPrompt } from "@/lib/ai/consult-prompts";
import type { Database } from "@/types/database";

// ── LLM 팩토리 ───────────────────────────────────────────────

function getLlmModel() {
  const apiKey = process.env.LLM_API_KEY?.trim();
  const provider = (process.env.LLM_PROVIDER?.trim() ?? "groq") as "anthropic" | "openai" | "groq";
  const model = process.env.LLM_MODEL?.trim() ?? "meta-llama/llama-4-scout-17b-16e-instruct";
  if (!apiKey) throw new Error("LLM_API_KEY 환경변수가 설정되지 않았습니다.");
  switch (provider) {
    case "anthropic": return createAnthropic({ apiKey })(model);
    case "openai": return createOpenAI({ apiKey })(model);
    default: return createGroq({ apiKey })(model);
  }
}

// ── 입력 검증 ────────────────────────────────────────────────

const chatSchema = z.object({
  session_id: z.string().uuid(),
  message: z.string().trim().min(1),
});

// ── 리포트 스키마 (느슨하게 → 이후 정규화) ─────────────────

const reportSchema = z.object({
  intro: z.string().optional().default("조사한 내용을 바탕으로 상황에 맞는 분석을 정리해 드릴게요."),
  kpis: z.array(z.object({
    label: z.string(),
    value: z.string(),
    note: z.string().optional(),
    color: z.enum(["default", "green", "blue", "red"]).optional().default("default"),
  })).default([]),
  charts: z.array(z.object({
    type: z.string(),
    title: z.string(),
    subtitle: z.string().optional(),
    data: z.array(z.any()),
  })).default([]),
  sections: z.array(z.object({
    title: z.string(),
    content: z.string(),
    citations: z.array(z.object({
      label: z.string(),
      url: z.string().optional(),
    })).optional(),
  })).default([]),
});

type RawReport = z.infer<typeof reportSchema>;

/** LLM 응답의 charts 데이터를 클라이언트가 기대하는 형식으로 정규화 */
function normalizeReport(raw: RawReport): z.infer<typeof reportSchema> {
  const charts = (Array.isArray(raw.charts) ? raw.charts : []).map((c) => {
    // data가 객체이면 배열로 변환 ({가맹비: 715} → [{name:"가맹비", value:715}])
    let dataArr: unknown[];
    if (Array.isArray(c.data)) {
      dataArr = c.data as unknown[];
    } else if (c.data && typeof c.data === "object") {
      dataArr = Object.entries(c.data as Record<string, unknown>).map(([k, v]) => ({
        name: k,
        value: typeof v === "number" ? v : parseFloat(String(v)) || 0,
      }));
    } else {
      dataArr = [];
    }

    // 개별 항목 정규화
    const normalizedData = dataArr.map((item) => {
      if (!item || typeof item !== "object") return { name: String(item), value: 0 };
      const obj = item as Record<string, unknown>;
      if ("name" in obj && "value" in obj) return obj;
      // "항목명": 숫자 형식 → {name, value}
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (typeof v === "number") return { name: k, value: v };
      }
      return obj;
    });

    // label → title fallback (LLM이 label을 쓰는 경우 대비)
    const titleVal = (c.title ?? (c as Record<string, unknown>).label ?? "차트") as string;
    return { ...c, title: titleVal, data: normalizedData };
  });

  // kpis가 객체이면 배열로 변환
  const kpisRaw = raw.kpis;
  const kpis = Array.isArray(kpisRaw)
    ? kpisRaw
    : Object.entries((kpisRaw as unknown as Record<string, unknown>) ?? {}).map(([label, value]) => ({
        label,
        value: String(value),
        color: "default" as const,
      }));

  return { ...raw, kpis, charts };
}

// ── 정보 추출 스키마 ─────────────────────────────────────────

const extractSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  preferred_region: z.string().optional(),
  investment_budget: z.number().optional(),
  experience: z.string().optional(),
  readiness_level: z.enum(["초기탐색", "진지검토", "계약의향"]).optional(),
});

// ── 리포트 생성 프롬프트 ────────────────────────────────────

function buildReportPrompt(
  brand: Database["public"]["Tables"]["brands"]["Row"],
  userAnswers: string,
  searchResults: SearchQueryResult[],
): string {
  const searchContext = searchResults
    .map((sq) => {
      if (!sq.results.length) return `검색어: "${sq.query}"\n검색 결과 없음`;
      const items = sq.results
        .slice(0, 3)
        .map((r) => `  - ${r.title}: ${r.content} (${r.domain})`)
        .join("\n");
      return `검색어: "${sq.query}"\n${items}`;
    })
    .join("\n\n");

  return `다음 정보를 바탕으로 프랜차이즈 창업 분석 리포트를 JSON으로 작성하세요.

[브랜드 기본 정보]
- 브랜드명: ${brand.brand_name}
- 업종: ${brand.industry} > ${brand.sub_industry ?? ""}
- 가맹비: ${brand.franchise_fee != null ? `${brand.franchise_fee.toLocaleString()}원` : "미입력"}
- 교육비: ${brand.education_fee != null ? `${brand.education_fee.toLocaleString()}원` : "미입력"}
- 보증금: ${brand.deposit != null ? `${brand.deposit.toLocaleString()}원` : "미입력"}
- 평균 점포 면적: ${brand.avg_store_size_pyeong ?? "?"}평
- 가맹점 평균 월매출: ${brand.avg_monthly_revenue != null ? `${brand.avg_monthly_revenue.toLocaleString()}원` : "미입력"}

[사용자 상황 (질문 답변)]
${userAnswers}

[웹 검색 결과]
${searchContext || "검색 결과 없음 — 일반 지식 기반으로 추정하여 작성"}

[리포트 작성 지침]
- intro: "조사한 내용을 바탕으로 상황에 맞는 분석을 정리해 드릴게요." 형태
- kpis: 4개 — 기본 창업비용(만원 단위), 프로모션/조건부 비용(있으면 green), 연평균 매출, 예상 월 순이익 범위
- charts[0]: donut 차트 — 창업비용 구성 (가맹비/교육비/인테리어/기타 설비를 만원 단위)
- charts[1]: bar 차트 — 월매출 대비 비용 구조 (원재료비/인건비/임대료/배달수수료/기타경비/순이익을 % 단위, 순이익은 highlight:true, color:"#22c55e")
- sections: 3~4개 섹션 (초기 비용 정리 / 수익성 현실 체크 / 초보 창업자 체크포인트 등)
  - 각 섹션 citations에 웹검색 출처 포함 (label=도메인명, url=URL)
- 수치는 현실적으로, 범위로 표현 (예: "250~450만")
- 검색 결과가 없으면 업계 평균 기반 추정치로 작성 (추정임을 명시)`;
}

// ── SSE 유틸 ────────────────────────────────────────────────

function createSSEStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController | null = null;

  const stream = new ReadableStream({
    start(ctrl) { controller = ctrl; },
    cancel() { controller = null; },
  });

  const send = (event: string, data: unknown) => {
    if (!controller) return;
    controller.enqueue(
      encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
    );
  };

  const close = () => { controller?.close(); controller = null; };

  return { stream, send, close };
}

// ── 메인 핸들러 ──────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = chatSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "요청값 오류" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 세션 → 링크 → 브랜드 로드
    const { data: session } = await supabase
      .from("consultation_sessions").select("id, link_id").eq("id", parsed.data.session_id).maybeSingle();
    if (!session) return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });

    const { data: link } = await supabase
      .from("consultation_links").select("id, brand_id").eq("id", session.link_id).maybeSingle();
    if (!link) return NextResponse.json({ error: "링크를 찾을 수 없습니다." }, { status: 404 });

    const { data: brand } = await supabase
      .from("brands").select("*").eq("id", link.brand_id).maybeSingle();
    if (!brand) return NextResponse.json({ error: "브랜드를 찾을 수 없습니다." }, { status: 404 });

    const userMessage = parsed.data.message;

    // 사용자 메시지 저장
    await supabase.from("chat_messages").insert({ session_id: session.id, role: "user", content: userMessage });
    await supabase.from("consultation_sessions").update({ last_active_at: new Date().toISOString() }).eq("id", session.id);

    // 히스토리 (최근 20개)
    const { data: history } = await supabase
      .from("chat_messages").select("role, content")
      .eq("session_id", session.id).order("created_at", { ascending: false }).limit(20);
    const orderedHistory = [...(history ?? [])].reverse();

    // FAQ 검색
    const { data: docs } = await supabase
      .from("knowledge_docs").select("title, content").eq("brand_id", brand.id).order("created_at", { ascending: false });
    const faqChunks = (docs ?? []).slice(0, 3)
      .map((d, i) => `(${i + 1}) ${d.title}\n${d.content.slice(0, 1500)}`).join("\n\n");

    // SSE 스트림 시작
    const { stream, send, close } = createSSEStream();

    const response = new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });

    // ── 비동기 처리 시작 ─────────────────────────────────────
    void (async () => {
      try {
        const isAnswerMessage = userMessage.startsWith("[답변]");

        // ── 리포트 모드 ([답변] 태그 수신 시) ────────────────
        if (isAnswerMessage) {
          const searchConfigured = isSearchConfigured();
          let searchResults: SearchQueryResult[] = [];

          if (searchConfigured) {
            // 검색 쿼리 생성
            const queries = buildReportSearchQueries(brand.brand_name, userMessage);

            // 검색 시작 알림
            send("search_start", {
              message: `${brand.brand_name} 창업에 대해 최신 정보를 찾아볼게요.`,
              queries,
            });

            // 병렬 웹 검색
            searchResults = await multiSearch(queries);

            // 각 검색 결과 전송
            for (const sq of searchResults) {
              send("search_result", { query: sq.query, count: sq.results.length });
            }
          }

          // 리포트 JSON 생성
          send("search_start", { message: "조사한 내용을 바탕으로 분석을 정리하고 있어요...", queries: [] });

          try {
            // Groq는 json_schema 미지원 → generateText + 수동 파싱
            const { text: rawJson } = await generateText({
              model: getLlmModel(),
              messages: [
                {
                  role: "system",
                  content: "당신은 한국 프랜차이즈 창업 분석 전문가입니다. 반드시 유효한 JSON만 출력하고 다른 텍스트는 포함하지 마세요. JSON 코드블록(```json)도 사용하지 마세요.",
                },
                {
                  role: "user",
                  content: buildReportPrompt(brand, userMessage, searchResults),
                },
              ],
            });

            // JSON 추출 (코드블록 제거, 첫 { ~ 마지막 } 추출)
            const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("JSON not found in response");
            const parsed = JSON.parse(jsonMatch[0]) as unknown;

            // 느슨하게 파싱 + 정규화
            const safeResult = reportSchema.safeParse(parsed);
            const rawReport = safeResult.success
              ? safeResult.data
              : {
                  intro: "조사한 내용을 바탕으로 상황에 맞는 분석을 정리해 드릴게요.",
                  kpis: [],
                  charts: [],
                  sections: [],
                  ...((parsed as Record<string, unknown>) ?? {}),
                } as z.infer<typeof reportSchema>;
            const reportData = normalizeReport(rawReport);

            send("report", reportData);

            // 리포트를 assistant 메시지로 DB 저장
            await supabase.from("chat_messages").insert({
              session_id: session.id,
              role: "assistant",
              content: `[REPORT_JSON]${JSON.stringify(reportData)}[/REPORT_JSON]`,
            });
          } catch (reportErr) {
            console.error("[consult/chat] report generation failed", reportErr);
            // 리포트 실패 시 일반 텍스트 응답으로 fallback
            send("text_delta", { delta: "분석 리포트 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." });
          }

          // 정보 추출 — SSE 스트림 닫힌 뒤 완전히 분리 실행 (스트림 차단 금지)
          void (async () => {
            try {
              const { object: extracted } = await generateObject({
                model: getLlmModel(),
                schema: extractSchema,
                prompt: `상담 내용에서 정보를 추출하세요:\n${orderedHistory.map((m) => `${m.role === "user" ? "고객" : "AI"}: ${m.content}`).join("\n")}`,
              });
              await supabase.from("consultation_sessions")
                .update({ extracted_data: extracted }).eq("id", session.id);
            } catch { /* 추출 실패는 무시 */ }
          })();

        } else {
          // ── 일반 채팅 모드 (질문/탐색) ────────────────────
          const chatMessages = orderedHistory.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

          const result = streamText({
            model: getLlmModel(),
            system: buildSystemPrompt(brand, faqChunks),
            messages: chatMessages,
            temperature: 0.7,
            onFinish: async ({ text }) => {
              // AI 응답 DB 저장
              await supabase.from("chat_messages").insert({
                session_id: session.id, role: "assistant", content: text,
              });
              await supabase.from("consultation_sessions")
                .update({ last_active_at: new Date().toISOString() }).eq("id", session.id);

              // [CLARIFY] 블록 파싱
              const clarifyMatch = text.match(/\[CLARIFY\]([\s\S]*?)\[\/CLARIFY\]/);
              if (clarifyMatch) {
                try {
                  const questions = JSON.parse(clarifyMatch[1].trim()) as unknown[];
                  send("clarify", { questions });
                } catch { /* 파싱 실패 무시 */ }
              }
            },
          });

          // 스트리밍 텍스트 전송 ([CLARIFY] 블록 제외)
          let buffer = "";
          for await (const chunk of result.textStream) {
            buffer += chunk;
            // [CLARIFY] 시작 전까지만 전송
            const clarifyStart = buffer.indexOf("[CLARIFY]");
            if (clarifyStart === -1) {
              send("text_delta", { delta: chunk });
            } else {
              // [CLARIFY] 이전 텍스트만 전송 (아직 안 보낸 부분)
              const before = buffer.slice(0, clarifyStart);
              const alreadySent = buffer.length - chunk.length;
              const unsent = before.slice(alreadySent);
              if (unsent) send("text_delta", { delta: unsent });
            }
          }
        }
      } catch (err) {
        console.error("[consult/chat] stream error", err);
        send("text_delta", { delta: "\n\n오류가 발생했습니다. 다시 시도해 주세요." });
      } finally {
        send("done", {});
        close();
      }
    })();

    return response;
  } catch (err) {
    console.error("[consult/chat] unexpected error", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
