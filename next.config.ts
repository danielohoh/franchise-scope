import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack이 한국어 경로명을 처리하지 못하는 버그 회피 (Next.js 16 이슈)
  // Vercel 배포 시에는 자동으로 Webpack 사용
  turbopack: undefined,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "maps.gstatic.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  // docx, pdf-parse, mammoth 패키지를 서버사이드에서만 사용 (클라이언트 번들 제외)
  serverExternalPackages: ["docx", "pdf-parse", "mammoth"],
  webpack: (config) => {
    // pdf-parse가 내부적으로 canvas/encoding 을 require하는 문제 해결
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
      encoding: false,
    };
    return config;
  },
};

export default nextConfig;
