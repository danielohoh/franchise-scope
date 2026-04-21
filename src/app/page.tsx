"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  MapPin,
  FileText,
  TrendingUp,
  BarChart3,
  Building2,
  Users,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  ArrowRight,
  Zap,
  Clock,
  Download,
  Target,
  Shield,
  Star,
  BrainCircuit,
  Map,
} from "lucide-react";

/* ────────────────────────────────────────────
   Static data
──────────────────────────────────────────── */

const FEATURES = [
  {
    icon: BrainCircuit,
    title: "AI 자동 상권분석",
    description:
      "주소 입력 즉시 AI가 배후인구, 유동인구, 업종 통계를 자동 수집하고 분석합니다.",
    gradient: "from-blue-500 to-[#1F4E79]",
  },
  {
    icon: Map,
    title: "경쟁점 실시간 분석",
    description:
      "카카오맵 기반으로 반경 1km 내 동종업종을 자동 탐색하고 위험도를 평가합니다.",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    icon: TrendingUp,
    title: "매출 시뮬레이션",
    description:
      "보수적·기본·낙관적 3가지 시나리오로 예상 매출과 손익을 자동 계산합니다.",
    gradient: "from-amber-500 to-orange-500",
  },
  {
    icon: Download,
    title: "자동 docx 보고서 생성",
    description:
      "A4 한 장 분량의 전문적인 상권분석 보고서를 Word 파일로 즉시 다운로드할 수 있습니다.",
    gradient: "from-purple-500 to-violet-600",
  },
  {
    icon: BarChart3,
    title: "SWOT 분석",
    description:
      "AI가 강점·약점·기회·위협을 4분면으로 시각화하여 입지의 전략적 판단을 돕습니다.",
    gradient: "from-rose-500 to-pink-500",
  },
  {
    icon: Shield,
    title: "위험 자동 감지",
    description:
      "동일 건물이나 50m 이내 경쟁점 발견 시 자동으로 경고를 표시하고 반려 처리합니다.",
    gradient: "from-slate-600 to-slate-800",
  },
];

const STEPS = [
  {
    step: "01",
    icon: MapPin,
    title: "주소 입력",
    description:
      "예비 창업자의 희망 입지 주소를 입력합니다. 구글 자동완성으로 빠르게 찾을 수 있습니다.",
    iconBg: "bg-blue-50 text-[#1F4E79]",
  },
  {
    step: "02",
    icon: BrainCircuit,
    title: "AI 자동 분석",
    description:
      "AI가 소상공인 공공데이터, 카카오맵, 경쟁점 정보를 자동 수집하고 분석합니다. 약 30초 소요.",
    iconBg: "bg-emerald-50 text-emerald-600",
  },
  {
    step: "03",
    icon: FileText,
    title: "보고서 다운로드",
    description:
      "완성된 보고서를 웹에서 확인하고 Word(.docx) 파일로 즉시 다운로드하세요.",
    iconBg: "bg-purple-50 text-purple-600",
  },
];

const FAQS = [
  {
    q: "정말 무료인가요?",
    a: "네, 현재 MVP 기간 동안 FranchiseScope의 모든 기능을 완전 무료로 이용하실 수 있습니다. 향후 유료 플랜이 도입되더라도 기존 사용자에 대한 별도 안내가 사전에 제공됩니다.",
  },
  {
    q: "보고서 생성에 얼마나 걸리나요?",
    a: "일반적으로 30초~2분 이내에 완료됩니다. 주소 지오코딩, 공공데이터 수집, Google Places 경쟁점 분석, AI 보고서 작성, docx 파일 생성까지 모든 과정이 자동으로 진행됩니다.",
  },
  {
    q: "어떤 업종을 지원하나요?",
    a: "치킨, 카페, 한식, 분식, 피자·햄버거, 편의점, 서비스업 등 7개 이상의 업종을 지원합니다. 각 업종별로 최적화된 분석 기준이 적용됩니다.",
  },
  {
    q: "상권 데이터는 어디서 가져오나요?",
    a: "소상공인시장진흥공단 공공데이터(배후인구, 유동인구, 업종통계), 카카오 로컬 API(경쟁점 현황, 주소–위경도 변환)를 활용합니다.",
  },
  {
    q: "생성된 보고서에는 어떤 내용이 포함되나요?",
    a: "입지 기본정보, 배후인구·유동인구 분석, 경쟁점 현황(지도 포함), 매출 시뮬레이션(3시나리오), 초기 투자비용 및 ROI, SWOT 분석, 종합 평가 및 추천 의견이 포함됩니다.",
  },
  {
    q: "내 데이터는 안전한가요?",
    a: "모든 데이터는 Supabase(PostgreSQL)에 암호화되어 저장되며, Row Level Security 정책에 의해 본인의 데이터만 접근 가능합니다. 다른 회사의 데이터는 절대 접근할 수 없습니다.",
  },
];

