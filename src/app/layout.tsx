import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F8F9FA] text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
