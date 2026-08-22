import { Minus, Plus } from "lucide-react";

/**
 * Pure presentational stepper -- callers own the quantity state and the
 * semantics of decrementing past the minimum (e.g. the cart removes the
 * line, the product modal just clamps at 1), so this never clamps itself.
 * Buttons are 44px (WCAG AA touch-target minimum) regardless of context.
 */
export function QuantitySelector({
  value,
  onIncrement,
  onDecrement,
  decrementDisabled = false,
  incrementDisabled = false,
}: {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  decrementDisabled?: boolean;
  incrementDisabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onDecrement}
        disabled={decrementDisabled}
        aria-label="Diminuer la quantité"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-6 text-center text-sm font-semibold" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        disabled={incrementDisabled}
        aria-label="Augmenter la quantité"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
