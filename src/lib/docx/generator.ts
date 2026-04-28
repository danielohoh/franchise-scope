import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

import type { ReportAnalysis } from "@/lib/ai/schema";
import type { DbBrand } from "@/types/database";
import {
  COLORS,
  FONT_SIZES,
  FONTS,
  formatKRW,
  formatNumber,
} from "./styles";

// ────────────────────────────────────────────────────────────
// Input type
// ────────────────────────────────────────────────────────────

export interface GenerateDocxInput {
  reportId: string;
  brand: DbBrand;
  analysis: ReportAnalysis;
}

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const CM = { top: 80, bottom: 80, left: 120, right: 120 } as const;

const THIN_BORDER = { style: "single" as const, size: 4, color: "CCCCCC" };
const CELL_BORDERS = {
  top: THIN_BORDER,
  bottom: THIN_BORDER,
  left: THIN_BORDER,
  right: THIN_BORDER,
};

const RISK_BG: Record<string, string> = {
  치명적: "FCE4E4",
  높음: "FDEBD0",
  보통: "F2F2F2",
  낮음: "E2EFDA",
};
const RISK_COLOR: Record<string, string> = {
  치명적: "B71C1C",
  높음: "8B4513",
  보통: "595959",
  낮음: "1A7A3A",
};
const REC_STYLE: Record<string, { bg: string; color: string }> = {
  적극추천: { bg: "E2EFDA", color: "1A7A3A" },
  조건부추천: { bg: "FFF2CC", color: "8B6914" },
  재검토필요: { bg: "FCE4D6", color: "A0400A" },
  반려: { bg: "FCE4E4", color: "B71C1C" },
};

// ────────────────────────────────────────────────────────────
// Low-level helpers
// ────────────────────────────────────────────────────────────

function run(
  text: string,
  opts: { bold?: boolean; size?: number; color?: string; italic?: boolean } = {},
): TextRun {
  return new TextRun({
    text,
    bold: opts.bold,
    size: opts.size ?? FONT_SIZES.body,
    color: opts.color,
    italics: opts.italic,
    font: FONTS.ko,
  });
}

function para(
  content: string | TextRun[],
  opts: {
    bold?: boolean;
    size?: number;
    color?: string;
    align?: keyof typeof AlignmentType;
    spaceBefore?: number;
    spaceAfter?: number;
    shadingFill?: string;
    pageBreak?: boolean;
  } = {},
): Paragraph {
  const children = Array.isArray(content)
    ? content
    : [run(content, { bold: opts.bold, size: opts.size, color: opts.color })];

  return new Paragraph({
    children,
    alignment: opts.align ? AlignmentType[opts.align] : undefined,
    spacing: { before: opts.spaceBefore ?? 0, after: opts.spaceAfter ?? 0 },
    shading: opts.shadingFill
      ? { fill: opts.shadingFill, type: ShadingType.SOLID }
      : undefined,
    pageBreakBefore: opts.pageBreak,
  });
}

function gap(pts = 8): Paragraph {
  return new Paragraph({ text: "", spacing: { before: pts * 20, after: 0 } });
}

function cell(
  content: string | TextRun[],
  opts: {
    bg?: string;
    bold?: boolean;
    color?: string;
    align?: keyof typeof AlignmentType;
    width?: number;
    span?: number;
    size?: number;
    vAlign?: "CENTER" | "TOP" | "BOTTOM";
  } = {},
): TableCell {
  const runs = Array.isArray(content)
    ? content
    : [run(content, { bold: opts.bold, color: opts.color, size: opts.size })];

  return new TableCell({
    children: [
      new Paragraph({
        children: runs,
        alignment: opts.align ? AlignmentType[opts.align] : AlignmentType.LEFT,
      }),
    ],
    shading: opts.bg ? { fill: opts.bg, type: ShadingType.SOLID } : undefined,
    width: opts.width != null ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    verticalAlign: opts.vAlign ? VerticalAlign[opts.vAlign] : VerticalAlign.CENTER,
    columnSpan: opts.span,
    margins: CM,
    borders: CELL_BORDERS,
  });
}

function hCell(text: string, width?: number, span?: number): TableCell {
  return cell(text, {
    bg: COLORS.primary,
    bold: true,
    color: COLORS.white,
    align: "CENTER",
    width,
    span,
    size: FONT_SIZES.sectionHeader,
    vAlign: "CENTER",
  });
}

