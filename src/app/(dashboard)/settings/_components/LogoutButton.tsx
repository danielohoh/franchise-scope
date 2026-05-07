"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type LogoutButtonProps = {
  variant?: "secondary" | "outline" | "ghost";
};

export function LogoutButton({ variant = "secondary" }: LogoutButtonProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  return (
    <Button
      type="button"
      variant={variant}
      disabled={isLoggingOut}
      onClick={() => {
        void (async () => {
          try {
            setIsLoggingOut(true);
            const response = await fetch("/api/auth/logout", { method: "POST" });
            const json = (await response.json()) as { message?: string };

            if (!response.ok) {
              throw new Error(json.message ?? "로그아웃에 실패했습니다.");
            }

            window.location.assign("/auth/login");
          } catch (error) {
            console.error("[settings logout] failed", error);
            toast.error(error instanceof Error ? error.message : "로그아웃에 실패했습니다.");
          } finally {
            setIsLoggingOut(false);
          }
        })();
      }}
    >
      <LogOut className="size-4" />
      {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
    </Button>
  );
}
