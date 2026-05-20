import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface FilingStatusRow {
  return_type?: string;
  financial_year?: string;
  tax_period?: string;
  date_of_filing?: string;
  status?: string;
  mode_of_filing?: string;
}

/**
 * Normalises the filing_status value coming from Surepass.
 * The API returns either a nested array (`[[ {…}, {…} ]]`) or a flat array.
 */
export function normalizeFilingStatus(value: any): FilingStatusRow[] {
  if (!value) return [];
  if (Array.isArray(value) && value.length > 0 && Array.isArray(value[0])) {
    return value[0] as FilingStatusRow[];
  }
  if (Array.isArray(value)) return value as FilingStatusRow[];
  return [];
}

const MONTH_INDEX: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/**
 * "Latest expected period" = previous calendar month.
 * Returns true if a GSTR3B (or GSTR1 fallback) row for that period is Filed.
 */
export function isLatestPeriodFiled(rows: FilingStatusRow[]): boolean {
  if (!rows || rows.length === 0) return false;

  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const targetMonth = target.getMonth();
  const targetYear = target.getFullYear();
  const fyStartYear = targetMonth >= 3 ? targetYear : targetYear - 1;
  const fyString = `${fyStartYear}-${fyStartYear + 1}`;

  const matches = (returnType: string) =>
    rows.some((r) => {
      if ((r.return_type || "").toUpperCase() !== returnType) return false;
      if ((r.status || "").toLowerCase() !== "filed") return false;
      const monthIdx = MONTH_INDEX[(r.tax_period || "").toLowerCase()];
      if (monthIdx !== targetMonth) return false;
      const fy = (r.financial_year || "").replace(/\s/g, "");
      return fy === fyString || fy.startsWith(`${fyStartYear}-`);
    });

  return matches("GSTR3B") || matches("GSTR1");
}

function formatDateDMY(value?: string): string {
  if (!value) return "-";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Keep one row per (financial_year + tax_period), preferring GSTR3B over GSTR1.
 */
function dedupeByPeriod(rows: FilingStatusRow[]): FilingStatusRow[] {
  const priority: Record<string, number> = { GSTR3B: 0, GSTR1: 1 };
  const byKey = new Map<string, FilingStatusRow>();
  for (const r of rows) {
    const key = `${r.financial_year || ""}|${r.tax_period || ""}`;
    const existing = byKey.get(key);
    if (!existing) { byKey.set(key, r); continue; }
    const pNew = priority[(r.return_type || "").toUpperCase()] ?? 99;
    const pOld = priority[(existing.return_type || "").toUpperCase()] ?? 99;
    if (pNew < pOld) byKey.set(key, r);
  }
  return Array.from(byKey.values());
}

export function GstFilingStatusTable({ rows, limit }: { rows: FilingStatusRow[]; limit?: number }) {
  if (!rows || rows.length === 0) return null;

  const sortedAll = dedupeByPeriod(rows).sort((a, b) => {
    const da = a.date_of_filing || "";
    const db = b.date_of_filing || "";
    return db.localeCompare(da);
  });
  const sorted = typeof limit === "number" ? sortedAll.slice(0, limit) : sortedAll;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b bg-muted/40">
        <h4 className="text-sm font-semibold">GST Return Filing Status</h4>
        <p className="text-xs text-muted-foreground">Latest returns reported by the GST registry</p>
      </div>
      <div className="max-h-72 overflow-auto">
        <Table className="[&_th]:border [&_td]:border [&_th]:text-center [&_td]:text-center">
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead className="text-xs font-semibold text-foreground">Financial Year</TableHead>
              <TableHead className="text-xs font-semibold text-foreground">Tax Period</TableHead>
              <TableHead className="text-xs font-semibold text-foreground">Date of filing</TableHead>
              <TableHead className="text-xs font-semibold text-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r, i) => {
              const filed = (r.status || "").toLowerCase() === "filed";
              return (
                <TableRow key={i}>
                  <TableCell className="text-xs">{r.financial_year || "-"}</TableCell>
                  <TableCell className="text-xs">{r.tax_period || "-"}</TableCell>
                  <TableCell className="text-xs">{formatDateDMY(r.date_of_filing)}</TableCell>
                  <TableCell className={`text-xs font-medium ${filed ? "" : "text-destructive"}`}>
                    {r.status || "-"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
