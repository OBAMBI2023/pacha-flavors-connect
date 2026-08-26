import { useState } from "react";
import { toast } from "sonner";
import { Coins } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

/**
 * Restaurants.currency drives every price display across the app (menu,
 * cart, checkout, orders, dashboard, printable ticket, promotions, delivery
 * fee) -- this card is the only place a tenant can change it. It's a
 * display-only setting: no conversion runs against already-stored prices,
 * they just render with a different currency suffix from now on.
 */
export function CurrencyCard({
  restaurantId,
  currentCurrency,
  onSaved,
}: {
  restaurantId: string;
  currentCurrency: string;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(currentCurrency);
  const [busy, setBusy] = useState(false);

  const dirty = value !== currentCurrency;

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("restaurants").update({ currency: value }).eq("id", restaurantId);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Devise mise à jour");
    onSaved();
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Coins className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold">Devise</h2>
          <p className="text-sm text-muted-foreground">
            Devise utilisée pour tous les montants affichés (menu, panier, commandes, tickets, promotions).
          </p>
        </div>
      </div>
      <div className="max-w-xs space-y-2">
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_CURRENCIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Les prix déjà enregistrés ne sont pas convertis -- seul le symbole affiché change.
        </p>
      </div>
      <Button onClick={() => void save()} disabled={busy || !dirty}>
        {busy ? "Enregistrement..." : "Enregistrer la devise"}
      </Button>
    </Card>
  );
}
