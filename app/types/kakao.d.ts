declare namespace kakao.maps {
  class LatLng { constructor(lat: number, lng: number); }
  class Map { constructor(element: HTMLElement, options: { center: LatLng; level: number }); setCenter(position: LatLng): void; }
  class Marker { constructor(options: { position: LatLng; title?: string }); setMap(map: Map | null): void; getPosition(): LatLng; setZIndex(index: number): void; }
  class InfoWindow { constructor(options: { content: string; removable?: boolean }); open(map: Map, marker: Marker): void; close(): void; }
  function load(callback: () => void): void;
  function addListener(target: Marker, type: string, handler: () => void): void;
  const event: { addListener: typeof addListener };
}
interface Window { kakao?: { maps?: typeof kakao.maps } }
