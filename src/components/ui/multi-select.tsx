import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface MultiSelectOption {
  label: string;
  value: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export const MultiSelect = React.forwardRef<HTMLButtonElement, MultiSelectProps>(
  function MultiSelect(
    { options, selected, onChange, placeholder = "Select options...", className },
    ref
  ) {
    const [open, setOpen] = React.useState(false);

    const handleToggle = (value: string) => {
      const newSelected = selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value];
      onChange(newSelected);
    };

    const handleRemove = (value: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(selected.filter((item) => item !== value));
    };

    const handleClearAll = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange([]);
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            type="button"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-10 h-auto",
              className
            )}
          >
            <div className="flex flex-wrap gap-1 flex-1 text-left">
              {selected.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : selected.length <= 3 ? (
                selected.map((value) => {
                  const option = options.find((opt) => opt.value === value);
                  return (
                    <Badge
                      key={value}
                      variant="secondary"
                      className="mr-1 mb-0.5 font-normal"
                    >
                      {option?.label}
                      <span
                        className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer hover:bg-muted-foreground/20"
                        onClick={(e) => handleRemove(value, e)}
                      >
                        <X className="h-3 w-3" />
                      </span>
                    </Badge>
                  );
                })
              ) : (
                <Badge variant="secondary" className="font-normal">
                  {selected.length} selected
                  <span
                    className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer hover:bg-muted-foreground/20"
                    onClick={handleClearAll}
                  >
                    <X className="h-3 w-3" />
                  </span>
                </Badge>
              )}
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[300px] p-0" align="start">
          <div className="max-h-60 overflow-y-auto p-1">
            {options.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <div
                  key={option.value}
                  className={cn(
                    "flex items-center gap-2 px-2 py-2 cursor-pointer rounded-sm transition-colors",
                    isSelected
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  )}
                  onClick={() => handleToggle(option.value)}
                >
                  <div
                    className={cn(
                      "h-4 w-4 border rounded-sm flex items-center justify-center shrink-0",
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-input"
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <span className="text-sm">{option.label}</span>
                </div>
              );
            })}
          </div>
          {selected.length > 0 && (
            <div className="border-t p-2">
              <button
                type="button"
                className="w-full text-sm text-muted-foreground hover:text-foreground py-1.5 rounded-sm hover:bg-muted transition-colors"
                onClick={handleClearAll}
              >
                Clear all ({selected.length})
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  }
);
