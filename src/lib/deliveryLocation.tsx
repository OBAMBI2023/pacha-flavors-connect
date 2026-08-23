import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type DeliveryLocation = {
  latitude: number | null;
  longitude: number | null;
  address: string;
  neighborhood: string | null;
  commune: string | null;
  city: string | null;
  country: string | null;
  landmark: string | null;
  confirmed: boolean;
  updated_at: string;
};

const STORAGE_KEY = "saovia.customer.location";

function loadStoredLocation(): DeliveryLocation | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeliveryLocation>;
    if (typeof parsed?.address !== "string" || !parsed.address.trim()) return null;
    return {
      latitude: typeof parsed.latitude === "number" ? parsed.latitude : null,
      longitude: typeof parsed.longitude === "number" ? parsed.longitude : null,
      address: parsed.address,
      neighborhood: parsed.neighborhood ?? null,
      commune: parsed.commune ?? null,
      city: parsed.city ?? null,
      country: parsed.country ?? null,
      landmark: parsed.landmark ?? null,
      confirmed: Boolean(parsed.confirmed),
      updated_at: parsed.updated_at ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

type DeliveryLocationContextValue = {
  location: DeliveryLocation | null;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  setLocation: (location: DeliveryLocation) => void;
  clearLocation: () => void;
};

const DeliveryLocationContext = createContext<DeliveryLocationContextValue | null>(null);

export function DeliveryLocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<DeliveryLocation | null>(() =>
    typeof window !== "undefined" ? loadStoredLocation() : null,
  );
  const [isModalOpen, setModalOpen] = useState(false);

  const setLocation = useCallback((next: DeliveryLocation) => {
    setLocationState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private browsing / storage disabled -- location still works for this session via state.
    }
  }, []);

  const clearLocation = useCallback(() => {
    setLocationState(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clean up if storage was never writable.
    }
  }, []);

  const value = useMemo<DeliveryLocationContextValue>(
    () => ({
      location,
      isModalOpen,
      openModal: () => setModalOpen(true),
      closeModal: () => setModalOpen(false),
      setLocation,
      clearLocation,
    }),
    [location, isModalOpen, setLocation, clearLocation],
  );

  return <DeliveryLocationContext.Provider value={value}>{children}</DeliveryLocationContext.Provider>;
}

export function useDeliveryLocation() {
  const ctx = useContext(DeliveryLocationContext);
  if (!ctx) throw new Error("useDeliveryLocation must be used inside DeliveryLocationProvider");
  return ctx;
}
