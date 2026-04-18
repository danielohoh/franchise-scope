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
  // docx 패키지를 서버사이드에서만 사용 (클라이언트 번들 제외)
  serverExternalPackages: ["docx"],
};

export default nextConfig;
