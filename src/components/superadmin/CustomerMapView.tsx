import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Map as MaplibreMap, NavigationControl, LngLatBounds, type GeoJSONSource, type MapGeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MappedCustomer } from "@/lib/superAdminCustomerMap";

// Same free, no-API-key provider already used everywhere else in this app
// (AddressMapPicker, DriverTrackingMap) -- one map provider for the whole
// app, never a second one for this module.
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
// [lng, lat] -- MapLibre's own coordinate order.
const ABIDJAN_CENTER: [number, number] = [-4.0082563, 5.3599517];
const ABIDJAN_ZOOM = 11;
// Bounding box covering mainland Côte d'Ivoire (SW, NE corners), so
// "Recentrer sur la Côte d'Ivoire" always shows the whole country
// regardless of which tenant/city the map happened to be showing before.
const COTE_DIVOIRE_BOUNDS: [[number, number], [number, number]] = [
  [-8.6, 4.3],
  [-2.4, 10.8],
];

const SOURCE_ID = "super-admin-customers";
const CLUSTERS_LAYER_ID = "super-admin-customers-clusters";
const CLUSTER_COUNT_LAYER_ID = "super-admin-customers-cluster-count";
const POINT_LAYER_ID = "super-admin-customers-point";

type CustomerFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: MappedCustomer;
  }>;
};

/**
 * A malformed row (out of range or non-finite lat/lng) must never crash the
 * map or block every other customer from showing -- it's just dropped,
 * same "ignorer proprement" rule as the RPC's own join already applies
 * server-side. Belt and suspenders: this is the last line of defense on
 * the client.
 */
function isValidCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function toFeatureCollection(customers: MappedCustomer[]): CustomerFeatureCollection {
  return {
    type: "FeatureCollection",
    features: customers
      .filter((c) => isValidCoordinate(c.lat, c.lng))
      .map((c) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [c.lng, c.lat] },
        properties: c,
      })),
  };
}

export type CustomerMapViewHandle = {
  recenterCotedIvoire: () => void;
  recenterAbidjan: () => void;
};

/**
 * Fond de carte réel toujours affiché (même à 0 client) + clustering natif
 * MapLibre (une seule source GeoJSON, cluster: true) pour éviter la
 * surcharge visuelle quand plusieurs clients sont proches. Le clic sur un
 * cluster zoome dessus ; le clic sur un point individuel ouvre la fiche
 * client via onSelectCustomer.
 */
export const CustomerMapView = forwardRef<CustomerMapViewHandle, {
  customers: MappedCustomer[];
  onSelectCustomer: (customer: MappedCustomer) => void;
}>(function CustomerMapView({ customers, onSelectCustomer }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelectCustomer);
  onSelectRef.current = onSelectCustomer;
  // Auto-fit only once per distinct dataset (a fresh filter result), never
  // on every render -- otherwise panning/zooming manually would keep
  // getting fought by a re-fit. Starts as the initial Abidjan view, so a
  // dataset that never changes (e.g. always empty) never forces a fit.
  const lastFitKeyRef = useRef<string>("");

  useImperativeHandle(ref, () => ({
    recenterCotedIvoire: () => {
      mapRef.current?.fitBounds(COTE_DIVOIRE_BOUNDS, { padding: 30, duration: 700 });
    },
    recenterAbidjan: () => {
      mapRef.current?.easeTo({ center: ABIDJAN_CENTER, zoom: ABIDJAN_ZOOM, duration: 700 });
    },
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

    map.on("load", () => {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: toFeatureCollection([]) as never,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      map.addLayer({
        id: CLUSTERS_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#60a5fa", 10, "#f59e0b", 30, "#dc2626"],
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 30, 26],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: CLUSTER_COUNT_LAYER_ID,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 13,
        },
        paint: { "text-color": "#ffffff" },
      });

      map.addLayer({
        id: POINT_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 5, 16, 10],
          "circle-color": [
            "match",
            ["get", "status"],
            "active", "#059669",
            "to_reactivate", "#d97706",
            "inactive", "#64748b",
            "#64748b",
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("mouseenter", CLUSTERS_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", CLUSTERS_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("click", CLUSTERS_LAYER_ID, async (e) => {
        const feature = e.features?.[0] as MapGeoJSONFeature | undefined;
        const clusterId = feature?.properties?.["cluster_id"] as number | undefined;
        if (!feature || clusterId === undefined) return;
        const source = map.getSource(SOURCE_ID) as GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        const geometry = feature.geometry as { type: "Point"; coordinates: [number, number] };
        const [lng, lat] = geometry.coordinates;
        map.easeTo({ center: [lng, lat], zoom, duration: 500 });
      });

      map.on("mouseenter", POINT_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", POINT_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("click", POINT_LAYER_ID, (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        onSelectRef.current(feature.properties as unknown as MappedCustomer);
      });

      setReady(true);
    });

    // Same rationale as DriverTrackingMap: a container that's still
    // mid-animation (e.g. inside a tab transition) when MapLibre first
    // measures it can leave the map thinking its viewport is 0x0.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    const collection = toFeatureCollection(customers);
    source?.setData(collection as never);

    const fitKey = collection.features.map((f) => f.properties.id).join(",");
    if (collection.features.length > 0 && fitKey !== lastFitKeyRef.current) {
      lastFitKeyRef.current = fitKey;
      const first = collection.features[0]!;
      const bounds = collection.features.reduce(
        (b, f) => b.extend(f.geometry.coordinates),
        new LngLatBounds(first.geometry.coordinates, first.geometry.coordinates),
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 600 });
    }
  }, [customers, ready]);

  return <div ref={containerRef} className="h-full w-full" />;
});
