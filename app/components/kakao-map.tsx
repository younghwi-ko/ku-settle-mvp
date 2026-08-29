"use client";

import { useEffect, useRef, useState } from "react";
import type { Place } from "../data";
import { KU_CENTER, isValidCoordinates } from "../lib/kakao";

type Props = { places: Place[]; selectedId: number | null; onSelect: (place: Place) => void; labels: { loading: string; ready?: string; failed: string; attribution: string; noCoordinates: string } };

export default function KakaoMap({ places, selectedId, onSelect, labels }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const markersRef = useRef<Map<number, kakao.maps.Marker>>(new Map());
  const infoWindowRef = useRef<kakao.maps.InfoWindow | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  useEffect(() => {
    let cancelled = false;
    const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
    if (!key || !rootRef.current) { setStatus("failed"); return; }
    const load = () => new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => reject(new Error("sdk_timeout")), 8_000);
      const finish = (error?: Error) => { if (settled) return; settled = true; window.clearTimeout(timer); if (error) reject(error); else resolve(); };
      const loadMaps = () => { try { if (window.kakao?.maps) window.kakao.maps.load(() => finish()); else finish(new Error("sdk")); } catch { finish(new Error("sdk")); } };
      if (window.kakao?.maps) { loadMaps(); return; }
      const script = document.createElement("script"); script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`; script.async = true; script.onload = loadMaps; script.onerror = () => finish(new Error("sdk")); document.head.appendChild(script);
    });
    void load().then(() => { if (cancelled || !rootRef.current || !window.kakao?.maps) return; mapRef.current = new window.kakao.maps.Map(rootRef.current, { center: new window.kakao.maps.LatLng(KU_CENTER.lat, KU_CENTER.lng), level: 5 }); setStatus("ready"); }).catch(() => { if (!cancelled) setStatus("failed"); });
    return () => { cancelled = true; markersRef.current.forEach((marker) => marker.setMap(null)); markersRef.current.clear(); mapRef.current = null; };
  }, []);
  useEffect(() => {
    if (status !== "ready" || !mapRef.current || !window.kakao?.maps) return;
    markersRef.current.forEach((marker) => marker.setMap(null)); markersRef.current.clear(); infoWindowRef.current?.close();
    const validPlaces = places.filter((place) => isValidCoordinates(place.coordinates)); const bounds = new window.kakao.maps.LatLngBounds(); validPlaces.forEach((place) => { const point = new window.kakao.maps.LatLng(place.coordinates!.lat, place.coordinates!.lng); bounds.extend(point); const marker = new window.kakao.maps.Marker({ position: point, title: place.displayName ?? place.localizedName?.ko ?? "Place" }); marker.setMap(mapRef.current); window.kakao.maps.event.addListener(marker, "click", () => { const title = (place.displayName ?? place.localizedName?.ko ?? "Place").replace(/[&<>"']/g, (value) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[value] ?? value)); const address = (place.address ?? "").replace(/[&<>"']/g, (value) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[value] ?? value)); infoWindowRef.current?.close(); infoWindowRef.current = new window.kakao.maps.InfoWindow({ content: `<div style="padding:8px;font-size:12px"><strong>${title}</strong><br/>${address}</div>`, removable: true }); infoWindowRef.current.open(mapRef.current!, marker); onSelect(place); }); markersRef.current.set(place.id, marker); }); if (validPlaces.length > 1) mapRef.current.setBounds(bounds); else if (validPlaces.length === 1) mapRef.current.setCenter(new window.kakao.maps.LatLng(validPlaces[0].coordinates!.lat, validPlaces[0].coordinates!.lng));
  }, [onSelect, places, status]);
  useEffect(() => { const marker = selectedId === null ? null : markersRef.current.get(selectedId); if (marker && mapRef.current) { mapRef.current.setCenter(marker.getPosition()); marker.setZIndex(10); } }, [selectedId]);
  return <div className="kakao-map-shell"><div ref={rootRef} className="kakao-map" aria-label={status === "ready" ? (labels.ready ?? labels.loading) : status === "failed" ? labels.failed : labels.loading}>{status === "loading" && <div className="map-overlay">{labels.loading}</div>}{status === "failed" && <div className="map-overlay map-error">{labels.failed}</div>}</div><div className="map-attribution">{labels.attribution}</div>{status === "ready" && labels.ready && <div className="map-ready-status">{labels.ready}</div>}{status === "ready" && places.every((place) => !isValidCoordinates(place.coordinates)) && <div className="map-no-coordinates">{labels.noCoordinates}</div>}</div>;
}
