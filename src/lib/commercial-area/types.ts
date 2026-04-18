export interface ShopResult {
  shopId: string;
  name: string;
  branchName: string;
  industryMajor: string;
  industryMid: string;
  industrySub: string;
  address: string;
  lat: number;
  lng: number;
  distanceM: number;
}

export interface IndustryDistribution {
  category: string;
  count: number;
  ratio: number;
}

export type CommercialAreaType =
  | "상업상권"
  | "주거상권"
  | "오피스상권"
  | "학원상권"
  | "관광상권"
  | "혼합상권";

export type CompetitionLevel = "낮음" | "보통" | "높음" | "매우높음";

export interface CommercialAreaSearchParams {
  lat: number;
  lng: number;
  radiusM: number;
  industryMajor?: string;
  industryMid?: string;
  industrySub?: string;
  /** 반환할 최대 상가 수 (기본값 100) */
  limit?: number;
}

export interface CommercialAreaResult {
  shops: ShopResult[];
  total: number;
  industryDistribution: IndustryDistribution[];
  commercialAreaType: CommercialAreaType;
  competitionDensity: {
    score: number;
    level: CompetitionLevel;
    sameIndustryCount: number;
    totalShopCount: number;
  };
  searchRadiusM: number;
}
