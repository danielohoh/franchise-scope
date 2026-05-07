"use client";

import { Moon, Monitor, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeMode = "system" | "light" | "dark";

function getNextTheme(current: ThemeMode) {
  if (current === "system") return "light";
  if (current === "light") return "dark";
  return "system";
}

function getThemeLabel(theme: ThemeMode) {
  if (theme === "system") return "시스템";
  if (theme === "light") return "라이트";
  return "다크";
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const currentTheme = (theme ?? "system") as ThemeMode;
  const nextTheme = getNextTheme(currentTheme);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn("shrink-0", className)}
      onClick={() => setTheme(nextTheme)}
      aria-label={`테마 변경: ${getThemeLabel(currentTheme)} → ${getThemeLabel(nextTheme)}`}
      title={`테마: ${getThemeLabel(currentTheme)}`}
    >
      {currentTheme === "system" && <Monitor className="size-4" />}
      {currentTheme === "light" && <Sun className="size-4" />}
      {currentTheme === "dark" && <Moon className="size-4" />}
      <span className="sr-only">테마 변경</span>
    </Button>
  );
}
