import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

import { PwaRegister } from "@/components/pwa-register";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FranchiseScope | AI 상권분석 자동화",
  description:
    "프랜차이즈 본사를 위한 AI 상권분석 SaaS. 주소 하나로 30초 만에 전문가급 상권분석 보고서를 자동 생성하세요.",
  metadataBase: new URL("https://ai-scope.kr"),
  manifest: "/manifest.webmanifest",
  // iOS PWA
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FranchiseScope",
  },
  // Windows 타일
  applicationName: "FranchiseScope",
  openGraph: {
    title: "FranchiseScope | AI 상권분석 자동화",
    description:
      "주소 하나로 30초 만에 전문가급 상권분석 보고서를 자동 생성하세요.",
    url: "https://ai-scope.kr",
    siteName: "FranchiseScope",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FranchiseScope | AI 상권분석 자동화",
    description:
      "주소 하나로 30초 만에 전문가급 상권분석 보고서를 자동 생성하세요.",
  },
};

// theme-color, viewport 별도 export (Next.js 권장)
export const viewport: Viewport = {
  themeColor: "#1F4E79",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* ChunkLoadError 자동 복구: 배포 후 구버전 청크 404 → 1회 자동 새로고침 */}
      <Script id="chunk-error-recovery" strategy="beforeInteractive">{`
        (function() {
          var RELOAD_KEY = '__chunk_reload__';
          window.addEventListener('error', function(e) {
            var msg = (e.message || '') + ((e.filename || ''));
            if (msg.indexOf('Loading chunk') !== -1 || msg.indexOf('ChunkLoadError') !== -1 || (e.filename && e.filename.indexOf('/_next/static/chunks/') !== -1)) {
              if (!sessionStorage.getItem(RELOAD_KEY)) {
                sessionStorage.setItem(RELOAD_KEY, '1');
                window.location.reload();
              }
            }
          });
          window.addEventListener('unhandledrejection', function(e) {
            var msg = String((e.reason && e.reason.message) || e.reason || '');
            if (msg.indexOf('Loading chunk') !== -1 || msg.indexOf('ChunkLoadError') !== -1) {
              if (!sessionStorage.getItem(RELOAD_KEY)) {
                sessionStorage.setItem(RELOAD_KEY, '1');
                window.location.reload();
              }
            }
          });
        })();
      `}</Script>
      <Script
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&libraries=services,clusterer&autoload=false`}
        strategy="afterInteractive"
      />
      <body className="min-h-full flex flex-col bg-[#F8F9FA] text-foreground">
        {children}
        <Toaster />
        <PwaRegister />
      </body>
    </html>
  );
}
