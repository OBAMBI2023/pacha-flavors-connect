import { useEffect, useRef } from "react";
import { Map as MaplibreMap, Marker, NavigationControl, LngLatBounds } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Button } from "@/components/ui/button";
import { Locate } from "lucide-react";

// Free, no API key, no vendor lock-in. Noticeably more "premium/moderne"
// than MapLibre's own plain gray demo style. Fallback if ever unavailable:
// "https://demotiles.maplibre.org/style.json".
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export type LatLng = { lat: number; lng: number };

function markerElement(emoji: string): HTMLDivElement {
  const el = document.createElement("div");
  el.textContent = emoji;
  el.style.fontSize = "28px";
  el.style.lineHeight = "1";
  el.style.filter = "drop-shadow(0 2px 3px rgba(0,0,0,0.35))";
  return el;
}

export function DriverTrackingMap({
  driverPosition,
  restaurantPosition,
  showRestaurantAsDestination,
}: {
  driverPosition: LatLng | null;
  restaurantPosition: LatLng | null;
  showRestaurantAsDestination: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const driverMarkerRef = useRef<Marker | null>(null);
  const restaurantMarkerRef = useRef<Marker | null>(null);
  // Both driver and restaurant positions resolve asynchronously (realtime
  // hook + a fetch) after this component mounts -- fitToMarkers must always
  // read the *current* values, never a value closed over at the moment
  // map.on("load") was registered (which fires before either position has
  // necessarily arrived). A ref mirrors the latest props for exactly that.
  const positionsRef = useRef({ driverPosition, restaurantPosition });
  positionsRef.current = { driverPosition, restaurantPosition };
  // Auto-fit only once, the first time a real position becomes available --
  // matches "recentrage_initial: true, recentrage_continu: false" (manual
  // re-fit afterwards is the Recentrer button only).
  const hasAutoFitRef = useRef(false);
  // Customer marker seam: once an order-level lat/lng-equivalent exists,
  // plug a 📍 marker here the exact same way as the restaurant marker below.
  // No customer coordinates exist anywhere in the schema today -- omitted
  // rather than guessed from the delivery address.

  const fitToMarkers = () => {
    const map = mapRef.current;
    if (!map) return;
    const { driverPosition: dp, restaurantPosition: rp } = positionsRef.current;
    const points = [dp, rp].filter((p): p is LatLng => p != null);
    const first = points[0];
    if (!first) return;
    if (points.length === 1) {
      map.easeTo({ center: [first.lng, first.lat], zoom: Math.max(map.getZoom(), 14) });
      return;
    }
    const bounds = points.reduce(
      (b, p) => b.extend([p.lng, p.lat]),
      new LngLatBounds([first.lng, first.lat], [first.lng, first.lat]),
    );
    map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MaplibreMap({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [driverPosition?.lng ?? restaurantPosition?.lng ?? 0, driverPosition?.lat ?? restaurantPosition?.lat ?? 0],
      zoom: 13,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    map.on("load", () => {
      if (positionsRef.current.driverPosition || positionsRef.current.restaurantPosition) {
        hasAutoFitRef.current = true;
        fitToMarkers();
      }
    });

    // The Dialog's own open transition can still be animating (container
    // mid-resize) at the exact moment MapLibre measures its container, which
    // leaves it thinking the viewport is 0x0 or stale -- it then never
    // requests any tile data at all. A ResizeObserver catches the container
    // reaching its final size and forces MapLibre to recompute, which is
    // what actually kicks off tile loading.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      driverMarkerRef.current?.remove();
      restaurantMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
    // Map is created once per modal-open lifecycle; positions are synced via markers below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !driverPosition) return;
    if (!driverMarkerRef.current) {
      const el = markerElement("🚴");
      el.style.transition = "transform 900ms linear";
      driverMarkerRef.current = new Marker({ element: el, anchor: "center" })
        .setLngLat([driverPosition.lng, driverPosition.lat])
        .addTo(map);
    } else {
      driverMarkerRef.current.setLngLat([driverPosition.lng, driverPosition.lat]);
    }
    // First time any real position arrives (map may already have finished
    // loading before the async fetch resolved) -- fit once, then leave it
    // to the driver.
    if (!hasAutoFitRef.current && map.loaded()) {
      hasAutoFitRef.current = true;
      fitToMarkers();
    }
  }, [driverPosition]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !restaurantPosition) return;
    if (!restaurantMarkerRef.current) {
      restaurantMarkerRef.current = new Marker({ element: markerElement("🏪"), anchor: "center" })
        .setLngLat([restaurantPosition.lng, restaurantPosition.lat])
        .addTo(map);
    } else {
      restaurantMarkerRef.current.setLngLat([restaurantPosition.lng, restaurantPosition.lat]);
    }
    if (!hasAutoFitRef.current && map.loaded()) {
      hasAutoFitRef.current = true;
      fitToMarkers();
    }
  }, [restaurantPosition]);

  return (
    <div className="relative h-[360px] w-full overflow-hidden rounded-2xl border border-border sm:h-[440px]">
      <div ref={containerRef} className="h-full w-full" />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="absolute right-3 top-3 z-10 shadow-md"
        onClick={fitToMarkers}
      >
        <Locate className="mr-1.5 h-4 w-4" /> Recentrer
      </Button>
      {!showRestaurantAsDestination && (
        <div className="absolute bottom-3 left-3 z-10 rounded-full bg-background/90 px-3 py-1 text-xs font-medium shadow-md">
          Destination : client
        </div>
      )}
    </div>
  );
}
