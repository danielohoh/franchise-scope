import * as fs from "fs";
import * as readline from "readline";

import { haversineDistance } from "@/lib/utils/geo";
import { getRegionFilePaths } from "./region-mapping";
import type {
  CommercialAreaResult,
  CommercialAreaSearchParams,
  CommercialAreaType,
  CompetitionLevel,
  IndustryDistribution,
  ShopResult,
} from "./types";

// CSV 컬럼 인덱스 (0-based)
const COL = {
  SHOP_ID: 0,
  NAME: 1,
  BRANCH: 2,
  MAJOR_CODE: 3,
  MAJOR_NAME: 4,
  MID_CODE: 5,
  MID_NAME: 6,
  SUB_CODE: 7,
  SUB_NAME: 8,
  ROAD_ADDRESS: 31,
  LNG: 37,
  LAT: 38,
} as const;

// 반경 1km 에서의 위경도 델타 (한국 위도 기준 근사값)
// Δlat ≈ radiusM / 111_320m/deg
// Δlng ≈ radiusM / (111_320m/deg * cos(37.5°))
const LAT_METER = 111_320;
const LNG_METER_AT_KOREA = 111_320 * Math.cos((37.5 * Math.PI) / 180); // ≈ 88_515

/**
 * 인용 부호를 고려한 CSV 한 줄 파서.
 * 상호명에 쉼표가 포함된 경우(드물지만 존재)를 올바르게 처리한다.
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // 이스케이프된 따옴표
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  fields.push(current);
  return fields;
}

/**
 * 단일 CSV 파일을 스트림으로 읽어 반경 내 상가를 필터링한다.
 */
async function searchInFile(
  filePath: string,
  lat: number,
  lng: number,
  radiusM: number,
  industryMajor: string | undefined,
  industryMid: string | undefined,
  industrySub: string | undefined,
  limit: number,
  collected: ShopResult[],
): Promise<void> {
  if (!fs.existsSync(filePath)) {
    console.warn(`[csv-search] 파일 없음: ${filePath}`);
    return;
  }

  // 경도/위도 델타 (bbox 사전 필터용)
  const latDelta = radiusM / LAT_METER;
  const lngDelta = radiusM / LNG_METER_AT_KOREA;

  const latMin = lat - latDelta;
  const latMax = lat + latDelta;
  const lngMin = lng - lngDelta;
  const lngMax = lng + lngDelta;

  const fileStream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let isHeader = true;

  await new Promise<void>((resolve, reject) => {
    rl.on("line", (line) => {
      // 헤더 건너뜀
      if (isHeader) {
        isHeader = false;
        return;
      }

      if (collected.length >= limit) {
        rl.close();
        return;
      }

      if (!line.trim()) return;

      const fields = parseCSVLine(line);

      const rowLat = parseFloat(fields[COL.LAT] ?? "");
      const rowLng = parseFloat(fields[COL.LNG] ?? "");

      if (!Number.isFinite(rowLat) || !Number.isFinite(rowLng)) return;

      // 1차 bbox 필터 (하베르사인보다 빠름)
      if (rowLat < latMin || rowLat > latMax || rowLng < lngMin || rowLng > lngMax) return;

      // 업종 필터
      const majorName = fields[COL.MAJOR_NAME] ?? "";
      const midName = fields[COL.MID_NAME] ?? "";
      const subName = fields[COL.SUB_NAME] ?? "";

      if (industryMajor && !majorName.includes(industryMajor)) return;
      if (industryMid && !midName.includes(industryMid)) return;
      if (industrySub && !subName.includes(industrySub)) return;

      // 2차 하베르사인 정밀 필터
      const distanceM = haversineDistance(lat, lng, rowLat, rowLng);
      if (distanceM > radiusM) return;

      collected.push({
        shopId: fields[COL.SHOP_ID] ?? "",
        name: fields[COL.NAME] ?? "",
        branchName: fields[COL.BRANCH] ?? "",
        industryMajor: majorName,
        industryMid: midName,
        industrySub: subName,
        address: fields[COL.ROAD_ADDRESS] ?? "",
        lat: rowLat,
        lng: rowLng,
        distanceM: Math.round(distanceM),
      });
    });

    rl.on("close", resolve);
    rl.on("error", reject);
    fileStream.on("error", reject);
  });
}

/**
 * 업종 분포 계산 (대분류 기준)
 */
function computeIndustryDistribution(shops: ShopResult[]): IndustryDistribution[] {
  const counts = new Map<string, number>();

  for (const shop of shops) {
    const key = shop.industryMajor || "기타";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const total = shops.length || 1;

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({
      category,
      count,
      ratio: Math.round((count / total) * 1000) / 10, // 소수점 1자리 %
    }));
}

/**
 * 업종 분포로 상권 유형 분류
 */
function classifyCommercialAreaType(distribution: IndustryDistribution[]): CommercialAreaType {
  if (distribution.length === 0) return "혼합상권";

  const ratioMap = new Map(distribution.map((d) => [d.category, d.ratio]));

  const food = ratioMap.get("음식") ?? 0;
  const retail = ratioMap.get("소매") ?? 0;
  const realestate = ratioMap.get("부동산") ?? 0;
  const living = ratioMap.get("생활서비스") ?? 0;
  const education = ratioMap.get("학문/교육") ?? 0;
  const leisure = ratioMap.get("관광/여가/오락") ?? 0;
  const accommodation = ratioMap.get("숙박") ?? 0;

  if (leisure + accommodation > 20) return "관광상권";
  if (education > 20) return "학원상권";
  if (food + retail > 55) return "상업상권";
  if (realestate + living > 35) return "주거상권";

  return "혼합상권";
}