/* ────────────────────────────────────────────
   Component
──────────────────────────────────────────── */

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* ═══════════════════════════════════════
          NAVBAR
      ═══════════════════════════════════════ */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 bg-[#1F4E79] rounded-xl flex items-center justify-center">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <span
              className={`font-bold text-lg transition-colors ${
                scrolled ? "text-[#1F4E79]" : "text-white"
              }`}
            >
              FranchiseScope
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-7">
            {[
              { href: "#features", label: "기능" },
              { href: "#how-it-works", label: "사용방법" },
              { href: "#pricing", label: "요금제" },
              { href: "#faq", label: "FAQ" },
            ].map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className={`text-sm font-medium transition-colors hover:opacity-70 ${
                  scrolled ? "text-slate-700" : "text-white/80 hover:text-white"
                }`}
              >
                {label}
              </a>
            ))}
          </div>

          {/* Auth buttons */}
          <div className="flex items-center gap-2">
            <Link
              href="/auth/login"
              className={`hidden md:block text-sm font-medium px-4 py-2 rounded-xl transition-colors ${
                scrolled
                  ? "text-slate-700 hover:bg-slate-100"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              로그인
            </Link>
            <Link
              href="/auth/signup"
              className={`text-sm font-semibold px-5 py-2 rounded-xl transition-all ${
                scrolled
                  ? "bg-[#1F4E79] text-white hover:bg-[#0D2B45]"
                  : "bg-white text-[#1F4E79] hover:bg-slate-50 shadow-lg"
              }`}
            >
              무료로 시작하기
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════
          HERO
      ═══════════════════════════════════════ */}
      <section className="relative min-h-[92vh] flex items-center bg-gradient-to-br from-[#071828] via-[#0D2B45] to-[#1F4E79] overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-60 -right-60 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-40 w-[400px] h-[400px] bg-sky-300/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 right-1/4 w-[300px] h-[300px] bg-indigo-400/10 rounded-full blur-2xl" />
        </div>

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-24">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 mb-8">
              <Zap className="w-3.5 h-3.5 text-yellow-300" />
              <span className="text-xs text-white/90 font-semibold tracking-wide">
                프랜차이즈 본사 전용 AI SaaS
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-[72px] font-black text-white leading-[1.1] tracking-tight mb-6">
              주소 하나로
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-blue-200 to-white">
                완성되는
              </span>
              <br />
              AI 상권분석
            </h1>

            {/* Sub */}
            <p className="text-lg sm:text-xl text-white/65 mb-10 max-w-lg leading-relaxed">
              예비 창업자의 희망 입지를 입력하면
              <br className="hidden sm:block" />
              AI가 상권 데이터를 자동 분석하고
              <br className="hidden sm:block" />
              전문가급 보고서를{" "}
              <span className="text-white font-semibold">30초</span> 만에
              생성합니다.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-[#1F4E79] font-bold text-base rounded-2xl hover:bg-slate-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
              >
                지금 무료로 시작하기
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-white font-semibold text-base rounded-2xl border border-white/20 bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all"
              >
                기능 살펴보기
                <ChevronDown className="w-4 h-4" />
              </a>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-10 mt-14 pt-10 border-t border-white/10">
              {[
                { value: "30초", label: "평균 보고서 생성 시간" },
                { value: "7+", label: "지원 업종" },
                { value: "무료", label: "현재 모든 기능" },
              ].map(({ value, label }) => (
                <div key={label} className="flex flex-col">
                  <span className="text-3xl font-black text-white">{value}</span>
                  <span className="text-sm text-white/45 mt-0.5">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          TARGET CUSTOMERS
      ═══════════════════════════════════════ */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-[#1F4E79]/10 text-[#1F4E79] rounded-full px-4 py-2 text-sm font-semibold mb-5">
              <Target className="w-4 h-4" />
              누구를 위한 서비스인가요
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
              이런 분들을 위해
              <br />
              만들었습니다
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: Building2,
                title: "프랜차이즈 본사\n상권개발팀",
                description:
                  "가맹점 후보 입지를 빠르게 검토하고, 데이터 기반 의사결정으로 개설 성공률을 높이세요.",
                bg: "bg-blue-50",
                iconBg: "bg-[#1F4E79] text-white",
              },
              {
                icon: Users,
                title: "가맹영업팀\n담당자",
                description:
                  "예비 창업자 상담 시 전문 보고서를 제시하여 계약 성사율과 고객 신뢰도를 높이세요.",
                bg: "bg-emerald-50",
                iconBg: "bg-emerald-600 text-white",
              },
              {
                icon: Star,
                title: "소규모 프랜차이즈\n대표",
                description:
                  "고가의 상권분석 컨설팅 없이도 AI로 전문가 수준의 분석을 직접 수행하세요.",
                bg: "bg-purple-50",
                iconBg: "bg-purple-600 text-white",
              },
            ].map(({ icon: Icon, title, description, bg, iconBg }) => (
              <div
                key={title}
                className={`${bg} rounded-3xl p-8 hover:shadow-md transition-shadow`}
              >
                <div
                  className={`w-14 h-14 ${iconBg} rounded-2xl flex items-center justify-center mb-6`}
                >
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3 whitespace-pre-line">
                  {title}
                </h3>
                <p className="text-slate-600 leading-relaxed text-sm">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FEATURES
      ═══════════════════════════════════════ */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-[#1F4E79]/10 text-[#1F4E79] rounded-full px-4 py-2 text-sm font-semibold mb-5">
              <Zap className="w-4 h-4" />
              핵심 기능
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
              강력한 기능,
              <br />
              단순한 사용법
            </h2>
            <p className="text-slate-500 mt-4 text-lg max-w-xl mx-auto">
              복잡한 설정 없이 주소 하나만으로 전문가 수준의 상권분석을
              시작하세요.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, description, gradient }) => (
              <div
                key={title}
                className="group bg-white border border-slate-100 rounded-3xl p-7 hover:border-slate-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-default"
              >
                <div
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white mb-5`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          HOW IT WORKS
      ═══════════════════════════════════════ */}
      <section id="how-it-works" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-[#1F4E79]/10 text-[#1F4E79] rounded-full px-4 py-2 text-sm font-semibold mb-5">
              <Clock className="w-4 h-4" />
              사용 방법
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
              3단계로 완성되는
              <br />
              전문가급 보고서
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map(({ step, icon: Icon, title, description, iconBg }, i) => (
              <div key={step} className="relative">
                <div className="bg-white rounded-3xl p-8 text-center border border-slate-100 hover:shadow-lg transition-shadow">
                  <div className="text-[80px] font-black text-slate-100 leading-none mb-4 select-none">
                    {step}
                  </div>
                  <div
                    className={`w-16 h-16 ${iconBg} rounded-2xl flex items-center justify-center mx-auto mb-5`}
                  >
                    <Icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
                </div>
                {i < 2 && (
                  <div className="hidden md:flex absolute top-[7rem] -right-3 z-10 items-center">
                    <div className="w-5 h-px bg-slate-200" />
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          APP PREVIEW (MOCK SCREENSHOT)
      ═══════════════════════════════════════ */}
      <section className="py-24 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-[#1F4E79]/10 text-[#1F4E79] rounded-full px-4 py-2 text-sm font-semibold mb-5">
              <FileText className="w-4 h-4" />
              실제 화면
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
              직관적인 대시보드로
              <br />
              한눈에 관리하세요
            </h2>
          </div>

          {/* Browser mockup */}
          <div className="max-w-5xl mx-auto bg-gradient-to-br from-[#071828] to-[#1F4E79] rounded-[2rem] p-1.5 shadow-2xl">
            <div className="bg-[#0D1F2D] rounded-[1.6rem] p-4">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
                  <div className="w-3 h-3 rounded-full bg-green-400/50" />
                </div>
                <div className="flex-1 bg-white/8 rounded-lg h-7 flex items-center px-3 ml-2">
                  <span className="text-white/30 text-xs">
                    ai-scope.kr/dashboard
                  </span>
                </div>
              </div>

              {/* App UI */}
              <div className="bg-[#F8F9FA] rounded-xl overflow-hidden">
                <div className="flex h-72 sm:h-80">
                  {/* Sidebar */}
                  <div className="hidden sm:flex w-44 bg-white border-r border-slate-100 flex-col p-3">
                    <div className="flex items-center gap-1.5 mb-5 px-1">
                      <div className="w-5 h-5 bg-[#1F4E79] rounded-md flex-shrink-0" />
                      <span className="text-[10px] font-black text-[#1F4E79]">
                        FranchiseScope
                      </span>
                    </div>
                    {[
                      { label: "대시보드", active: true },
                      { label: "브랜드관리", active: false },
                      { label: "예비창업자", active: false },
                      { label: "보고서", active: false },
                      { label: "설정", active: false },
                    ].map(({ label, active }) => (
                      <div
                        key={label}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-0.5 ${
                          active
                            ? "bg-[#1F4E79] text-white"
                            : "text-slate-500"
                        }`}
                      >
                        <div
                          className={`w-2.5 h-2.5 rounded ${
                            active ? "bg-white/30" : "bg-slate-200"
                          }`}
                        />
                        <span className="text-[11px] font-medium">{label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Main content */}
                  <div className="flex-1 p-4 overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-slate-800 text-sm">
                        대시보드
                      </span>
                      <div className="bg-[#1F4E79] text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg">
                        + 새 보고서 생성
                      </div>
                    </div>

                    {/* KPI cards */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {[
                        {
                          label: "총 보고서",
                          value: "24",
                          numColor: "text-[#1F4E79]",
                        },
                        {
                          label: "이번달",
                          value: "8",
                          numColor: "text-emerald-600",
                        },
                        {
                          label: "평균 점수",
                          value: "76점",
                          numColor: "text-purple-600",
                        },
                        {
                          label: "예비창업자",
                          value: "12명",
                          numColor: "text-amber-600",
                        },
                      ].map(({ label, value, numColor }) => (
                        <div
                          key={label}
                          className="bg-white rounded-xl p-2.5 border border-slate-100"
                        >
                          <div
                            className={`text-base font-black ${numColor}`}
                          >
                            {value}
                          </div>
                          <div className="text-[9px] text-slate-400 mt-0.5">
                            {label}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Recent reports */}
                    <div className="bg-white rounded-xl p-3 border border-slate-100">
                      <div className="text-[11px] font-semibold text-slate-700 mb-2 flex items-center justify-between">
                        <span>최근 보고서</span>
                        <span className="text-[#1F4E79] text-[10px]">
                          전체 보기 →
                        </span>
                      </div>
                      {[
                        {
                          name: "강남구 역삼동 ○○치킨",
                          score: "82점",
                          status: "적극추천",
                          badgeClass: "text-emerald-600 bg-emerald-50",
                        },
                        {
                          name: "마포구 합정동 ○○카페",
                          score: "71점",
                          status: "조건부추천",
                          badgeClass: "text-amber-600 bg-amber-50",
                        },
                        {
                          name: "서초구 방배동 ○○한식",
                          score: "58점",
                          status: "재검토필요",
                          badgeClass: "text-orange-500 bg-orange-50",
                        },
                      ].map(({ name, score, status, badgeClass }) => (
                        <div
                          key={name}
                          className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0"
                        >
                          <span className="text-[11px] text-slate-600 truncate mr-2">
                            {name}
                          </span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[11px] font-bold text-slate-700">
                              {score}
                            </span>
                            <span
                              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${badgeClass}`}
                            >
                              {status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Highlights below screenshot */}
          <div className="grid sm:grid-cols-3 gap-4 mt-8 max-w-3xl mx-auto">
            {[
              { icon: CheckCircle, text: "실시간 진행 상태 표시" },
              { icon: Download, text: "Word 파일 즉시 다운로드" },
              { icon: BarChart3, text: "시각화된 분석 결과" },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl"
              >
                <Icon className="w-5 h-5 text-[#1F4E79] flex-shrink-0" />
                <span className="text-sm font-medium text-slate-700">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          PRICING
      ═══════════════════════════════════════ */}
      <section id="pricing" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-[#1F4E79]/10 text-[#1F4E79] rounded-full px-4 py-2 text-sm font-semibold mb-5">
              <Star className="w-4 h-4" />
              요금제
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
              지금은 완전 무료
            </h2>
            <p className="text-slate-500 mt-4 text-lg">
              MVP 기간 동안 모든 기능을 무료로 이용하세요.
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <div className="relative bg-gradient-to-br from-[#1F4E79] to-[#071828] rounded-3xl p-8 text-white overflow-hidden shadow-2xl">
              {/* Blobs */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full translate-x-12 -translate-y-12 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-36 h-36 bg-white/5 rounded-full -translate-x-8 translate-y-8 pointer-events-none" />

              <div className="relative">
                <div className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-xs font-semibold mb-6">
                  <Zap className="w-3 h-3 text-yellow-300" />
                  FREE PLAN
                </div>

                <div className="mb-7">
                  <div className="text-6xl font-black tracking-tight">₩0</div>
                  <div className="text-white/50 text-sm mt-1.5">
                    완전 무료 · 신용카드 불필요
                  </div>
                </div>

                <div className="space-y-3 mb-8">
                  {[
                    "무제한 보고서 생성",
                    "AI 상권분석 자동화",
                    "경쟁점 지도 시각화",
                    "매출 시뮬레이션 (3시나리오)",
                    "SWOT 분석",
                    "Word(.docx) 보고서 다운로드",
                    "예비 창업자 관리",
                    "브랜드 정보 관리",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-300 flex-shrink-0" />
                      <span className="text-sm text-white/85">{item}</span>
                    </div>
                  ))}
                </div>

                <Link
                  href="/auth/signup"
                  className="block text-center bg-white text-[#1F4E79] font-bold py-4 rounded-2xl hover:bg-slate-50 transition-colors text-base"
                >
                  지금 무료로 시작하기
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FAQ
      ═══════════════════════════════════════ */}
      <section id="faq" className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-[#1F4E79]/10 text-[#1F4E79] rounded-full px-4 py-2 text-sm font-semibold mb-5">
              FAQ
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
              자주 묻는 질문
            </h2>
          </div>

          <div className="space-y-2">
            {FAQS.map(({ q, a }, i) => (
              <div
                key={q}
                className="border border-slate-100 rounded-2xl overflow-hidden bg-white"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="font-semibold text-slate-900 text-sm sm:text-base pr-4">
                    {q}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-200 ${
                      openFaq === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-slate-600 text-sm leading-relaxed border-t border-slate-100 pt-4">
                    {a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FINAL CTA
      ═══════════════════════════════════════ */}
      <section className="py-28 bg-gradient-to-br from-[#071828] via-[#0D2B45] to-[#1F4E79] overflow-hidden relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-sm font-semibold text-white/80 mb-8">
            <Zap className="w-4 h-4 text-yellow-300" />
            지금 바로 시작하세요
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-[56px] font-black text-white leading-tight tracking-tight mb-6">
            가입 후 5분 안에
            <br />
            첫 보고서를 생성할 수 있습니다
          </h2>
          <p className="text-xl text-white/55 mb-10 max-w-xl mx-auto leading-relaxed">
            복잡한 설정 없이 바로 시작하세요.
            <br />
            주소 하나만으로 AI가 전부 처리합니다.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-3 px-10 py-5 bg-white text-[#1F4E79] font-black text-lg rounded-2xl hover:bg-slate-50 transition-all shadow-2xl hover:-translate-y-1"
          >
            무료로 시작하기
            <ArrowRight className="w-6 h-6" />
          </Link>
          <p className="text-white/30 text-sm mt-6">
            신용카드 불필요 · 즉시 시작 · 완전 무료
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════ */}
      <footer className="bg-[#060F17] text-white/40 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start gap-10 mb-10">
            {/* Brand */}
            <div className="max-w-xs">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 bg-[#1F4E79] rounded-xl flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-base text-white">
                  FranchiseScope
                </span>
              </div>
              <p className="text-sm leading-relaxed">
                프랜차이즈 본사를 위한
                <br />
                AI 상권분석 자동화 서비스
              </p>
            </div>

            {/* Links */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-10 text-sm">
              <div>
                <div className="font-semibold text-white/70 mb-3">서비스</div>
                {[
                  { label: "기능 소개", href: "#features" },
                  { label: "사용 방법", href: "#how-it-works" },
                  { label: "요금제", href: "#pricing" },
                  { label: "FAQ", href: "#faq" },
                ].map(({ label, href }) => (
                  <a
                    key={label}
                    href={href}
                    className="block mt-2 hover:text-white/70 transition-colors"
                  >
                    {label}
                  </a>
                ))}
              </div>
              <div>
                <div className="font-semibold text-white/70 mb-3">계정</div>
                {[
                  { label: "로그인", href: "/auth/login" },
                  { label: "회원가입", href: "/auth/signup" },
                  { label: "대시보드", href: "/dashboard" },
                ].map(({ label, href }) => (
                  <Link
                    key={label}
                    href={href}
                    className="block mt-2 hover:text-white/70 transition-colors"
                  >
                    {label}
                  </Link>
                ))}
              </div>
              <div>
                <div className="font-semibold text-white/70 mb-3">기술 스택</div>
                {["Next.js 16", "Supabase", "Groq AI", "카카오맵"].map(
                  (item) => (
                    <div key={item} className="mt-2">
                      {item}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 pt-6 text-center text-xs">
            © 2024 FranchiseScope. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
