"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { cn } from "@/lib/utils";

type BrandsGetResponse = {
  brand: { id: string } | null;
};

type ApiError = {
  message: string;
};

type MenuItem = {
  label: string;
  href: string;
  Icon: LucideIcon;
  gateKey: "brand" | "none";
};

const menuItems: ReadonlyArray<MenuItem> = [
  { label: "대시보드", href: "/dashboard", Icon: LayoutDashboard, gateKey: "brand" },
  { label: "브랜드관리", href: "/dashboard/brand", Icon: Building2, gateKey: "none" },
  { label: "예비창업자", href: "/dashboard/prospects", Icon: Users, gateKey: "brand" },
  { label: "보고서", href: "/dashboard/reports", Icon: FileText, gateKey: "brand" },
  { label: "AI 매물 추천", href: "/dashboard/recommend", Icon: MapPin, gateKey: "brand" },
  { label: "설정", href: "/dashboard/settings", Icon: Settings, gateKey: "brand" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationList({ hasBrand, onNavigate }: { hasBrand: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {menuItems.map(({ href, label, Icon, gateKey }) => {
        const active = isActivePath(pathname, href);

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
            onClick={(event) => {
              if (gateKey === "brand" && !hasBrand) {
                event.preventDefault();
                toast.error("브랜드 정보를 먼저 등록해주세요.");
                return;
              }

              onNavigate?.();
            }}
          >
            <Icon className={cn("size-4", active ? "text-primary-foreground" : "text-muted-foreground")} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function UserFooter({ userName }: { userName: string }) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  return (
    <div className="mt-auto border-t border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{userName}</p>
          <p className="text-xs text-muted-foreground">로그인됨</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={isLoggingOut}
          className="shrink-0"
          onClick={() => {
            void (async () => {
              try {
                setIsLoggingOut(true);
                const response = await fetch("/api/auth/logout", { method: "POST" });
                const json = (await response.json()) as { success?: boolean } | ApiError;

                if (!response.ok) {
                  const message = "message" in json ? json.message : "로그아웃에 실패했습니다.";
                  throw new Error(message);
                }

                router.refresh();
                window.location.assign("/auth/login");
              } catch (error) {
                console.error("[logout] failed", error);
                toast.error(error instanceof Error ? error.message : "로그아웃에 실패했습니다.");
              } finally {
                setIsLoggingOut(false);
              }
            })();
          }}
        >
          <LogOut className="size-4" />
          <span className="sr-only">로그아웃</span>
        </Button>
      </div>
    </div>
  );
}

export function DashboardSidebar({
  initialHasBrand,
  userName,
}: {
  initialHasBrand: boolean;
  userName: string;
}) {
  const [hasBrand, setHasBrand] = useState(initialHasBrand);

  // initialHasBrand prop이 변경될 때(router.refresh() 후) 즉시 반영
  useEffect(() => {
    setHasBrand(initialHasBrand);
  }, [initialHasBrand]);

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="px-4 py-5">
        <Link href="/dashboard" className="text-base font-semibold tracking-tight text-foreground">
          FranchiseScope
        </Link>
      </div>
      <div className="px-3 pb-4 flex flex-col gap-1">
        <NavigationList hasBrand={hasBrand} />
        <PwaInstallButton />
      </div>
      <UserFooter userName={userName} />
    </aside>
  );
}

export function DashboardMobileTopbar({
  initialHasBrand,
  userName,
}: {
  initialHasBrand: boolean;
  userName: string;
}) {
  const [hasBrand, setHasBrand] = useState(initialHasBrand);
  const [open, setOpen] = useState(false);

  // initialHasBrand prop이 변경될 때(router.refresh() 후) 즉시 반영
  useEffect(() => {
    setHasBrand(initialHasBrand);
  }, [initialHasBrand]);

  const title = useMemo(() => "FranchiseScope", []);

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/60 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-xl"
            />
          }
        >
          <Menu className="size-4" />
          <span className="sr-only">메뉴 열기</span>
        </SheetTrigger>
        <SheetContent side="left" className="p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="flex h-full flex-col">
            <div className="px-3 py-4 flex flex-col gap-1">
              <NavigationList hasBrand={hasBrand} onNavigate={() => setOpen(false)} />
              <PwaInstallButton />
            </div>
            <UserFooter userName={userName} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="w-8" />
    </header>
  );
}
