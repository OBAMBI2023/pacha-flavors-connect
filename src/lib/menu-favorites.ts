import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pacha-favorite-dishes";

function readFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useMenuFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    setFavorites(readFavorites());
  }, []);

  const toggle = useCallback((itemId: string) => {
    setFavorites((current) => {
      const next = current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage failures (private mode, quota, etc.)
      }
      return next;
    });
  }, []);

  return { favorites, toggle };
}
