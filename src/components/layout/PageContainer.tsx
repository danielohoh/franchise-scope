"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PageContainerProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  backHref?: string;
};

export function PageContainer({
  children,
  title,
  description,
  action,
  backHref,
}: PageContainerProps) {
  return (
    <section className="space-y-6">
      {backHref ? (
        <div>
          <Link
            href={backHref}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "w-fit gap-2 rounded-xl"
            )}
          >
            <ArrowLeft className="size-4" />
            <span>뒤로</span>
          </Link>
        </div>
      ) : null}

      {title || description || action ? (
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title ? (
              <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
            ) : null}
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}

      <div>{children}</div>
    </section>
  );
}