function lCell(text: string, width?: number): TableCell {
  return cell(text, { bg: COLORS.labelBg, bold: true, width, vAlign: "CENTER" });
}

function sectionBar(title: string, pageBreak = false): Paragraph {
  return para(title, {
    bold: true,
    size: 22,
    color: COLORS.white,
    shadingFill: COLORS.primary,
    spaceBefore: pageBreak ? 0 : 280,
    pageBreak,
  });
}

// ────────────────────────────────────────────────────────────
// 공식 계산
// ────────────────────────────────────────────────────────────

function calcProfit(rev: number, cost: ReportAnalysis["cost_simulation"]): number {
  return (
    rev
    - Math.round(rev * cost.supply_cost_rate)
    - cost.labor_and_rent
    - Math.round(rev * cost.delivery_commission_rate)
    - cost.royalty_and_others
  );
}

// ────────────────────────────────────────────────────────────
// Section builders
// ────────────────────────────────────────────────────────────

function buildCover(brand: DbBrand, analysis: ReportAnalysis): Paragraph[] {
  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const rec = REC_STYLE[analysis.recommendation] ?? { bg: COLORS.lightGray, color: COLORS.black };

  return [
    gap(20),
    para(brand.brand_name, {
      bold: true,
      size: 40,
      align: "CENTER",
      spaceBefore: 400,
    }),
    para("상권 분석 보고서", {
      size: 26,
      align: "CENTER",
      color: COLORS.gray,
      spaceAfter: 0,
    }),
    gap(20),
    para(analysis.location_info.address, {
      size: 20,
      align: "CENTER",
      color: COLORS.gray,
    }),
    para(today, {
      size: 18,
      align: "CENTER",
      color: COLORS.gray,
      spaceAfter: 0,
    }),
    gap(24),
    // 추천 의견 + 총점 배지
    para(
      [
        run("추천 의견: ", { bold: true, size: 22 }),
        run(analysis.recommendation, { bold: true, size: 28, color: rec.color }),
        run("   |   종합 점수: ", { size: 20 }),
        run(`${analysis.evaluation.total} / 100`, { bold: true, size: 28 }),
      ],
      {
        align: "CENTER",
        shadingFill: rec.bg,
        spaceBefore: 40,
        spaceAfter: 40,
      },
    ),
    gap(16),
    // 권고 사유
    para("[ 권고 사유 ]", {
      bold: true,
      size: FONT_SIZES.sectionHeader,
      color: COLORS.gray,
    }),
    para(analysis.recommendation_reason, {
      size: FONT_SIZES.body,
      spaceAfter: 40,
    }),
  ];
}

function buildLocationTable(analysis: ReportAnalysis): Table {
  const loc = analysis.location_info;
  const rows: [string, string][] = [
    ["보증금", formatKRW(loc.deposit)],
    ["월 임대료", `${formatKRW(loc.monthly_rent)} / 월`],
    ["관리비", `${formatKRW(loc.maintenance_fee)} / 월`],
    ["권리금", formatKRW(loc.key_money)],
    ["월 임차 총비용", `${formatKRW(loc.monthly_rent + loc.maintenance_fee)} / 월`],
    ["추정 면적", `${loc.estimated_area_pyeong}평`],
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      ([label, value]) =>
        new TableRow({ children: [lCell(label, 30), cell(value, { width: 70 })] }),
    ),
  });
}

function buildPopulationTable(analysis: ReportAnalysis): Table {
  const pop = analysis.population;
  type RadiusKey = keyof typeof pop.radius_500m;
  const metrics: [string, RadiusKey, string][] = [
    ["주거 인구", "residential", "명"],
    ["세대 수", "households", "세대"],
    ["직장 인구", "workers", "명"],
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [hCell("구분", 22), hCell("500m", 26), hCell("1km", 26), hCell("2km", 26)],
      }),
      ...metrics.map(
        ([label, key, unit]) =>
          new TableRow({
            children: [
              lCell(label, 22),
              cell(formatNumber(pop.radius_500m[key]) + unit, { align: "RIGHT", width: 26 }),
              cell(formatNumber(pop.radius_1km[key]) + unit, { align: "RIGHT", width: 26 }),
              cell(formatNumber(pop.radius_2km[key]) + unit, { align: "RIGHT", width: 26 }),
            ],
          }),
      ),
      new TableRow({ children: [lCell("핵심 연령대", 22), cell(pop.core_age_group, { span: 3 })] }),
      new TableRow({ children: [lCell("성별 비율", 22), cell(pop.gender_ratio, { span: 3 })] }),
      new TableRow({
        children: [lCell("상권 유형", 22), cell(pop.commercial_area_type, { span: 3 })],
      }),
    ],
  });
}

