import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { SOURCE_LABELS } from "@/components/admin/stats/sourceLabels";
import type { SourceBreakdownRow } from "@/lib/orders-db";

/** Existing --chart-1..3 design tokens (styles.css) -- not new colors, just the first three of the palette already reserved for chart series. */
const SLICE_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)"];

const chartConfig: ChartConfig = {
  orders_count: { label: "Commandes" },
};

export function SourceDonutChart({ data }: { data: SourceBreakdownRow[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
        Aucune commande sur cette période.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center">
      <ChartContainer config={chartConfig} className="mx-auto aspect-square h-40 w-40 shrink-0">
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                nameKey="source"
                formatter={(value, name) => {
                  const source = name as SourceBreakdownRow["source"];
                  const row = data.find((d) => d.source === source);
                  return [
                    `${value} commande(s)${row ? ` · ${row.share}%` : ""}`,
                    SOURCE_LABELS[source] ?? String(source),
                  ];
                }}
              />
            }
          />
          <Pie
            data={data}
            dataKey="orders_count"
            nameKey="source"
            innerRadius={44}
            outerRadius={68}
            strokeWidth={3}
            paddingAngle={data.length > 1 ? 2 : 0}
          >
            {data.map((entry, index) => (
              <Cell key={entry.source} fill={SLICE_COLORS[index % SLICE_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="w-full space-y-1.5 sm:w-auto">
        {data.map((row, index) => (
          <li key={row.source} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: SLICE_COLORS[index % SLICE_COLORS.length] }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {SOURCE_LABELS[row.source]}
            </span>
            <span className="shrink-0 font-medium">{row.share}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
