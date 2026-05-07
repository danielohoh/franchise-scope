import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

import { SECTION_LABELS, SECTION_ORDER } from '@/lib/ai/prompts/report-sections';
import type { CollectedData } from '@/types/analysis';
import type { DbAnalysis, DbBrand } from '@/types/database';
import type { ReportSections } from '@/types/report';

const FONT = '맑은 고딕';

type HeadingLevelValue = (typeof HeadingLevel)[keyof typeof HeadingLevel];

const p = (text: string, heading?: HeadingLevelValue): Paragraph =>
  new Paragraph({
    heading,
    children: [new TextRun({ text, font: FONT })],
  });

const tableCell = (text: string): TableCell =>
  new TableCell({
    children: [p(text)],
  });

const parseSectionParagraphs = (value: string): Paragraph[] => {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => p(line));
};

const buildCompetitorTable = (collectedData: CollectedData): Table => {
  const rows = collectedData.competitors?.competitors ?? [];
  const dataRows = rows.slice(0, 15).map(
    (item) =>
      new TableRow({
        children: [
          tableCell(item.name),
          tableCell(`${item.distance_m}m`),
          tableCell(item.rating === null ? '-' : item.rating.toFixed(1)),
          tableCell(`${item.review_count}`),
          tableCell(item.type),
        ],
      }),
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [tableCell('매장명'), tableCell('거리'), tableCell('평점'), tableCell('리뷰수'), tableCell('유형')],
      }),
      ...dataRows,
    ],
  });
};

const buildPopulationTable = (collectedData: CollectedData): Table => {
  const pop = collectedData.population;
  const data = [
    ['500m', `${pop?.radius_500m.residential ?? 0}`, `${pop?.radius_500m.households ?? 0}`, `${pop?.radius_500m.workers ?? 0}`],
    ['1km', `${pop?.radius_1km.residential ?? 0}`, `${pop?.radius_1km.households ?? 0}`, `${pop?.radius_1km.workers ?? 0}`],
    ['2km', `${pop?.radius_2km.residential ?? 0}`, `${pop?.radius_2km.households ?? 0}`, `${pop?.radius_2km.workers ?? 0}`],
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [tableCell('반경'), tableCell('주거인구'), tableCell('세대수'), tableCell('직장인구')],
      }),
      ...data.map(
        (row) =>
          new TableRow({
            children: row.map((value) => tableCell(value)),
          }),
      ),
    ],
  });
};

export const buildDocx = async (
  analysis: DbAnalysis,
  brand: DbBrand,
  reportSections: ReportSections,
  collectedData: CollectedData,
): Promise<Buffer> => {
  const today = new Date().toLocaleDateString('ko-KR');

  const content: Array<Paragraph | Table> = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new TextRun({ text: '상권 분석 보고서', bold: true, size: 48, font: FONT })],
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: brand.brand_name, size: 32, font: FONT })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: analysis.address, font: FONT })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: today, font: FONT })] }),
    p(''),
    p('목차', HeadingLevel.HEADING_1),
    ...SECTION_ORDER.map((section, index) => p(`${index + 1}. ${SECTION_LABELS[section]}`)),
  ];

  for (const section of SECTION_ORDER) {
    const body = reportSections[section] ?? '해당 섹션 데이터 없음';
    content.push(p(SECTION_LABELS[section], HeadingLevel.HEADING_2));
    content.push(...parseSectionParagraphs(body));
  }

  content.push(p('핵심 데이터 표', HeadingLevel.HEADING_1));
  content.push(p('경쟁점 요약', HeadingLevel.HEADING_2));
  content.push(buildCompetitorTable(collectedData));
  content.push(p('인구 요약', HeadingLevel.HEADING_2));
  content.push(buildPopulationTable(collectedData));

  const doc = new Document({
    sections: [{ children: content }],
  });

  return Packer.toBuffer(doc);
};
