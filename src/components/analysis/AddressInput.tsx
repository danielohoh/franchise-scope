"use client";

import * as React from "react";
import { Loader2, MapPin, Search, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AddressInputProps = {
  value: string;
  onChangeAction: (address: string, lat: number, lng: number) => void;
  placeholder?: string;
};

type GeocodeResponse = {
  lat: number;
  lng: number;
  formattedAddress: string;
};

type ApiError = { error?: string; message?: string };

export function AddressInput({ value, onChangeAction, placeholder }: AddressInputProps) {
  const [text, setText] = React.useState(value);
  const [confirming, setConfirming] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState<GeocodeResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setText(value);
  }, [value]);

  const canConfirm = text.trim().length > 0 && !confirming;

  const confirmAddress = React.useCallback(async () => {
    const addr = text.trim();
    if (!addr) return;

    setConfirming(true);
    setError(null);

    try {
      const response = await fetch("/api/data/geocode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });

      let json: unknown = null;
      try {
        json = await response.json();
      } catch {
        // ignore
      }

      if (!response.ok) {
        const message =
          json && typeof json === "object" && json !== null && ("error" in json || "message" in json)
            ? (((json as ApiError).error ?? (json as ApiError).message) || "주소를 확인하지 못했습니다.")
            : "주소를 확인하지 못했습니다.";
        throw new Error(message);
      }

      const data = (json ?? {}) as GeocodeResponse;
      if (!Number.isFinite(data.lat) || !Number.isFinite(data.lng) || !data.formattedAddress) {
        throw new Error("주소를 확인하지 못했습니다.");
      }

      setConfirmed(data);
      onChangeAction(data.formattedAddress, data.lat, data.lng);
      toast.success("주소가 확인되었습니다.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "주소를 확인하지 못했습니다.";
      setConfirmed(null);
      setError(msg);
      toast.error(msg);
    } finally {
      setConfirming(false);
    }
  }, [onChangeAction, text]);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">주소 입력</p>
          <p className="text-sm text-muted-foreground">분석할 매장 후보지 주소를 입력하고 좌표를 확인하세요.</p>
        </div>

        {confirmed ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
            <MapPin className="size-3.5" />
            확인됨
          </div>
        ) : null}
      </div>

      <div className="mt-5 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={text}
              onChange={(e) => {
                setText(e.currentTarget.value);
                setConfirmed(null);
                setError(null);
              }}
              placeholder={placeholder ?? "예) 서울특별시 강남구 테헤란로 123"}
              className={cn(
                "h-10 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none transition",
                "focus:border-ring focus:ring-3 focus:ring-ring/20",
              )}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={!canConfirm}
            onClick={() => void confirmAddress()}
          >
            {confirming ? <Loader2 className="size-4 animate-spin" /> : null}
            주소 확인
          </Button>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <XCircle className="mt-0.5 size-4" />
            <p>{error}</p>
          </div>
        ) : null}

        {confirmed ? (
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
            <p className="font-medium text-foreground">{confirmed.formattedAddress}</p>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              좌표: {confirmed.lat.toFixed(6)}, {confirmed.lng.toFixed(6)}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">주소 확인 후 다음 단계로 진행할 수 있어요.</p>
        )}
      </div>
    </section>
  );
}
