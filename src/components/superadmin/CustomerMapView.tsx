import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Map as MaplibreMap, NavigationControl, LngLatBounds, type GeoJSONSource, type MapGeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MappedCustomer } from "@/lib/superAdminCustomerMap";
import type { MappedTenant } from "@/lib/superAdminTenantMap";

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

// Client statuses (active/to_reactivate/inactive) and tenant statuses
// (active/trial/suspended/archived) never collide on a value other than
// "active", which already means the same thing (currently engaged) in both
// domains -- so one match expression, keyed off the feature's own "status"
// property, covers both modes. No per-mode layer/paint switching needed.
const STATUS_COLOR_MATCH: unknown[] = [
  "match",
  ["get", "status"],
  "active", "#059669",
  "to_reactivate", "#d97706",
  "inactive", "#64748b",
  "trial", "#d97706",
  "suspended", "#dc2626",
  "archived", "#64748b",
  "#64748b",
];

type MapMarker = { id: string; lat: number; lng: number };

type MarkerFeatureCollection<T> = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: T;
  }>;
};

/**
 * A malformed row (out of range or non-finite lat/lng) must never crash the
 * map or block every other marker from showing -- it's just dropped, same
 * "ignorer proprement" rule already applied server-side by both RPCs.
 * Belt and suspenders: this is the last line of defense on the client.
 */
function isValidCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function toFeatureCollection<T extends MapMarker>(items: T[]): MarkerFeatureCollection<T> {
  return {
    type: "FeatureCollection",
    features: items
      .filter((item) => isValidCoordinate(item.lat, item.lng))
      .map((item) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [item.lng, item.lat] },
        properties: item,
      })),
  };
}

export type CustomerMapViewHandle = {
  recenterCotedIvoire: () => void;
  recenterAbidjan: () => void;
};

type CustomerMapViewProps =
  | {
      mode: "clients";
      customers: MappedCustomer[];
      onSelectCustomer: (customer: MappedCustomer) => void;
    }
  | {
      mode: "tenants";
      tenants: MappedTenant[];
      onSelectTenant: (tenant: MappedTenant) => void;
    };

/**
 * Fond de carte réel toujours affiché (même à 0 résultat) + clustering natif
 * MapLibre (une seule source GeoJSON, cluster: true) pour éviter la
 * surcharge visuelle quand plusieurs marqueurs sont proches. Une seule
 * carte, un seul jeu de couches -- le mode ("clients" ou "tenants") ne
 * change que les données poussées dans la source et le callback de clic, ce
 * qui évite de dupliquer les contrôles cartographiques. Le clic sur un
 * cluster zoome dessus ; le clic sur un point individuel notifie l'appelant
 * via onSelectCustomer/onSelectTenant selon le mode actif.
 */
export const CustomerMapView = forwardRef<CustomerMapViewHandle, CustomerMapViewProps>(function CustomerMapView(props, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const propsRef = useRef(props);
  propsRef.current = props;
  // Auto-fit only once per distinct dataset (a fresh filter result, or a
  // mode switch), never on every render -- otherwise panning/zooming
  // manually would keep getting fought by a re-fit.
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
          "circle-color": STATUS_COLOR_MATCH as never,
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
        const current = propsRef.current;
        if (current.mode === "clients") {
          current.onSelectCustomer(feature.properties as unknown as MappedCustomer);
        } else {
          current.onSelectTenant(feature.properties as unknown as MappedTenant);
        }
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

  const items: (MappedCustomer | MappedTenant)[] = props.mode === "clients" ? props.customers : props.tenants;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    const collection = toFeatureCollection(items);
    source?.setData(collection as never);

    const fitKey = `${props.mode}:${collection.features.map((f) => f.properties.id).join(",")}`;
    if (collection.features.length > 0 && fitKey !== lastFitKeyRef.current) {
      lastFitKeyRef.current = fitKey;
      const first = collection.features[0]!;
      const bounds = collection.features.reduce(
        (b, f) => b.extend(f.geometry.coordinates),
        new LngLatBounds(first.geometry.coordinates, first.geometry.coordinates),
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 600 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, props.mode, ready]);

  return <div ref={containerRef} className="h-full w-full" />;
});
