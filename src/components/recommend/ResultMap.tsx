"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { MatchedListing } from "@/types/recommend";

type KakaoMarker = {
  setMap: (map: unknown | null) => void;
  setImage?: (image: unknown) => void;
  getPosition: () => unknown;
};

type KakaoMap = {
  setBounds: (bounds: unknown, pt?: number, pr?: number, pb?: number, pl?: number) => void;
};

type KakaoMapsApi = {
  load: (callback: () => void) => void;
  LatLng: new (lat: number, lng: number) => unknown;
  LatLngBounds: new () => { extend: (latlng: unknown) => void };
  Map: new (container: HTMLElement, options: { center: unknown; level: number }) => KakaoMap;
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
    kakao?: { maps: KakaoMapsApi };
  }
}

// 인라인 SVG base64 마커 (외부 URL 의존 없음)
const BLUE_MARKER_SRC =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCA0MCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjQwIj48cGF0aCBkPSJNMTIgMEM1LjM3IDAgMCA1LjM3IDAgMTJjMCA2LjYzIDEyIDI4IDEyIDI4UzI0IDE4LjYzIDI0IDEyQzI0IDUuMzcgMTguNjMgMCAxMiAweiIgZmlsbD0iIzNCODJGNiIvPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjUiIGZpbGw9IndoaXRlIi8+PC9zdmc+";
const RED_MARKER_SRC =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCA0MCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjQwIj48cGF0aCBkPSJNMTIgMEM1LjM3IDAgMCA1LjM3IDAgMTJjMCA2LjYzIDEyIDI4IDEyIDI4UzI0IDE4LjYzIDI0IDEyQzI0IDUuMzcgMTguNjMgMCAxMiAweiIgZmlsbD0iI0VGNDQ0NCIvPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjUiIGZpbGw9IndoaXRlIi8+PC9zdmc+";

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
  const mapRef = useRef<KakaoMap | null>(null);
  const markersRef = useRef<Map<string, KakaoMarker>>(new Map());
  const markerImagesRef = useRef<{ blue: unknown; red: unknown } | null>(null);
  const [ready, setReady] = useState(false);

  // 항상 최신 selectedId를 effect 안에서 참조하기 위한 ref
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const listingsWithCoords = useMemo(
    () => listings.filter((l) => l.latitude != null && l.longitude != null),
    [listings],
  );

  // 1. 지도 초기화
  useEffect(() => {
    if (ready) return;
    const container = containerRef.current;
    if (!container) return;

    const initMap = () => {
      const maps = window.kakao?.maps;
      if (!maps || !container) return false;

      maps.load(() => {
        const center = new maps.LatLng(37.5665, 126.978);
        mapRef.current = new maps.Map(container, { center, level: 7 });

        const size = new maps.Size(24, 40);
        const offset = new maps.Point(12, 40);
        markerImagesRef.current = {
          blue: new maps.MarkerImage(BLUE_MARKER_SRC, size, { offset }),
          red: new maps.MarkerImage(RED_MARKER_SRC, size, { offset }),
        };

        setReady(true);
      });
      return true;
    };

    if (initMap()) return;

    const pollId = setInterval(() => {
      if (initMap()) clearInterval(pollId);
    }, 150);

    return () => clearInterval(pollId);
  }, [ready]);

  // 2. 마커 생성 + 지도 자동 중심 이동
  useEffect(() => {
    if (!ready) return;
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!maps || !map) return;

    // 기존 마커 제거
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current.clear();

    const images = markerImagesRef.current;
    const currentSelectedId = selectedIdRef.current;

    listingsWithCoords.forEach((listing) => {
      const position = new maps.LatLng(
        listing.latitude as number,
        listing.longitude as number,
      );
      const isSelected = listing.id === currentSelectedId;
      const marker = new maps.Marker({
        map,
        position,
        title:
          listing.article_name ??
          listing.building_name ??
          listing.detail_address ??
          undefined,
        image: isSelected ? images?.red : images?.blue,
      });

      maps.event.addListener(marker, "click", () => onMarkerClick(listing.id));
      markersRef.current.set(listing.id, marker);
    });

    // 모든 마커가 보이도록 지도 범위 자동 조정
    if (listingsWithCoords.length > 0) {
      const bounds = new maps.LatLngBounds();
      markersRef.current.forEach((marker) => {
        bounds.extend(marker.getPosition());
      });
      map.setBounds(bounds, 60, 60, 60, 60);
    }
  }, [listingsWithCoords, onMarkerClick, ready]);

  // 3. 선택된 마커 이미지 교체 (빨간↔파란)
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
        <p className="text-sm text-muted-foreground">
          지도에 표시할 매물 위치가 없습니다
        </p>
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
