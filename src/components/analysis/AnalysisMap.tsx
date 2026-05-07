"use client";

import * as React from "react";
import { APIProvider, AdvancedMarker, InfoWindow, Map, useMap } from "@vis.gl/react-google-maps";
import { AlertTriangle, MapPin } from "lucide-react";

import type { CompetitorInfo } from "@/types/analysis";
import { cn } from "@/lib/utils";

type AnalysisMapProps = {
  lat: number;
  lng: number;
  competitors: CompetitorInfo[];
  brandName: string;
};

type ErrorBoundaryProps = { children: React.ReactNode; fallback?: React.ReactNode };
type ErrorBoundaryState = { hasError: boolean; message: string | null };

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, message: error instanceof Error ? error.message : "지도 렌더링에 실패했습니다." };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error("[AnalysisMap] render error", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-600/20 bg-amber-500/10 p-4 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 size-4" />
            <p>{this.state.message ?? "지도를 표시할 수 없습니다."}</p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

function CircleOverlay({ center, radiusM }: { center: google.maps.LatLngLiteral; radiusM: number }) {
  const map = useMap();

  React.useEffect(() => {
    if (!map) return;
    if (!window.google?.maps) return;

    const primary = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#1f4e79";

    const circle = new google.maps.Circle({
      center,
      radius: radiusM,
      strokeColor: primary,
      strokeOpacity: 0.6,
      strokeWeight: 2,
      fillColor: primary,
      fillOpacity: 0.08,
      map,
    });

    return () => {
      circle.setMap(null);
    };
  }, [center, map, radiusM]);

  return null;
}

function PinDot({ tone }: { tone: "target" | "franchise" | "indie" }) {
  return (
    <div
      className={cn(
        "grid place-items-center rounded-full ring-1 shadow-sm",
        tone === "target"
          ? "size-10 bg-rose-600 text-white ring-rose-700/20"
          : tone === "franchise"
            ? "size-9 bg-sky-600 text-white ring-sky-700/20"
            : "size-9 bg-zinc-700 text-white ring-zinc-800/20",
      )}
    >
      <MapPin className={cn(tone === "target" ? "size-5" : "size-4")} />
    </div>
  );
}

export function AnalysisMap({ lat, lng, competitors, brandName }: AnalysisMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [selected, setSelected] = React.useState<CompetitorInfo | null>(null);

  if (!apiKey) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">지도</p>
          <p className="text-sm text-muted-foreground">
            NEXT_PUBLIC_GOOGLE_MAPS_API_KEY가 설정되지 않아 지도 대신 경쟁점 목록을 표시합니다.
          </p>
        </div>
        <div className="mt-5 overflow-hidden rounded-xl border border-border bg-background/40">
          <ul className="divide-y divide-border text-sm">
            {competitors.length === 0 ? (
              <li className="p-4 text-muted-foreground">표시할 경쟁점이 없습니다.</li>
            ) : (
              competitors.slice(0, 20).map((c) => (
                <li key={c.place_id} className="p-4">
                  <p className="font-semibold text-foreground">{c.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.type} · {Math.round(c.distance_m)}m
                    {typeof c.rating === "number" ? ` · ★${c.rating}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{c.address}</p>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    );
  }

  const center = { lat, lng };

  return (
    <ErrorBoundary>
      <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">경쟁점 지도</p>
          <p className="text-sm text-muted-foreground">반경 500m 내 경쟁점을 확인하세요. (브랜드: {brandName})</p>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-background">
          <APIProvider apiKey={apiKey}>
            <Map
              defaultCenter={center}
              defaultZoom={16}
              gestureHandling="greedy"
              disableDefaultUI
              className="h-[360px] w-full"
            >
              <CircleOverlay center={center} radiusM={500} />

              <AdvancedMarker position={center} onClick={() => setSelected(null)}>
                <PinDot tone="target" />
              </AdvancedMarker>

              {competitors.map((c) => (
                <AdvancedMarker
                  key={c.place_id}
                  position={{ lat: c.lat, lng: c.lng }}
                  onClick={() => setSelected(c)}
                >
                  <PinDot tone={c.type === "프랜차이즈" ? "franchise" : "indie"} />
                </AdvancedMarker>
              ))}

              {selected ? (
                <InfoWindow
                  position={{ lat: selected.lat, lng: selected.lng }}
                  onCloseClick={() => setSelected(null)}
                >
                  <div className="min-w-[220px]">
                    <p className="text-sm font-semibold">{selected.name}</p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {selected.type} · {Math.round(selected.distance_m)}m
                      {typeof selected.rating === "number" ? ` · ★${selected.rating}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">{selected.address}</p>
                  </div>
                </InfoWindow>
              ) : null}
            </Map>
          </APIProvider>
        </div>
      </section>
    </ErrorBoundary>
  );
}
