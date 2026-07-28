import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { useEnsureSapMaster, SapMasterRow } from "@/hooks/useSapMasterData";

interface Props {
  label: string;
  required?: boolean;
  masterType: string;
  value: string[];
  onChange: (v: string[]) => void;
  errorText?: string;
  selectPlaceholder?: string;
}

const toOptions = (rows: SapMasterRow[] | undefined) =>
  (rows || []).map((r) => ({
    value: r.code,
    label: r.description || r.code,
  }));

export function ClassificationField({
  label,
  required,
  masterType,
  value,
  onChange,
  errorText,
  selectPlaceholder = "Select…",
}: Props) {
  const { rows, fetching, errorMessage, retry } = useEnsureSapMaster(masterType);
  const isEmpty = !fetching && !errorMessage && (!rows || rows.length === 0);

  return (
    <div className="grid gap-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>

      <div className={fetching || !!errorMessage || isEmpty ? "opacity-60 pointer-events-none" : ""}>
        <MultiSelect
          options={toOptions(rows)}
          selected={value || []}
          onChange={onChange}
          placeholder={
            fetching
              ? "Classification data fetching…"
              : errorMessage
              ? "Classification fetch failed"
              : isEmpty
              ? "No SAP values — click Sync now"
              : selectPlaceholder
          }
          className={errorText ? "border-destructive" : ""}
        />
      </div>

      {errorText && <p className="text-xs text-destructive">{errorText}</p>}

      {fetching && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          Classification data fetching…
        </p>
      )}

      {!fetching && errorMessage && (
        <div className="text-xs text-destructive flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p>Classification fetch failed — {errorMessage}</p>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={retry}
            >
              <RefreshCw className="h-3 w-3 mr-1" /> Retry
            </Button>
          </div>
        </div>
      )}

      {isEmpty && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span>No SAP values returned.</span>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={retry}
          >
            <RefreshCw className="h-3 w-3 mr-1" /> Sync now
          </Button>
        </div>
      )}
    </div>
  );
}
