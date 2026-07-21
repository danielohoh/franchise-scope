import { createAnthropic } from '@ai-sdk/anthropic';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, streamText } from 'ai';
import { z } from 'zod';

import type { ReportSections } from '@/types/report';

// PRD 버그 5: 다국어 혼용 방지 후처리 필터
// Groq Llama가 컨텍스트가 길어지면 한자/키릴/히라가나로 code-switching하는 문제 방지
export function sanitizeKorean(text: string): string {
  return text
    // CJK 한자 (U+4E00–U+9FFF, U+3400–U+4DBF, U+20000–U+2A6DF 등)
    // 단, 일반적으로 쓰이는 한자는 제거하지 않고 한자 전용 블록만 제거
    .replace(/[\u3400-\u4DBF]/g, '')         // CJK 확장 A
    .replace(/[\u4E00-\u9FFF]/g, '')         // CJK 통합 한자 (기본)
    .replace(/[\uF900-\uFAFF]/g, '')         // CJK 호환 한자
    // 키릴 문자 (러시아어 등)
    .replace(/[\u0400-\u04FF]/g, '')
    // 히라가나·카타카나 (일본어)
    .replace(/[\u3040-\u309F]/g, '')         // 히라가나
    .replace(/[\u30A0-\u30FF]/g, '')         // 카타카나
    // 아랍어·태국어·기타 비한국어 문자 범위 (선택적)
    .replace(/[\u0600-\u06FF]/g, '')         // 아랍어
    // 연속 공백 정리
    .replace(/[ \t]{3,}/g, '  ')
    .trim();
}

type StreamResult = {
  fullText: string;
  tokenCount: number;
};

type StreamSectionInput = {
  section: keyof ReportSections;
  prompt: string;
};

type SseEvent =
  | { type: 'section_start'; section: keyof ReportSections }
  | { type: 'section_delta'; section: keyof ReportSections; delta: string }
  | { type: 'section_complete'; section: keyof ReportSections; html: string; tokenCount: number }
  | { type: 'complete' }
  | { type: 'error'; section?: keyof ReportSections; message: string };

/** LLM_PROVIDER 환경변수에 따라 올바른 provider 모델을 반환 */
function getLLMStreamModel() {
  const apiKey = process.env.LLM_API_KEY;
  const modelId = process.env.LLM_MODEL ?? 'llama-3.3-70b-versatile';
  const provider = (process.env.LLM_PROVIDER ?? 'groq') as 'anthropic' | 'openai' | 'groq';

  if (!apiKey) throw new Error('LLM_API_KEY is not configured');

  switch (provider) {
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(modelId);
    }
    case 'openai': {
      const openai = createOpenAI({ apiKey });
      return openai(modelId);
    }
    case 'groq':
    default: {
      const groq = createGroq({ apiKey });
      return groq(modelId);
    }
  }
}

/** @deprecated createGroqClient 대신 getLLMStreamModel() 사용 */
export const createGroqClient = () => {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error('LLM_API_KEY is not configured');
  return createGroq({ apiKey });
};

export const streamAnalysisSection = async (
  section: keyof ReportSections,
  systemPrompt: string,
  userPrompt: string,
  onChunk: (chunk: string) => void,
): Promise<StreamResult> => {
  try {
    const model = getLLMStreamModel();

    const result = streamText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: 2000,
    });

    let fullText = '';

    for await (const chunk of result.textStream) {
      fullText += chunk;

      try {
        onChunk(chunk);
      } catch {
        // chunk callback 에러는 섹션 생성 자체를 중단하지 않음
      }
    }

    // PRD 버그 5: 다국어 혼용 방지 후처리
    fullText = sanitizeKorean(fullText);

    let tokenCount = 0;
    try {
      const usage = await result.usage;
      tokenCount = usage?.totalTokens ?? usage?.outputTokens ?? 0;
    } catch {
      tokenCount = 0;
    }

    return { fullText, tokenCount };
  } catch {
    return { fullText: '', tokenCount: 0 };
  }
};

export const generateStructuredExtraction = async <T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodSchema<T>,
): Promise<T> => {
  const model = getLLMStreamModel();

  const result = await generateObject({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    schema,
  });

  return result.object;
};

const encodeSse = (event: SseEvent): Uint8Array => {
  const encoder = new TextEncoder();
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
};

// 안전한 스트림 래퍼: 컨트롤러가 닫힌 후 chunk 전송 시 발생하는
// "Invalid state: Controller is already closed" 에러 방지
export const createStreamResponse = (
  reportSections: Array<StreamSectionInput>,
  systemPrompt: string,
): ReadableStream => {
  let isClosed = false;

  const safeEnqueue = (controller: ReadableStreamDefaultController, data: Uint8Array) => {
    if (!isClosed) {
      try {
        controller.enqueue(data);
      } catch {
        isClosed = true;
      }
    }
  };

  const safeClose = (controller: ReadableStreamDefaultController) => {
    if (!isClosed) {
      isClosed = true;
      try {
        controller.close();
      } catch {
        // 이미 닫힌 경우 무시
      }
    }
  };

  const safeError = (controller: ReadableStreamDefaultController, error: unknown) => {
    if (!isClosed) {
      isClosed = true;
      try {
        controller.error(error);
      } catch {
        // 이미 닫힌 경우 무시
      }
    }
  };

  return new ReadableStream({
    start(controller) {
      const run = async () => {
        for (const item of reportSections) {
          if (isClosed) break;

          safeEnqueue(controller, encodeSse({ type: 'section_start', section: item.section }));

          const sectionResult = await streamAnalysisSection(
            item.section,
            systemPrompt,
            item.prompt,
            (chunk) => {
              safeEnqueue(
                controller,
                encodeSse({ type: 'section_delta', section: item.section, delta: chunk }),
              );
            },
          );

          if (isClosed) break;

          if (!sectionResult.fullText) {
            safeEnqueue(
              controller,
              encodeSse({
                type: 'error',
                section: item.section,
                message: `${String(item.section)} 섹션 생성에 실패했습니다.`,
              }),
            );
          }

          safeEnqueue(
            controller,
            encodeSse({
              type: 'section_complete',
              section: item.section,
              html: sectionResult.fullText,
              tokenCount: sectionResult.tokenCount,
            }),
          );
        }

        safeEnqueue(controller, encodeSse({ type: 'complete' }));
        safeClose(controller);
      };

      run().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'unknown error';
        safeEnqueue(controller, encodeSse({ type: 'error', message }));
        safeClose(controller);
      });
    },
    cancel() {
      isClosed = true;
    },
  });
};
