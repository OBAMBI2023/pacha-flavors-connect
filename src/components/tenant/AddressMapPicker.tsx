import { useEffect, useRef } from "react";
import { Map as MaplibreMap, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Same free, no-API-key style already used by DriverTrackingMap.tsx -- one
// map provider for the whole app, never a second one for this picker.
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/**
 * Single draggable marker for picking a delivery position. Fully
 * uncontrolled position-wise while dragging (MapLibre owns the marker's
 * live coordinates during the gesture) -- `onPositionChange` fires once on
 * drop or tap, the parent decides what to do with it (reverse-geocode,
 * store as draft coordinates). `latitude`/`longitude` props only ever move
 * the marker *back* to a value the parent already knows about (GPS result,
 * a picked search suggestion) -- they never fight the user's own drag.
 */
export function AddressMapPicker({
  latitude,
  longitude,
  fallbackCenter,
  onPositionChange,
}: {
  latitude: number | null;
  longitude: number | null;
  fallbackCenter: { lat: number; lng: number };
  onPositionChange: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onPositionChangeRef = useRef(onPositionChange);
  onPositionChangeRef.current = onPositionChange;

  useEffect(() => {
    if (!containerRef.current) return;
    const center = latitude != null && longitude != null ? { lat: latitude, lng: longitude } : fallbackCenter;
    const map = new MaplibreMap({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [center.lng, center.lat],
      zoom: 15,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    const marker = new Marker({ draggable: true, color: "#e11d48" }).setLngLat([center.lng, center.lat]).addTo(map);
    marker.on("dragend", () => {
      const pos = marker.getLngLat();
      onPositionChangeRef.current(pos.lat, pos.lng);
    });
    markerRef.current = marker;

    // Tap-to-move: lets a customer place the pin precisely without needing
    // to grab and drag it, which is fiddly on small phone screens.
    map.on("click", (e) => {
      marker.setLngLat(e.lngLat);
      onPositionChangeRef.current(e.lngLat.lat, e.lngLat.lng);
    });

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      marker.remove();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Map/marker created once per mount; external position updates are
    // synced via the effect below instead of being fought over here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A position arriving from outside (GPS fix, a chosen search suggestion)
  // re-centers the existing marker/map rather than recreating either.
  useEffect(() => {
    if (latitude == null || longitude == null) return;
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    marker.setLngLat([longitude, latitude]);
    map.easeTo({ center: [longitude, latitude], zoom: Math.max(map.getZoom(), 15) });
  }, [latitude, longitude]);

  return (
    <div className="h-56 w-full overflow-hidden rounded-2xl border border-border sm:h-64">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