function buildCompetitorTable(
  competitors: ReportAnalysis["competitors"],
  type: "프랜차이즈" | "개인점",
): (Paragraph | Table)[] {
  const list = competitors.filter((c) => c.type === type).slice(0, 5);
  const title = type === "프랜차이즈" ? "🏢 프랜차이즈 경쟁점" : "🏪 일반매장 경쟁점";

  const subHead = para(title, {
    bold: true,
    size: FONT_SIZES.sectionHeader,
    shadingFill: COLORS.primaryLight,
    spaceBefore: 160,
    spaceAfter: 0,
  });

  if (list.length === 0) {
    return [
      subHead,
      para("해당 경쟁점 없음", { color: COLORS.gray, spaceBefore: 40, spaceAfter: 0 }),
    ];
  }

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          hCell("이름", 32),
          hCell("거리", 12),
          hCell("평점", 9),
          hCell("추정 월매출", 27),
          hCell("위험도", 20),
        ],
      }),
      ...list.map(
        (c) =>
          new TableRow({
            children: [
              cell(c.name, { width: 32, size: FONT_SIZES.small }),
              cell(`${Math.round(c.distance_m)}m`, { align: "RIGHT", width: 12 }),
              cell(c.rating != null ? c.rating.toFixed(1) : "-", { align: "CENTER", width: 9 }),
              cell(formatKRW(c.estimated_monthly_revenue), { align: "RIGHT", width: 27 }),
              cell(c.risk_level, {
                align: "CENTER",
                bg: RISK_BG[c.risk_level],
                bold: c.risk_level === "치명적",
                color: RISK_COLOR[c.risk_level],
                width: 20,
              }),
            ],
          }),
      ),
    ],
  });

  return [subHead, table];
}

