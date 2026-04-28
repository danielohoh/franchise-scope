"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type SectionCardProps = {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
  loading?: boolean;
  skeletonLines?: number;
};

export function SectionCard({
  title,
  subtitle,
  rightSlot,
  children,
  loading = false,
  skeletonLines = 3,
}: SectionCardProps) {
  const lines = Math.max(1, Math.min(12, Math.floor(skeletonLines)));

  return (
    <section className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: lines }).map((_, idx) => (
              <div
                // skeleton
                key={idx}
                className={cn(
                  "h-3 animate-pulse rounded bg-muted",
                  idx % 3 === 0 ? "w-11/12" : idx % 3 === 1 ? "w-10/12" : "w-9/12",
                )}
              />
            ))}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
