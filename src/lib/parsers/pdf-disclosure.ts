import pdfParse from "pdf-parse";
import { z } from "zod";

import { DISCLOSURE_EXTRACTION_SYSTEM_PROMPT } from "@/lib/ai/prompts/system";
import { generateStructuredExtraction } from "@/lib/ai/stream-handler";

type PdfExtractResult = {
  text: string;
  pageCount: number;
  method: "kordoc" | "pdf-parse";
};

type KordocPage = {
  text?: string;
};

type KordocResult = {
  pages?: KordocPage[];
};

type KordocModule = {
  parseFromBuffer?: (buffer: Buffer, options: { format: "pdf" }) => Promise<KordocResult>;
};

type SectionExtractResult = {
  data: unknown;
  confidence: number;
};

const GenericSectionSchema = z.record(z.string(), z.unknown());

const clampConfidence = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
};

const estimateConfidence = (data: unknown): number => {
  if (!data || typeof data !== "object") {
    return 0.35;
  }

  const values = Object.values(data as Record<string, unknown>);
  if (values.length === 0) {
    return 0.35;
  }

  const filled = values.filter((value) => {
    if (value === null || value === undefined) {
      return false;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === "string") {
      return value.trim().length > 0;
    }
    return true;
  }).length;

  return clampConfidence(0.4 + (filled / values.length) * 0.6);
};

export const extractTextFromPdf = async (buffer: Buffer): Promise<PdfExtractResult> => {
  try {
    const kordoc = (await import("kordoc")) as KordocModule;
    if (!kordoc.parseFromBuffer) {
      throw new Error("kordoc parseFromBuffer unavailable");
    }

    const result = await kordoc.parseFromBuffer(buffer, {
      format: "pdf",
    });

    const pages = result.pages ?? [];
    const text = pages.map((page) => page.text ?? "").join("\n");

    if (text.trim().length > 0) {
      return {
        text,
        pageCount: pages.length,
        method: "kordoc",
      };
    }
  } catch {
    // fallback below
  }

  const parsed = await pdfParse(buffer);
  return {
    text: parsed.text ?? "",
    pageCount: parsed.numpages ?? 0,
    method: "pdf-parse",
  };
};

export const extractSectionFromText = async (
  section: string,
  rawText: string,
  systemPrompt: string = DISCLOSURE_EXTRACTION_SYSTEM_PROMPT,
): Promise<SectionExtractResult> => {
  const maxTextLength = 28000;
  const selectedText = rawText.length > maxTextLength ? rawText.slice(0, maxTextLength) : rawText;

  const userPrompt = [
    `섹션: ${section}`,
    "아래 정보공개서 원문에서 해당 섹션에 해당하는 정보만 JSON으로 추출하세요.",
    selectedText,
  ].join("\n\n");

  const data = await generateStructuredExtraction(systemPrompt, userPrompt, GenericSectionSchema);
  return {
    data,
    confidence: estimateConfidence(data),
  };
};
