import {
  formatDashboardEur,
  type DashboardTopBrand,
} from "@/lib/data/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

type Props = { brands: DashboardTopBrand[]; year: number };

export function DashboardTopBrands({ brands, year }: Props) {
  const max = brands[0]?.totalAgreedFee ?? 1;

  return (
    <Card className="rounded-2xl border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
        <div>
          <CardTitle className="text-sm font-medium text-gray-900">Top brand</CardTitle>
          <p className="text-xs text-gray-500">Per fee concordata · {year}</p>
        </div>
        <Link href="/aziende" className="text-xs font-medium text-blue-600 hover:underline">
          Aziende
        </Link>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {brands.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            Nessun brand con fee registrata quest&apos;anno.
          </p>
        ) : (
          <ul className="space-y-3">
            {brands.map((b, i) => {
              const pct = Math.round((b.totalAgreedFee / max) * 100);
              return (
                <li key={b.brandId}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-gray-900">
                      <span className="mr-1.5 text-xs text-gray-400 tabular-nums">{i + 1}.</span>
                      {b.brandName}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-gray-800">
                      {formatDashboardEur(b.totalAgreedFee)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-blue-500/80 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
