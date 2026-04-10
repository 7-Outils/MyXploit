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
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Recent Activity */}
      <ChartCard
        title="Activité récente"
        action={
          <button className="text-sm text-accent hover:underline">
            Voir tout
          </button>
        }
      >
        {recentActivities.length === 0 ? (
          <p className="text-center text-text-secondary py-8">
            Aucune activité récente
          </p>
        ) : (
          <div className="space-y-4">
            {recentActivities.slice(0, 4).map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0"
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${activity.iconBg}`}
                >
                  <activity.icon size={18} className={activity.iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary-dark">
                    {activity.title}
                  </p>
                  <p className="text-sm text-text-secondary truncate">
                    {activity.description}
                  </p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {activity.time}
                </span>
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      {/* Quick Actions - Profile specific */}
      <ChartCard title="Actions rapides">
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex flex-col items-center gap-2 p-4 bg-background-secondary rounded-xl hover:bg-gray-100 transition-colors"
            >
              <action.icon size={24} className="text-accent" />
              <span className="text-sm text-text-secondary text-center">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}
