"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const profileEditSchema = z.object({
  name: z.string().trim().min(2).max(50),
  company_name: z.string().trim().max(100).optional(),
});

type ProfileEditFormValues = z.infer<typeof profileEditSchema>;

type ProfileApiResponse = {
  user: {
    name: string;
    company_name: string | null;
    phone: string;
  };
};

type ApiErrorResponse = {
  error?: string;
};

export function ProfileEditForm() {
  const [isLoading, setIsLoading] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileEditFormValues>({
    resolver: zodResolver(profileEditSchema),
    defaultValues: { name: "", company_name: "" },
  });

  const fieldClasses = useMemo(() => {
    return {
      label: "block text-sm font-medium text-foreground",
      hint: "text-xs font-normal text-muted-foreground",
      inputBase:
        "w-full rounded-xl border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
      error: "mt-1 text-xs text-destructive",
    };
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/auth/profile");
        if (!response.ok) {
          const json = (await response.json()) as ApiErrorResponse;
          throw new Error(json.error ?? "프로필을 불러오지 못했습니다.");
        }

        const data = (await response.json()) as ProfileApiResponse;
        reset({
          name: data.user.name,
          company_name: data.user.company_name ?? "",
        });
      } catch (error) {
        console.error("[settings profile] fetch failed", error);
        toast.error(
          error instanceof Error ? error.message : "프로필을 불러오지 못했습니다."
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, [reset]);

  const onSubmit = async (values: ProfileEditFormValues) => {
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const json = (await response.json()) as ApiErrorResponse;
        throw new Error(json.error ?? "저장에 실패했습니다.");
      }

      toast.success("프로필이 저장되었습니다.");
    } catch (error) {
      console.error("[settings profile] update failed", error);
      toast.error(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-base font-semibold">프로필</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            이름과 회사명을 수정할 수 있습니다.
          </p>
        </div>
      </div>

      <div className="mt-5">
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-11 w-full animate-pulse rounded-xl bg-muted" />
            <div className="h-11 w-full animate-pulse rounded-xl bg-muted" />
            <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <label className={fieldClasses.label}>
                이름 <span className="text-destructive">*</span>
              </label>
              <input
                {...register("name")}
                type="text"
                placeholder="홍길동"
                className={cn(
                  fieldClasses.inputBase,
                  "border-border focus-visible:border-ring",
                  errors.name
                    ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                    : null
                )}
                disabled={isSubmitting}
                aria-invalid={errors.name ? true : undefined}
              />
              {errors.name ? (
                <p className={fieldClasses.error}>
                  {errors.name.message ?? "이름은 2자 이상 50자 이하여야 합니다."}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label className={fieldClasses.label}>
                소속 회사명 <span className={fieldClasses.hint}>(선택)</span>
              </label>
              <input
                {...register("company_name")}
                type="text"
                placeholder="(주)프랜차이즈본사"
                className={cn(
                  fieldClasses.inputBase,
                  "border-border focus-visible:border-ring"
                )}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                저장 후 반영까지 잠시 시간이 걸릴 수 있습니다.
              </p>
              <Button type="submit" disabled={isSubmitting} className="rounded-xl">
                {isSubmitting ? "저장 중..." : "저장"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
