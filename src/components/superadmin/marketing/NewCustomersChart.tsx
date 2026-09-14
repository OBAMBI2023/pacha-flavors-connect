import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { DailyPoint } from "@/lib/marketing";

const chartConfig: ChartConfig = {
  count: { label: "Nouveaux clients", color: "var(--color-primary)" },
};

function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  });
}

/** Real per-day count of `customers.created_at` in range -- see fetchNewCustomersDailySeries. No "clients actifs" second series: there is no agreed, non-fabricated definition of a daily cumulative "active" count in this data model, so this chart only ever shows what it can compute exactly. */
export function NewCustomersChart({ data }: { data: DailyPoint[] }) {
  if (data.every((p) => p.count === 0)) {
    return (
      <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-400">
        Aucun nouveau client sur cette période.
      </div>
    );
  }
  const points = data.map((p) => ({ ...p, label: shortDate(p.date) }));
  return (
    <ChartContainer config={chartConfig} className="h-56 w-full min-w-0 sm:h-64">
      <LineChart data={points} margin={{ left: -10, right: 0, top: 8, bottom: 0 }}>
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
          content={
            <ChartTooltipContent formatter={(value) => [String(value), "Nouveaux clients"]} />
          }
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke="var(--color-primary)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