/**
 * 경쟁 밀도 계산
 */
function computeCompetitionDensity(
  totalShops: number,
  sameIndustryShops: number,
  radiusM: number,
): { score: number; level: CompetitionLevel; sameIndustryCount: number; totalShopCount: number } {
  // 반경 원의 면적 (km²)
  const areaSqKm = Math.PI * Math.pow(radiusM / 1000, 2);
  // 동종 업소 밀도 (개/km²)
  const density = areaSqKm > 0 ? sameIndustryShops / areaSqKm : 0;

  // 경험적 기준값 (한국 평균 밀도 근사)
  // 0~5개/km²: 낮음, 5~15: 보통, 15~30: 높음, 30+: 매우높음
  let score: number;
  let level: CompetitionLevel;

  if (density < 5) {
    score = Math.round((density / 5) * 25);
    level = "낮음";
  } else if (density < 15) {
    score = Math.round(25 + ((density - 5) / 10) * 25);
    level = "보통";
  } else if (density < 30) {
    score = Math.round(50 + ((density - 15) / 15) * 25);
    level = "높음";
  } else {
    score = Math.min(100, Math.round(75 + ((density - 30) / 20) * 25));
    level = "매우높음";
  }

  return { score, level, sameIndustryCount: sameIndustryShops, totalShopCount: totalShops };
}

/**
 * 위경도 반경 내 상가를 CSV에서 검색하여 상권 분석 결과를 반환한다.
 *
 * @param params - 검색 파라미터 (위경도, 반경, 업종 필터 등)
 * @returns 상권 분석 결과
 */
export async function searchShops(params: CommercialAreaSearchParams): Promise<CommercialAreaResult> {
  const { lat, lng, radiusM, industryMajor, industryMid, industrySub, limit = 100 } = params;

  const filePaths = getRegionFilePaths(lat, lng);

  // 파일별 순차 검색 (중복 shopId 방지를 위해 Set 사용)
  const seenIds = new Set<string>();
  const allShops: ShopResult[] = [];

  for (const filePath of filePaths) {
    const partialResults: ShopResult[] = [];

    await searchInFile(
      filePath,
      lat,
      lng,
      radiusM,
      industryMajor,
      industryMid,
      industrySub,
      limit,
      partialResults,
    );

    for (const shop of partialResults) {
      if (!seenIds.has(shop.shopId)) {
        seenIds.add(shop.shopId);
        allShops.push(shop);
      }
    }
  }

  // 거리순 정렬
  allShops.sort((a, b) => a.distanceM - b.distanceM);

  const industryDistribution = computeIndustryDistribution(allShops);
  const commercialAreaType = classifyCommercialAreaType(industryDistribution);

  // 동종 업소 수 (필터 없이 전체 검색한 경우 전체가 동종)
  const sameIndustryCount = industryMajor
    ? allShops.filter((s) => s.industryMajor.includes(industryMajor)).length
    : allShops.length;

  const competitionDensity = computeCompetitionDensity(allShops.length, sameIndustryCount, radiusM);

  return {
    shops: allShops.slice(0, limit),
    total: allShops.length,
    industryDistribution,
    commercialAreaType,
    competitionDensity,
    searchRadiusM: radiusM,
  };
}

/**
 * 업종명(브랜드 업종)을 CSV 대분류명으로 매핑한다.
 */
export function mapBrandIndustryToMajor(brandIndustry: string): string | undefined {
  const mapping: Record<string, string> = {
    치킨: "음식",
    카페: "음식",
    한식: "음식",
    분식: "음식",
    "피자·햄버거": "음식",
    편의점: "소매",
    서비스업: "생활서비스",
    기타: "음식",
  };
  return mapping[brandIndustry];
}

/**
 * 업종명을 CSV 중분류 키워드로 매핑한다.
 * CSV 실제값 기준: 카페→"비알코올", 치킨→"기타 간이", 한식→"한식", 분식→"분식", 편의점→"슈퍼"
 */
export function mapBrandIndustryToMid(brandIndustry: string): string | undefined {
  const mapping: Record<string, string | undefined> = {
    치킨: "기타 간이",
    카페: "비알코올",
    한식: "한식",
    분식: "분식",
    "피자·햄버거": "기타 간이",
    편의점: "슈퍼",
    서비스업: undefined,
    기타: undefined,
  };
  return mapping[brandIndustry];
}

/**
 * 업종명을 CSV 소분류 키워드로 매핑한다. (중분류보다 정밀)
 */
export function mapBrandIndustryToSub(brandIndustry: string): string | undefined {
  const mapping: Record<string, string | undefined> = {
    치킨: "치킨",
    카페: "카페",
    한식: "한식",
    분식: "분식",
    "피자·햄버거": "피자",
    편의점: "편의점",
    서비스업: undefined,
    기타: undefined,
  };
  return mapping[brandIndustry];
}