function buildRevenueSection(analysis: ReportAnalysis): (Paragraph | Table)[] {
  const rev = analysis.revenue_simulation;
  const cost = analysis.cost_simulation;
  const loc = analysis.location_info;

  const scenarios: [string, number][] = [
    ["보수적", rev.conservative.monthly_revenue],
    ["기본", rev.standard.monthly_revenue],
    ["낙관적", rev.optimistic.monthly_revenue],
  ];

  const simTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [hCell("항목", 25), hCell("보수적", 25), hCell("기본", 25), hCell("낙관적", 25)],
      }),
      new TableRow({
        children: [
          lCell("월 매출", 25),
          ...scenarios.map(([label, r]) =>
            cell(formatKRW(r), {
              align: "RIGHT",
              width: 25,
              bold: label === "기본",
              bg: label === "기본" ? COLORS.highlight : undefined,
            }),
          ),
        ],
      }),
      new TableRow({
        children: [
          lCell("월 영업이익", 25),
          ...scenarios.map(([label, r]) =>
            cell(formatKRW(calcProfit(r, cost)), {
              align: "RIGHT",
              width: 25,
              bold: label === "기본",
              bg: label === "기본" ? COLORS.highlight : undefined,
            }),
          ),
        ],
      }),
      ...(analysis.industry_benchmark
        ? [
            new TableRow({
              children: [
                lCell(`${analysis.industry_benchmark.sub_label} 전국평균`, 25),
                cell("-", { align: "CENTER", width: 25 }),
                cell(formatKRW(analysis.industry_benchmark.avg_monthly_revenue), {
                  align: "RIGHT",
                  width: 25,
                  bold: false,
                  bg: "F0F4FF",
                }),
                cell("-", { align: "CENTER", width: 25 }),
              ],
            }),
          ]
        : []),
    ],
  });

  const stdRev = rev.standard.monthly_revenue;
  const costRows: [string, string, string][] = [
    [
      "공급원가",
      `월매출 × ${Math.round(cost.supply_cost_rate * 100)}%`,
      formatKRW(Math.round(stdRev * cost.supply_cost_rate)),
    ],
    [
      "인건비 + 임대료",
      `고정비 (임대료 ${formatKRW(loc.monthly_rent)} + 관리비 ${formatKRW(loc.maintenance_fee)} 포함)`,
      formatKRW(cost.labor_and_rent),
    ],
    [
      "배달 수수료",
      `월매출 × ${Math.round(cost.delivery_commission_rate * 100)}%`,
      formatKRW(Math.round(stdRev * cost.delivery_commission_rate)),
    ],
    ["로열티 등 기타", "고정비", formatKRW(cost.royalty_and_others)],
  ];

  const costTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [hCell("비용 항목", 25), hCell("산출 기준", 50), hCell("금액 (기본)", 25)],
      }),
      ...costRows.map(
        ([item, basis, amount]) =>
          new TableRow({
            children: [
              lCell(item, 25),
              cell(basis, { width: 50, size: FONT_SIZES.small }),
              cell(amount, { align: "RIGHT", width: 25 }),
            ],
          }),
      ),
      new TableRow({
        children: [
          cell("기본 시나리오 월영업이익", {
            bg: COLORS.highlight,
            bold: true,
            span: 2,
            align: "RIGHT",
          }),
          cell(formatKRW(calcProfit(stdRev, cost)), {
            bg: COLORS.highlight,
            bold: true,
            align: "RIGHT",
            width: 25,
          }),
        ],
      }),
    ],
  });

  return [
    simTable,
    ...(analysis.industry_benchmark
      ? [
          new Paragraph({
            children: [
              new TextRun({
                text: `※ 전국 평균: ${analysis.industry_benchmark.source} 기준. 실제 매출은 입지, 영업력에 따라 크게 차이가 있습니다.`,
                size: 16,
                color: "888888",
                italics: true,
                font: FONTS.ko,
              }),
            ],
            spacing: { before: 60 },
          }),
        ]
      : []),
    gap(12),
    para("비용 구조 상세 (기본 시나리오 기준)", {
      bold: true,
      size: FONT_SIZES.sectionHeader,
      spaceBefore: 160,
    }),
    costTable,
  ];
}

function buildInvestmentTable(analysis: ReportAnalysis): Table {
  const inv = analysis.investment;

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [hCell("투자 항목", 60), hCell("금액", 40)],
      }),
      ...inv.items.map(
        (item) =>
          new TableRow({
            children: [
              cell(item.name, { width: 60 }),
              cell(formatKRW(item.amount), { align: "RIGHT", width: 40 }),
            ],
          }),
      ),
      new TableRow({
        children: [
          lCell("총 투자 비용", 60),
          cell(formatKRW(inv.total), { align: "RIGHT", bold: true, width: 40, bg: COLORS.labelBg }),
        ],
      }),
      new TableRow({
        children: [
          cell("월 영업이익 (기본)", { width: 60 }),
          cell(formatKRW(inv.monthly_profit), { align: "RIGHT", width: 40 }),
        ],
      }),
      new TableRow({
        children: [
          cell("연간 ROI", { width: 60 }),
          cell(`${inv.annual_roi_percent.toFixed(1)}%`, {
            align: "RIGHT",
            bold: true,
            bg: COLORS.highlight,
            width: 40,
          }),
        ],
      }),
      new TableRow({
        children: [
          cell("투자금 회수 기간", { width: 60 }),
          cell(`${inv.payback_months.toFixed(1)}개월`, { align: "RIGHT", bold: true, width: 40 }),
        ],
      }),
    ],
  });
}

function buildSwotTable(analysis: ReportAnalysis): Table {
  const swot = analysis.swot;

  function swotCell(title: string, items: string[], bg: string): TableCell {
    return new TableCell({
      children: [
        new Paragraph({
          children: [run(title, { bold: true, size: FONT_SIZES.sectionHeader })],
          spacing: { before: 0, after: 100 },
        }),
        ...items.map(
          (item) =>
            new Paragraph({
              children: [run(`• ${item}`, { size: FONT_SIZES.body })],
              spacing: { before: 40, after: 40 },
            }),
        ),
      ],
      shading: { fill: bg, type: ShadingType.SOLID },
      width: { size: 50, type: WidthType.PERCENTAGE },
      verticalAlign: VerticalAlign.TOP,
      margins: { top: 120, bottom: 120, left: 160, right: 160 },
      borders: CELL_BORDERS,
    });
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          swotCell("강점 (Strengths)", swot.strengths, COLORS.swotStrength),
          swotCell("약점 (Weaknesses)", swot.weaknesses, COLORS.swotWeakness),
        ],
      }),
      new TableRow({
        children: [
          swotCell("기회 (Opportunities)", swot.opportunities, COLORS.swotOpportunity),
          swotCell("위협 (Threats)", swot.threats, COLORS.swotThreat),
        ],
      }),
    ],
  });
}

