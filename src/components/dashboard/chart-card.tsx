"use client";

import { cn } from "@/lib/utils";

interface ChartCardProps {
  title?: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  children,
  className,
  action,
}: ChartCardProps) {
  return (
    <div
      className={cn("panel overflow-hidden", className)}
    >
      {(title || action) && (
        <div className="panel-header">
          <div className="min-w-0">
            {title && <h3 className="label-tech truncate">{title}</h3>}
            {subtitle && (
              <p className="mt-0.5 text-xs text-ink/50">{subtitle}</p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
