import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { RevenueSeriesPoint } from "@/lib/orders-db";

const chartConfig: ChartConfig = {
  revenue: { label: "Chiffre d'affaires", color: "var(--color-primary)" },
};

function shortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

export function RevenueChart({ data }: { data: RevenueSeriesPoint[] }) {
  const points = data.map((p) => ({ ...p, label: shortDate(p.date) }));

  if (points.every((p) => p.revenue === 0 && p.orders === 0)) {
    return (
      <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
        Aucune donnée sur cette période.
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-56 w-full">
      <BarChart data={points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis tickLine={false} axisLine={false} fontSize={11} width={40} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) =>
                name === "revenue"
                  ? [`${Number(value).toLocaleString("fr-FR")} FCFA`, "Chiffre d'affaires"]
                  : [String(value), "Commandes"]
              }
            />
          }
        />
        <Bar dataKey="revenue" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
