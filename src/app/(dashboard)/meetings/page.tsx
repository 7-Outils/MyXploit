"use client";

import { Calendar, Plus, MapPin, Users, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";

const meetings = [
  {
    id: 1,
    title: "Réunion exploitation Q4",
    date: "15/12/2024",
    time: "14:00",
    location: "Mairie centrale",
    participants: 8,
    type: "reunion",
  },
  {
    id: 2,
    title: "Visite technique Lycée Voltaire",
    date: "18/12/2024",
    time: "09:30",
    location: "Lycée Voltaire",
    participants: 3,
    type: "visite",
  },
  {
    id: 3,
    title: "Point mensuel ENGIE",
    date: "20/12/2024",
    time: "10:00",
    location: "Visioconférence",
    participants: 5,
    type: "reunion",
  },
];

const recentReports = [
  {
    id: 1,
    title: "CR Réunion exploitation Q3",
    date: "15/09/2024",
    actions: 5,
    completed: 4,
  },
  {
    id: 2,
    title: "Visite Complexe sportif",
    date: "22/11/2024",
    actions: 3,
    completed: 2,
  },
];

export default function MeetingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">
            Réunions & Visites
          </h1>
          <p className="text-text-secondary">
            Planifiez vos réunions et suivez les actions
          </p>
        </div>
        <Button>
          <Plus size={18} className="mr-2" />
          Planifier
        </Button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Réunions planifiées"
          value="3"
          change="Ce mois"
          changeType="neutral"
          icon={Calendar}
          iconColor="text-accent"
        />
        <StatsCard
          title="Visites terrain"
          value="12"
          change="Ce trimestre"
          changeType="neutral"
          icon={MapPin}
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Actions en cours"
          value="8"
          change="3 en retard"
          changeType="negative"
          icon={Clock}
          iconColor="text-yellow-600"
        />
        <StatsCard
          title="Participants"
          value="24"
          icon={Users}
          iconColor="text-green-600"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming */}
        <ChartCard title="À venir">
          <div className="space-y-4">
            {meetings.map((meeting) => (
              <div
                key={meeting.id}
                className="flex items-start gap-4 p-4 bg-background-secondary rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    meeting.type === "reunion"
                      ? "bg-accent/10"
                      : "bg-blue-100"
                  }`}
                >
                  {meeting.type === "reunion" ? (
                    <Calendar size={20} className="text-accent" />
                  ) : (
                    <MapPin size={20} className="text-blue-600" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-primary-dark">
                    {meeting.title}
                  </p>
                  <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {meeting.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={14} />
                      {meeting.time}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
                    <span className="flex items-center gap-1">
                      <MapPin size={14} />
                      {meeting.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={14} />
                      {meeting.participants}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Recent reports */}
        <ChartCard
          title="Comptes-rendus récents"
          action={
            <button className="text-sm text-accent hover:underline">
              Voir tous
            </button>
          }
        >
          <div className="space-y-4">
            {recentReports.map((report) => (
              <div
                key={report.id}
                className="p-4 bg-background-secondary rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-primary-dark">{report.title}</p>
                  <span className="text-sm text-text-secondary">
                    {report.date}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full"
                      style={{
                        width: `${(report.completed / report.actions) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm text-text-secondary">
                    {report.completed}/{report.actions} actions
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
