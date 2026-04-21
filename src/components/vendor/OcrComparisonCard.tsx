import { CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Row {
  label: string;
  ocrValue?: string;
  apiValue?: string;
}

interface OcrComparisonCardProps {
  rows: Row[];
  nameMatchScore?: number;
}

function normalize(v?: string) {
  return (v ?? "").toString().trim().toUpperCase().replace(/\s+/g, " ");
}

export function OcrComparisonCard({ rows, nameMatchScore }: OcrComparisonCardProps) {
  return (
    <div className="rounded-md border bg-muted/30 text-xs">
      <div className="grid grid-cols-[1fr,1fr,1fr] gap-2 px-3 py-2 border-b font-medium text-muted-foreground">
        <span>Field</span>
        <span>From document</span>
        <span>From API</span>
      </div>
      {rows.map((row) => {
        const match =
          row.ocrValue && row.apiValue && normalize(row.ocrValue) === normalize(row.apiValue);
        return (
          <div
            key={row.label}
            className="grid grid-cols-[1fr,1fr,1fr] gap-2 px-3 py-2 border-b last:border-b-0 items-center"
          >
            <span className="text-muted-foreground">{row.label}</span>
            <span className="truncate" title={row.ocrValue}>
              {row.ocrValue || <span className="text-muted-foreground/60">—</span>}
            </span>
            <span className="flex items-center gap-1 truncate" title={row.apiValue}>
              <span className="truncate">
                {row.apiValue || <span className="text-muted-foreground/60">—</span>}
              </span>
              {row.ocrValue && row.apiValue && (
                match ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
                )
              )}
            </span>
          </div>
        );
      })}
      {typeof nameMatchScore === "number" && (
        <div
          className={cn(
            "px-3 py-2 text-xs font-medium",
            nameMatchScore >= 80 ? "text-success" : "text-warning",
          )}
        >
          Name match score: {nameMatchScore}%
        </div>
      )}
    </div>
  );
}
