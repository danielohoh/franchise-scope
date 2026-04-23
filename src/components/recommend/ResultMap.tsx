"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { MatchedListing } from "@/types/recommend";

type KakaoMarker = {
  setMap: (map: unknown | null) => void;
  setImage?: (image: unknown) => void;
};

type KakaoMapsApi = {
  load: (callback: () => void) => void;
  LatLng: new (lat: number, lng: number) => unknown;
  Map: new (container: HTMLElement, options: { center: unknown; level: number }) => unknown;
  Marker: new (options: { map: unknown; position: unknown; title?: string; image?: unknown }) => KakaoMarker;
  MarkerImage: new (src: string, size: unknown, options?: { offset?: unknown }) => unknown;
  Size: new (width: number, height: number) => unknown;
  Point: new (x: number, y: number) => unknown;
  event: {
    addListener: (target: unknown, type: string, handler: () => void) => void;
  };
};

declare global {
  interface Window {
    kakao?: {
      maps: KakaoMapsApi;
    };
  }
}

const BLUE_MARKER_SRC = "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_blue.png";
const RED_MARKER_SRC = "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png";

export function ResultMap({
  listings,
  selectedId,
  onMarkerClick,
}: {
  listings: MatchedListing[];
  selectedId: string | null;
  onMarkerClick: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown | null>(null);
  const markersRef = useRef<Map<string, KakaoMarker>>(new Map());
  const markerImagesRef = useRef<{ blue: unknown; red: unknown } | null>(null);
  const [ready, setReady] = useState(false);

  const listingsWithCoords = useMemo(
    () => listings.filter((l) => l.latitude != null && l.longitude != null),
    [listings],
  );

  useEffect(() => {
    if (ready) return;
    const maps = window.kakao?.maps;
    const container = containerRef.current;
    if (!maps || !container) return;

    maps.load(() => {
      const center = new maps.LatLng(37.5665, 126.978);
      mapRef.current = new maps.Map(container, { center, level: 7 });

      const size = new maps.Size(24, 35);
      const offset = new maps.Point(12, 35);
      markerImagesRef.current = {
        blue: new maps.MarkerImage(BLUE_MARKER_SRC, size, { offset }),
        red: new maps.MarkerImage(RED_MARKER_SRC, size, { offset }),
      };

      setReady(true);
    });
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!maps || !map) return;

    // clear old markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current.clear();

    const images = markerImagesRef.current;

    listingsWithCoords.forEach((listing) => {
      const position = new maps.LatLng(listing.latitude as number, listing.longitude as number);
      const marker = new maps.Marker({
        map,
        position,
        title: listing.article_name ?? listing.building_name ?? listing.detail_address ?? undefined,
        image: images?.blue,
      });

      maps.event.addListener(marker, "click", () => onMarkerClick(listing.id));
      markersRef.current.set(listing.id, marker);
    });
  }, [listingsWithCoords, onMarkerClick, ready]);

  useEffect(() => {
    if (!ready) return;
    const images = markerImagesRef.current;
    if (!images) return;

    markersRef.current.forEach((marker, id) => {
      marker.setImage?.(id === selectedId ? images.red : images.blue);
    });
  }, [ready, selectedId]);

  if (listingsWithCoords.length === 0) {
    return (
      <div className="flex h-[420px] w-full items-center justify-center rounded-xl border border-border bg-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground">지도에 표시할 매물 위치가 없습니다</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-[420px] w-full rounded-xl border border-border bg-muted/10"
    />
  );
}
