import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Map as MaplibreMap, Marker, Popup, NavigationControl, LngLatBounds } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE_URL, markerElement } from "@/components/admin/orders/DriverTrackingMap";
import { driverStatusBucket, DRIVER_STATUS_BUCKET_LABELS, type DriverStatus, type DriverStatusBucket } from "@/lib/drivers";

// Same center/bounds already used by the (super admin) fleet-style map --
// one set of "Abidjan" / "Côte d'Ivoire" constants for the whole app.
const ABIDJAN_CENTER: [number, number] = [-4.0082563, 5.3599517];
const ABIDJAN_ZOOM = 11;
const COTE_DIVOIRE_BOUNDS: [[number, number], [number, number]] = [
  [-8.6, 4.3],
  [-2.4, 10.8],
];

const STATUS_DOT_COLOR: Record<DriverStatusBucket, string> = {
  available: "#22c55e",
  on_delivery: "#f97316",
  offline: "#9ca3af",
  suspended: "#9ca3af",
};

export type FleetMapDriver = {
  id: string;
  fullName: string;
  status: DriverStatus;
  lat: number;
  lng: number;
  lastLocationAt: string | null;
  activeOrderNumber: number | null;
};

export type DriverFleetMapHandle = {
  recenterCotedIvoire: () => void;
  recenterAbidjan: () => void;
  fitAllDrivers: () => void;
};

function relativeTimeLabel(iso: string | null): string {
  if (!iso) return "jamais";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `il y a ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `il y a ${hours} h`;
}

/** 🚚 emoji marker (DriverTrackingMap's own look) plus a small status dot -- the dot is the only addition a multi-driver map needs to tell markers apart at a glance. */
function createMarkerElement(bucket: DriverStatusBucket): { wrapper: HTMLDivElement; dot: HTMLSpanElement } {
  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  const emoji = markerElement("🚚");
  emoji.style.transition = "transform 900ms linear";
  wrapper.appendChild(emoji);
  const dot = document.createElement("span");
  dot.style.position = "absolute";
  dot.style.right = "-2px";
  dot.style.bottom = "2px";
  dot.style.width = "10px";
  dot.style.height = "10px";
  dot.style.borderRadius = "9999px";
  dot.style.border = "2px solid white";
  dot.style.background = STATUS_DOT_COLOR[bucket];
  wrapper.appendChild(dot);
  return { wrapper, dot };
}

function buildPopupContent(driver: FleetMapDriver, bucket: DriverStatusBucket): HTMLDivElement {
  const el = document.createElement("div");
  el.style.fontSize = "13px";
  el.style.lineHeight = "1.5";
  el.style.minWidth = "160px";

  const name = document.createElement("p");
  name.style.fontWeight = "600";
  name.textContent = driver.fullName;
  el.appendChild(name);

  const status = document.createElement("p");
  status.style.color = "#6b7280";
  status.textContent = `Statut : ${DRIVER_STATUS_BUCKET_LABELS[bucket]}`;
  el.appendChild(status);

  const updated = document.createElement("p");
  updated.style.color = "#6b7280";
  updated.textContent = `Dernière position : ${relativeTimeLabel(driver.lastLocationAt)}`;
  el.appendChild(updated);

  const order = document.createElement("p");
  order.style.color = "#6b7280";
  order.textContent = driver.activeOrderNumber != null ? `Commande active : #${driver.activeOrderNumber}` : "Aucune commande active";
  el.appendChild(order);

  return el;
}

type MarkerEntry = { marker: Marker; popup: Popup; dot: HTMLSpanElement; bucket: DriverStatusBucket };

/**
 * Multi-driver counterpart to DriverTrackingMap -- same MapLibre engine,
 * same tile style, same emoji-marker look, adapted to hold one marker per
 * driver instead of a single driver+restaurant pair. Markers are created
 * once per driver id and moved in place afterwards (`setLngLat`), so a
 * position update never tears down and rebuilds the map or any other
 * driver's marker.
 */
export const DriverFleetMap = forwardRef<DriverFleetMapHandle, { drivers: FleetMapDriver[] }>(function DriverFleetMap(
  { drivers },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());
  const [ready, setReady] = useState(false);
  const hasAutoFitRef = useRef(false);

  const fitAllDrivers = () => {
    const map = mapRef.current;
    if (!map) return;
    const entries = Array.from(markersRef.current.values());
    if (entries.length === 0) return;
    if (entries.length === 1) {
      const lngLat = entries[0]!.marker.getLngLat();
      map.easeTo({ center: lngLat, zoom: Math.max(map.getZoom(), 14) });
      return;
    }
    const first = entries[0]!.marker.getLngLat();
    const bounds = entries.reduce((b, e) => b.extend(e.marker.getLngLat()), new LngLatBounds(first, first));
    map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
  };

  useImperativeHandle(ref, () => ({
    recenterCotedIvoire: () => {
      mapRef.current?.fitBounds(COTE_DIVOIRE_BOUNDS, { padding: 30, duration: 700 });
    },
    recenterAbidjan: () => {
      mapRef.current?.easeTo({ center: ABIDJAN_CENTER, zoom: ABIDJAN_ZOOM, duration: 700 });
    },
    fitAllDrivers,
  }));

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MaplibreMap({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: ABIDJAN_CENTER,
      zoom: ABIDJAN_ZOOM,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    map.on("load", () => setReady(true));

    // Same rationale as DriverTrackingMap/CustomerMapView: a container still
    // mid-transition (tab switch) when MapLibre first measures it can leave
    // it thinking the viewport is 0x0.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      for (const entry of markersRef.current.values()) entry.marker.remove();
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
    // Map is created once per mount; markers are synced via the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const nextIds = new Set(drivers.map((d) => d.id));
    for (const [id, entry] of markersRef.current) {
      if (!nextIds.has(id)) {
        entry.marker.remove();
        markersRef.current.delete(id);
      }
    }

    for (const driver of drivers) {
      const bucket = driverStatusBucket(driver.status);
      const existing = markersRef.current.get(driver.id);
      if (!existing) {
        const { wrapper, dot } = createMarkerElement(bucket);
        const popup = new Popup({ offset: 18, closeButton: true }).setDOMContent(buildPopupContent(driver, bucket));
        const marker = new Marker({ element: wrapper, anchor: "center" })
          .setLngLat([driver.lng, driver.lat])
          .setPopup(popup)
          .addTo(map);
        markersRef.current.set(driver.id, { marker, popup, dot, bucket });
      } else {
        // Only the concerned marker moves -- setLngLat animates via the
        // element's own CSS transition, no full-map or other-marker touch.
        existing.marker.setLngLat([driver.lng, driver.lat]);
        existing.popup.setDOMContent(buildPopupContent(driver, bucket));
        if (existing.bucket !== bucket) {
          existing.dot.style.background = STATUS_DOT_COLOR[bucket];
          existing.bucket = bucket;
        }
      }
    }

    if (!hasAutoFitRef.current && drivers.length > 0) {
      hasAutoFitRef.current = true;
      fitAllDrivers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drivers, ready]);

  return <div ref={containerRef} className="h-full w-full" />;
});
