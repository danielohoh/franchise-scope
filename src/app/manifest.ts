import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FranchiseScope | AI 상권분석",
    short_name: "FranchiseScope",
    description: "AI 기반 상권분석 보고서 자동 생성 — 주소 하나로 30초 만에 전문가급 보고서",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#1F4E79",
    lang: "ko",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icon",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    screenshots: [
      {
        src: "/screenshot-wide.png",
        sizes: "1280x720",
        form_factor: "wide",
        label: "FranchiseScope 대시보드",
      },
    ],
  };
}
