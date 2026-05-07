"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { DbBrand } from "@/types/database";
import { BrandCard } from "@/components/brand/BrandCard";
import { BrandForm } from "@/components/brand/BrandForm";

type BrandManagementProps = {
  initialBrand: DbBrand | null;
};

export function BrandManagement({ initialBrand }: BrandManagementProps) {
  const router = useRouter();
  const [brand, setBrand] = useState<DbBrand | null>(initialBrand);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setBrand(initialBrand);
    setIsEditing(false);
  }, [initialBrand]);

  const modeTitle = useMemo(() => {
    if (!brand) return "브랜드 등록";
    if (isEditing) return "브랜드 수정";
    return "브랜드 정보";
  }, [brand, isEditing]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">{modeTitle}</h2>
          <p className="text-sm text-muted-foreground">
            필수 항목(브랜드명/법인명/업종)만 먼저 입력해도 저장할 수 있어요.
          </p>
        </div>
      </div>

      {brand ? (
        <BrandCard
          brand={brand}
          onEdit={() => setIsEditing(true)}
          onDelete={() => {
            void (async () => {
              const ok = window.confirm("브랜드 정보를 삭제할까요? 삭제 후 복구할 수 없습니다.");
              if (!ok) return;

              try {
                const response = await fetch(`/api/brands/${brand.id}`, { method: "DELETE" });
                const json = (await response.json()) as { success?: true; message?: string };

                if (!response.ok) {
                  throw new Error(json.message ?? "브랜드 정보를 삭제하지 못했습니다.");
                }

                toast.success("브랜드 정보를 삭제했습니다.");
                setBrand(null);
                setIsEditing(false);
                router.refresh();
              } catch (error) {
                console.error("[brand delete] failed", error);
                toast.error(error instanceof Error ? error.message : "브랜드 삭제에 실패했습니다.");
              }
            })();
          }}
        />
      ) : null}

      {brand && isEditing ? (
        <div className="flex items-center justify-end">
          <button
            type="button"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setIsEditing(false)}
          >
            수정 취소
          </button>
        </div>
      ) : null}

      {!brand || isEditing ? (
        <BrandForm
          brand={brand}
          onSuccess={() => {
            setIsEditing(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
