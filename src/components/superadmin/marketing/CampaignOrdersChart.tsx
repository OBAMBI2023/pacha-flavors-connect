import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { DailyPoint } from "@/lib/marketing";

const chartConfig: ChartConfig = {
  count: { label: "Commandes", color: "var(--color-primary)" },
};

function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  });
}

/** Real per-day count of orders using a campaign-linked promo code -- see fetchCampaignOrdersDailySeries. Zero for restaurants that never attach a promo code to a campaign, never estimated. */
export function CampaignOrdersChart({ data }: { data: DailyPoint[] }) {
  if (data.every((p) => p.count === 0)) {
    return (
      <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-400">
        Aucune commande attribuée à une campagne sur cette période.
      </div>
    );
  }
  const points = data.map((p) => ({ ...p, label: shortDate(p.date) }));
  return (
    <ChartContainer config={chartConfig} className="h-56 w-full min-w-0 sm:h-64">
      <BarChart data={points} margin={{ left: -10, right: 0, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          fontSize={10}
          interval={points.length > 10 ? 2 : 0}
        />
        <YAxis tickLine={false} axisLine={false} fontSize={10} width={28} allowDecimals={false} />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => [String(value), "Commandes"]} />}
        />
        <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
