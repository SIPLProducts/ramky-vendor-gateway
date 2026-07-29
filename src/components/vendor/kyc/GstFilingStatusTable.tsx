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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * "Latest expected period" = previous calendar month.
 * Returns true only if a GSTR1 row for that period is Filed.
 */
export function isLatestPeriodFiled(rows: FilingStatusRow[]): boolean {
  if (!rows || rows.length === 0) return false;

  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const targetMonth = target.getMonth();
  const targetYear = target.getFullYear();
  const fyStartYear = targetMonth >= 3 ? targetYear : targetYear - 1;
  const fyString = `${fyStartYear}-${fyStartYear + 1}`;

  return rows.some((r) => {
    if ((r.return_type || "").toUpperCase() !== "GSTR1") return false;
    if ((r.status || "").toLowerCase() !== "filed") return false;
    const monthIdx = MONTH_INDEX[(r.tax_period || "").toLowerCase()];
    if (monthIdx !== targetMonth) return false;
    const fy = (r.financial_year || "").replace(/\s/g, "");
    return fy === fyString || fy.startsWith(`${fyStartYear}-`);
  });
}

/**
 * Evaluates GSTR1 compliance with the 11th-of-month grace rule.
 * - Declaration is required only when today's date > 11 AND the previous
 *   month's GSTR1 is not filed.
 * - On or before the 11th, no declaration is required regardless of status,
 *   because the filing due date hasn't passed.
 */
export function evaluateGstr1Compliance(
  rows: FilingStatusRow[],
  now: Date = new Date(),
): { previousMonthFiled: boolean; declarationRequired: boolean; checkedPeriod: string } {
  const target = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthFiled = isLatestPeriodFiled(rows);
  const withinGrace = now.getDate() <= 11;
  return {
    previousMonthFiled,
    declarationRequired: !previousMonthFiled && !withinGrace,
    checkedPeriod: `${MONTH_NAMES[target.getMonth()]} ${target.getFullYear()}`,
  };
}

function formatDateDMY(value?: string): string {
  if (!value) return "-";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Keep one GSTR1 row per (financial_year + tax_period). Non-GSTR1 rows are
 * dropped because the compliance view is GSTR1-only.
 */
function dedupeByPeriod(rows: FilingStatusRow[]): FilingStatusRow[] {
  const byKey = new Map<string, FilingStatusRow>();
  for (const r of rows) {
    if ((r.return_type || "").toUpperCase() !== "GSTR1") continue;
    const key = `${r.financial_year || ""}|${r.tax_period || ""}`;
    if (!byKey.has(key)) byKey.set(key, r);
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

  if (sorted.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div>

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
