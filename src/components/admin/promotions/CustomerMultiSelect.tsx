import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { fetchCustomers, type Customer } from "@/lib/customers-db";
import { cn } from "@/lib/utils";

/**
 * Searchable multi-select over a tenant's own customers, backed by the same
 * fetchCustomers(restaurantId, { search }) the Clients admin panel already
 * uses -- no new query, and inherently tenant-scoped (RLS + restaurant_id
 * filter). No multi-select combobox existed anywhere in this app yet, so
 * this wires up the previously-unused Command/Popover primitives.
 */
export function CustomerMultiSelect({
  restaurantId,
  selected,
  onChange,
  singleSelect = false,
}: {
  restaurantId: string;
  selected: Customer[];
  onChange: (customers: Customer[]) => void;
  /** "personal" visibility only ever targets one customer -- picking a new one replaces the current selection instead of adding to it. */
  singleSelect?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const handle = window.setTimeout(() => {
      fetchCustomers(restaurantId, { search, page: 0 })
        .then(({ customers }) => {
          if (!cancelled) setResults(customers);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [restaurantId, search, open]);

  const selectedIds = new Set(selected.map((c) => c.id));

  function toggle(customer: Customer) {
    if (singleSelect) {
      onChange([customer]);
      setOpen(false);
      return;
    }
    if (selectedIds.has(customer.id)) onChange(selected.filter((c) => c.id !== customer.id));
    else onChange([...selected, customer]);
  }

  function remove(customerId: string) {
    onChange(selected.filter((c) => c.id !== customerId));
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
            {selected.length === 0 ? "Rechercher un client..." : `${selected.length} client(s) sélectionné(s)`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Nom, téléphone ou email..." value={search} onValueChange={setSearch} />
            <CommandList>
              {loading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Recherche...</div>
              ) : results.length === 0 ? (
                <CommandEmpty>Aucun client trouvé.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {results.map((customer) => {
                    const isSelected = selectedIds.has(customer.id);
                    return (
                      <CommandItem key={customer.id} value={customer.id} onSelect={() => toggle(customer)}>
                        <Check className={cn("h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                        <div className="min-w-0">
                          <p className="truncate">{customer.full_name}</p>
                          <p className="truncate text-xs text-muted-foreground">{customer.phone}</p>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((customer) => (
            <Badge key={customer.id} variant="secondary" className="gap-1 pr-1">
              {customer.full_name}
              <button
                type="button"
                onClick={() => remove(customer.id)}
                aria-label={`Retirer ${customer.full_name}`}
                className="rounded-full hover:bg-muted-foreground/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
