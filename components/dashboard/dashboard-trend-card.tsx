import {
  formatDashboardEur,
  formatDashboardMonthLabel,
  type DashboardMonthPoint,
} from "@/lib/data/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

type Props = { points: DashboardMonthPoint[] };

function buildLinePath(
  values: number[],
  width: number,
  height: number,
  padding: number
): string {
  if (values.length === 0) return "";
  const max = Math.max(...values, 1);
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const step = values.length > 1 ? innerW / (values.length - 1) : 0;

  const coords = values.map((v, i) => {
    const x = padding + i * step;
    const y = padding + innerH - (v / max) * innerH;
    return `${x},${y}`;
  });
  return `M ${coords.join(" L ")}`;
}

export function DashboardTrendCard({ points }: Props) {
  const totals = points.map((p) => p.total);
  const maxTotal = Math.max(...totals, 1);
  const w = 320;
  const h = 120;
  const pad = 8;
  const path = buildLinePath(totals, w, h, pad);

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const lastMom =
    prev && prev.total > 0
      ? Math.round(((last.total - prev.total) / prev.total) * 100)
      : null;

  return (
    <Card className="rounded-2xl border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
        <div>
          <CardTitle className="text-sm font-medium text-gray-900">Entrate (12 mesi)</CardTitle>
          <p className="text-xs text-gray-500">Sponsor incassati + YouTube</p>
        </div>
        <Link href="/finanze" className="text-xs font-medium text-blue-600 hover:underline">
          Apri finanze
        </Link>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {points.every((p) => p.total === 0) ? (
          <p className="py-8 text-center text-sm text-gray-400">
            Nessun dato negli ultimi 12 mesi. Registra pagamenti o sincronizza YouTube.
          </p>
        ) : (
          <>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-xl font-bold tabular-nums text-gray-900">
                {formatDashboardEur(last?.total ?? 0)}
              </span>
              {last && (
                <span className="text-xs text-gray-500">
                  {formatDashboardMonthLabel(last.month)}
                  {lastMom != null ? ` · ${lastMom >= 0 ? "+" : ""}${lastMom}%` : ""}
                </span>
              )}
            </div>
            <svg
              viewBox={`0 0 ${w} ${h}`}
              className="h-28 w-full text-blue-500"
              role="img"
              aria-label="Andamento entrate ultimi 12 mesi"
            >
              <defs>
                <linearGradient id="dashTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(59 130 246 / 0.25)" />
                  <stop offset="100%" stopColor="rgb(59 130 246 / 0)" />
                </linearGradient>
              </defs>
              {path ? (
                <>
                  <path
                    d={`${path} L ${w - pad} ${h - pad} L ${pad} ${h - pad} Z`}
                    fill="url(#dashTrendFill)"
                  />
                  <path
                    d={path}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              ) : null}
            </svg>
            <div className="mt-2 flex justify-between text-[10px] text-gray-400">
              <span>{formatDashboardMonthLabel(points[0]?.month ?? "")}</span>
              <span>{formatDashboardMonthLabel(points[points.length - 1]?.month ?? "")}</span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              Picco periodo: {formatDashboardEur(maxTotal)}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
