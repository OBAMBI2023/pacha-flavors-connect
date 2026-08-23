import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MenuItem } from "@/data/menu";

export type CartOptionSelection = { id: string; name: string; extra_price: number };

/** `key` (not the product id) identifies a line -- two lines for the same product with different selected options must never merge. */
export type CartLine = { key: string; item: MenuItem; qty: number; options: CartOptionSelection[] };

function computeLineKey(itemId: string, options: CartOptionSelection[]): string {
  return `${itemId}::${options.map((o) => o.id).sort().join(",")}`;
}

export function optionsExtraTotal(options: CartOptionSelection[]): number {
  return options.reduce((sum, o) => sum + o.extra_price, 0);
}

type CartContextValue = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  hasUnpriced: boolean;
  add: (item: MenuItem, qty?: number, options?: CartOptionSelection[]) => void;
  increment: (key: string) => void;
  decrement: (key: string) => void;
  remove: (key: string) => void;
  clear: () => void;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const add = useCallback((item: MenuItem, qty: number = 1, options: CartOptionSelection[] = []) => {
    const key = computeLineKey(item.id, options);
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l));
      }
      return [...prev, { key, item, qty, options }];
    });
  }, []);

  const increment = useCallback((key: string) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l)));
  }, []);

  const decrement = useCallback((key: string) => {
    setLines((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, qty: l.qty - 1 } : l))
        .filter((l) => l.qty > 0),
    );
  }, []);

  const remove = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const subtotal = lines.reduce((n, l) => n + ((l.item.price ?? 0) + optionsExtraTotal(l.options)) * l.qty, 0);
    const hasUnpriced = lines.some((l) => l.item.price === null);
    return {
      lines,
      count,
      subtotal,
      hasUnpriced,
      add,
      increment,
      decrement,
      remove,
      clear,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
    };
  }, [lines, isOpen, add, increment, decrement, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
