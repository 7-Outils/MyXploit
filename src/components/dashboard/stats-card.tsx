"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  /**
   * Conservé pour compatibilité avec les appelants : l'icône est désormais
   * neutre (ink/40), sans pastille colorée — cette prop est ignorée.
   */
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
        "bg-white p-4 border transition-colors",
        active ? "border-accent ring-1 ring-accent/30" : "border-ink/10",
        isClickable && "cursor-pointer hover:border-accent/40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="label-tech mb-1.5 truncate">{title}</p>
          <p className="font-mono text-xl sm:text-2xl font-semibold tabular-nums text-ink">
            {value}
          </p>
          {change && (
            <p
              className={cn(
                "text-xs mt-1.5 font-medium tabular-nums",
                changeType === "positive" && "text-green-600",
                changeType === "negative" && "text-red-600",
                changeType === "neutral" && "text-ink/50"
              )}
            >
              {changeType === "positive" && "↑ "}
              {changeType === "negative" && "↓ "}
              {change}
            </p>
          )}
        </div>
        {/* Icône nue : plus de pastille colorée (thème bureau d'études) */}
        <Icon className="w-4 h-4 flex-shrink-0 text-ink/40" />
      </div>
    </div>
  );
}
