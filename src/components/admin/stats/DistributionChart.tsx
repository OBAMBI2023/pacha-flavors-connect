import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { HourlyPoint, WeekdayPoint } from "@/lib/orders-db";

const chartConfig: ChartConfig = {
  orders_count: { label: "Commandes", color: "var(--color-primary)" },
};

const WEEKDAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function fillHours(data: HourlyPoint[]): { label: string; orders_count: number; revenue: number }[] {
  const byHour = new Map(data.map((p) => [p.hour, p]));
  return Array.from({ length: 24 }, (_, hour) => {
    const p = byHour.get(hour);
    return { label: `${hour}h`, orders_count: p?.orders_count ?? 0, revenue: p?.revenue ?? 0 };
  });
}

function fillWeekdays(data: WeekdayPoint[]): { label: string; orders_count: number; revenue: number }[] {
  const byDay = new Map(data.map((p) => [p.weekday, p]));
  return Array.from({ length: 7 }, (_, weekday) => {
    const p = byDay.get(weekday);
    return { label: WEEKDAY_LABELS[weekday] ?? "", orders_count: p?.orders_count ?? 0, revenue: p?.revenue ?? 0 };
  });
}

function EmptyState() {
  return (
    <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
      Aucune commande sur cette période.
    </div>
  );
}

export function HourlyDistributionChart({ data }: { data: HourlyPoint[] }) {
  const points = fillHours(data);
  if (points.every((p) => p.orders_count === 0)) return <EmptyState />;

  return (
    <ChartContainer config={chartConfig} className="h-48 w-full">
      <BarChart data={points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} interval={2} />
        <YAxis tickLine={false} axisLine={false} fontSize={11} width={28} allowDecimals={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) =>
                name === "orders_count" ? [`${value} commande(s)`, "Commandes"] : [String(value), name]
              }
            />
          }
        />
        <Bar dataKey="orders_count" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

export function WeekdayDistributionChart({ data }: { data: WeekdayPoint[] }) {
  const points = fillWeekdays(data);
  if (points.every((p) => p.orders_count === 0)) return <EmptyState />;

  return (
    <ChartContainer config={chartConfig} className="h-48 w-full">
      <BarChart data={points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis tickLine={false} axisLine={false} fontSize={11} width={28} allowDecimals={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) =>
                name === "orders_count" ? [`${value} commande(s)`, "Commandes"] : [String(value), name]
              }
            />
          }
        />
        <Bar dataKey="orders_count" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
