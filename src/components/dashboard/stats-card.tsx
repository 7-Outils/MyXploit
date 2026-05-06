"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconColor?: string;
  /** Quand fourni, la card devient cliquable (cursor pointer + hover renforcé). */
  onClick?: () => void;
  /** Souligne la card quand un filtre est actif dessus. */
  active?: boolean;
}

export function StatsCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  iconColor = "text-accent",
  onClick,
  active,
}: StatsCardProps) {
  const isClickable = typeof onClick === "function";
  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={isClickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } } : undefined}
      className={cn(
        "bg-white rounded-xl p-4 sm:p-6 border transition-all",
        active ? "border-accent ring-2 ring-accent/30" : "border-gray-100",
        isClickable ? "cursor-pointer hover:shadow-md hover:border-accent/40" : "hover:shadow-soft"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm text-text-secondary mb-1 truncate">{title}</p>
          <p className="text-xl sm:text-2xl font-bold text-primary-dark">{value}</p>
          {change && (
            <p
              className={cn(
                "text-xs sm:text-sm mt-1 sm:mt-2 font-medium",
                changeType === "positive" && "text-green-600",
                changeType === "negative" && "text-red-600",
                changeType === "neutral" && "text-text-secondary"
              )}
            >
              {changeType === "positive" && "↑ "}
              {changeType === "negative" && "↓ "}
              {change}
            </p>
          )}
        </div>
        <div
          className={cn(
            "w-9 h-9 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center bg-opacity-10 flex-shrink-0",
            iconColor.replace("text-", "bg-").replace("-600", "-100")
          )}
        >
          <Icon className={cn("w-5 h-5 sm:w-6 sm:h-6", iconColor)} />
        </div>
      </div>
    </div>
  );
}
