import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { SuperAdminPageViewDayRow } from "@/lib/superAdminPageViews";

const chartConfig: ChartConfig = {
  views: { label: "Vues", color: "var(--color-primary)" },
  unique_visitors: { label: "Visiteurs uniques", color: "hsl(215 16% 65%)" },
};

function shortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

/** Sibling to OrdersPerDayChart (src/components/superadmin) -- same recharts + ChartContainer
 * primitives, plotting visitor_sessions.page_views/unique visitors per day instead of orders.
 * Every point comes from get_super_admin_pageview_overview's views_by_day, already zero-filled
 * by generate_series for days with no activity -- never a fabricated non-zero value. */
export function PageViewsChart({ data }: { data: SuperAdminPageViewDayRow[] }) {
  const points = data.map((p) => ({ ...p, label: shortDate(p.date) }));

  if (points.every((p) => p.views === 0)) {
    return (
      <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
        Aucune vue sur cette période.
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="min-w-0 h-56 w-full sm:h-64">
      <BarChart data={points} margin={{ left: -10, right: 0, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} interval={points.length > 10 ? 2 : 0} />
        <YAxis tickLine={false} axisLine={false} fontSize={10} width={30} allowDecimals={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => [`${value}`, name === "views" ? "Vues" : "Visiteurs uniques"]}
            />
          }
        />
        <Bar dataKey="views" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="unique_visitors" fill="hsl(215 16% 65%)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
