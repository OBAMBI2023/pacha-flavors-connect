import { forwardRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { COUNTRY_DIAL_CODES, findCountryByDialCode, flagEmoji } from "@/lib/countryDialCodes";
import { cn } from "@/lib/utils";

/**
 * Country dial-code + national-number pair, matching the checkout's other
 * Field components visually (h-[58px], rounded-2xl, border-input) so it
 * drops in without looking like a different widget.
 *
 * The national number is passed straight through on every keystroke --
 * nothing here ever strips or reformats it, so a leading trunk 0 (e.g.
 * "07 08 09 10 11" for Côte d'Ivoire) is preserved exactly as typed. Only
 * the caller, when it builds the final `customer_phone` to submit, decides
 * how to combine dialCode + this value (see TenantOrderDrawer.tsx) -- this
 * component has no opinion on that, it only lets the customer pick a
 * country and type a number.
 */
export const PhoneNumberField = forwardRef<
  HTMLInputElement,
  {
    label: string;
    required?: boolean;
    dialCode: string;
    onDialCodeChange: (dialCode: string) => void;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    placeholder?: string;
    error?: string | undefined;
  }
>(function PhoneNumberField({ label, required, dialCode, onDialCodeChange, value, onChange, onBlur, placeholder, error }, ref) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = findCountryByDialCode(dialCode);

  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required && " *"}
      </span>
      <div className="mt-1.5 flex gap-2">
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setSearch("");
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Choisir l'indicatif pays"
              className={cn(
                "flex h-[58px] shrink-0 items-center gap-1 rounded-2xl border bg-card px-3 text-base outline-none focus:border-primary",
                error ? "border-destructive" : "border-input",
              )}
            >
              <span className="text-lg leading-none">{selected ? flagEmoji(selected.iso2) : "🌍"}</span>
              <span className="font-medium">+{dialCode}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          {/* z-[110]: this field is used inside TenantOrderDrawer's checkout sheet, which is z-[100] --
              the shared Popover primitive's default z-50 would otherwise render the country list
              behind the sheet's sticky footer, invisible but still focusable/searchable. */}
          <PopoverContent align="start" className="z-[110] w-72 p-0">
            <Command shouldFilter={false}>
              <CommandInput placeholder="Rechercher un pays..." value={search} onValueChange={setSearch} />
              <CommandList>
                <CommandEmpty>Aucun pays trouvé.</CommandEmpty>
                <CommandGroup>
                  {COUNTRY_DIAL_CODES.filter((c) => {
                    const query = search.trim().toLowerCase();
                    if (!query) return true;
                    const digits = search.replace(/\D/g, "");
                    return c.name.toLowerCase().includes(query) || (digits !== "" && c.dialCode.includes(digits));
                  }).map((c) => (
                    <CommandItem
                      key={c.iso2}
                      value={c.iso2}
                      onSelect={() => {
                        onDialCodeChange(c.dialCode);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <span className="text-base leading-none">{flagEmoji(c.iso2)}</span>
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="text-muted-foreground">+{c.dialCode}</span>
                      {c.dialCode === dialCode && <Check className="h-4 w-4 text-primary" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <input
          ref={ref}
          type="tel"
          inputMode="tel"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          className={cn(
            "h-[58px] min-w-0 flex-1 rounded-2xl border bg-card px-[18px] text-base outline-none focus:border-primary",
            error ? "border-destructive" : "border-input",
          )}
        />
      </div>
      {error && <span className="mt-1 block text-xs font-medium text-destructive">{error}</span>}
    </label>
  );
});
