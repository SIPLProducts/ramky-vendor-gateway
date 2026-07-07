import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  className?: string;
}

/**
 * Visual-only page header. Drop into any page above content.
 * Does not manage state or navigation — pure layout.
 */
export function PageHeader({
  title,
  description,
  icon,
  actions,
  breadcrumb,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {breadcrumb && (
            <div className="mb-1 text-xs text-muted-foreground">{breadcrumb}</div>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground truncate">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 md:shrink-0">{actions}</div>
      )}
    </div>
  );
}