function buildEvaluationTable(analysis: ReportAnalysis): Table {
  const ev = analysis.evaluation;
  const rows: [string, number, number][] = [
    ["입지", ev.location.score, ev.location.max],
    ["수요", ev.demand.score, ev.demand.max],
    ["경쟁", ev.competition.score, ev.competition.max],
    ["수익성", ev.profitability.score, ev.profitability.max],
    ["성장", ev.growth.score, ev.growth.max],
    ["브랜드 적합", ev.brand_fit.score, ev.brand_fit.max],
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [hCell("평가 항목", 50), hCell("점수", 25), hCell("만점", 25)],
      }),
      ...rows.map(
        ([label, score, max]) =>
          new TableRow({
            children: [
              lCell(label, 50),
              cell(String(score), { align: "CENTER", width: 25 }),
              cell(String(max), { align: "CENTER", width: 25 }),
            ],
          }),
      ),
      new TableRow({
        children: [
          cell("총점", { bg: COLORS.labelBg, bold: true, width: 50 }),
          cell(String(ev.total), {
            align: "CENTER",
            bold: true,
            bg: COLORS.highlight,
            width: 25,
          }),
          cell("100", { align: "CENTER", width: 25 }),
        ],
      }),
    ],
  });
}

// ────────────────────────────────────────────────────────────
// Main export
// ────────────────────────────────────────────────────────────

export async function generateDocx(input: GenerateDocxInput): Promise<Uint8Array> {
  const { brand, analysis } = input;

  // 경쟁점 경고 배너 (해당 시)
  const alertBanner: Paragraph[] =
    analysis.alert?.alert_type && analysis.alert.alert_type !== "none"
      ? [
          para(
            `⚠ 경쟁점 경고: ${analysis.alert.competitor_name} — ${analysis.alert.detail}`,
            {
              bold: true,
              color: "B71C1C",
              shadingFill: COLORS.danger,
              spaceBefore: 80,
              spaceAfter: 80,
            },
          ),
        ]
      : [];

  const children = [
    // ── 표지 ──────────────────────────────────────
    ...buildCover(brand, analysis),
    ...alertBanner,

    // ── 1. 입지 조건 ──────────────────────────────
    sectionBar("1. 입지 조건", true),
    gap(4),
    buildLocationTable(analysis),

    // ── 2. 배후 인구 ──────────────────────────────
    sectionBar("2. 배후 인구"),
    gap(4),
    buildPopulationTable(analysis),

    // ── 3. 경쟁점 현황 ────────────────────────────
    sectionBar("3. 경쟁점 현황"),
    gap(4),
    ...buildCompetitorTable(analysis.competitors, "프랜차이즈"),
    gap(8),
    ...buildCompetitorTable(analysis.competitors, "개인점"),

    // ── 4. 매출 시뮬레이션 ────────────────────────
    sectionBar("4. 매출 시뮬레이션"),
    gap(4),
    ...buildRevenueSection(analysis),

    // ── 5. 투자 분석 ──────────────────────────────
    sectionBar("5. 투자 분석"),
    gap(4),
    buildInvestmentTable(analysis),

    // ── 6. SWOT 분석 ──────────────────────────────
    sectionBar("6. SWOT 분석"),
    gap(4),
    buildSwotTable(analysis),

    // ── 7. 종합 평가 항목 ─────────────────────────
    sectionBar("7. 종합 평가 항목"),
    gap(4),
    buildEvaluationTable(analysis),
  ];

  const doc = new Document({
    creator: "FranchiseScope",
    title: `${brand.brand_name} 상권 분석 보고서`,
    description: `${analysis.location_info.address} 상권 분석`,
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}
