"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import type { RecentActivity } from "../types";

interface QuickAction {
  href: string;
  icon: LucideIcon;
  label: string;
}

interface ActivitySectionProps {
  recentActivities: RecentActivity[];
  quickActions: QuickAction[];
}

export function ActivitySection({
  recentActivities,
  quickActions,
}: ActivitySectionProps) {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {/* Recent Activity */}
      <ChartCard
        title="Activité récente"
        action={
          <button className="font-mono text-[11px] uppercase tracking-widest text-ink underline decoration-ink/30 underline-offset-4 hover:text-accent hover:decoration-accent transition-colors">
            Voir tout
          </button>
        }
      >
        {recentActivities.length === 0 ? (
          <p className="text-center text-sm text-ink/50 py-8">
            Aucune activité récente
          </p>
        ) : (
          <div className="-mx-4 -my-4 divide-y divide-ink/10">
            {recentActivities.slice(0, 4).map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 px-4 py-2.5"
              >
                <activity.icon size={16} className="text-ink/40 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {activity.title}
                  </p>
                  <p className="text-xs text-ink/50 truncate">
                    {activity.description}
                  </p>
                </div>
                <span className="font-mono text-[11px] tabular-nums text-ink/40 flex-shrink-0">
                  {activity.time}
                </span>
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      {/* Quick Actions - Profile specific */}
      <ChartCard title="Actions rapides">
        <div className="-mx-4 -my-4 grid grid-cols-2 divide-x divide-y divide-ink/10 border-t border-ink/10">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group flex flex-col items-center gap-2 px-3 py-4 hover:bg-ink/[0.02] transition-colors"
            >
              <action.icon size={18} className="text-ink/40 group-hover:text-accent transition-colors" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-ink/50 text-center leading-relaxed">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}
