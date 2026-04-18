import type { ReportAnalysis } from "@/lib/ai/schema";
import type { DbBrand } from "@/types/database";

interface GenerateDocxInput {
  reportId: string;
  brand: DbBrand;
  analysis: ReportAnalysis;
}

export async function generateDocx(input: GenerateDocxInput): Promise<Uint8Array> {
  try {
    const content = [
      `Report ID: ${input.reportId}`,
      `Brand: ${input.brand.brand_name}`,
      `Recommendation: ${input.analysis.recommendation}`,
      `Total Score: ${input.analysis.evaluation.total}`,
      "",
      JSON.stringify(input.analysis, null, 2),
    ].join("\n");

    return new TextEncoder().encode(content);
  } catch (error) {
    console.error("[docx] Failed to generate document buffer", error);
    throw error;
  }
}
