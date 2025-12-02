"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  Plus,
  MapPin,
  Users,
  Clock,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";

interface Site {
  id: string;
  name: string;
}

interface Meeting {
  id: string;
  title: string;
  type: "REUNION" | "VISITE" | "AUDIT" | "FORMATION";
  date: string;
  location: string | null;
  notes: string | null;
  site: Site | null;
  createdAt: string;
}

const typeConfig = {
  REUNION: {
    label: "Réunion",
    color: "bg-accent/10",
    iconColor: "text-accent",
  },
  VISITE: {
    label: "Visite",
    color: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  AUDIT: {
    label: "Audit",
    color: "bg-yellow-100",
    iconColor: "text-yellow-600",
  },
  FORMATION: {
    label: "Formation",
    color: "bg-green-100",
    iconColor: "text-green-600",
  },
};

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    type: "REUNION",
    date: "",
    location: "",
    notes: "",
    siteId: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [meetingsRes, sitesRes] = await Promise.all([
        fetch("/api/meetings"),
        fetch("/api/sites"),
      ]);
      const [meetingsData, sitesData] = await Promise.all([
        meetingsRes.json(),
        sitesRes.json(),
      ]);
      setMeetings(meetingsData);
      setSites(sitesData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        await fetchData();
        setShowModal(false);
        setFormData({
          title: "",
          type: "REUNION",
          date: "",
          location: "",
          notes: "",
          siteId: "",
        });
      }
    } catch (error) {
      console.error("Error creating meeting:", error);
    } finally {
      setCreating(false);
    }
  };

  const upcomingMeetings = meetings.filter(
    (m) => new Date(m.date) >= new Date()
  );
  const pastMeetings = meetings.filter((m) => new Date(m.date) < new Date());
  const visitesCount = meetings.filter((m) => m.type === "VISITE").length;
  const reunionsCount = meetings.filter((m) => m.type === "REUNION").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

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
        <Button onClick={() => setShowModal(true)}>
          <Plus size={18} className="mr-2" />
          Planifier
        </Button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Réunions planifiées"
          value={upcomingMeetings.length.toString()}
          icon={Calendar}
          iconColor="text-accent"
        />
        <StatsCard
          title="Visites terrain"
          value={visitesCount.toString()}
          icon={MapPin}
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Réunions passées"
          value={pastMeetings.length.toString()}
          icon={Clock}
          iconColor="text-yellow-600"
        />
        <StatsCard
          title="Total réunions"
          value={reunionsCount.toString()}
          icon={Users}
          iconColor="text-green-600"
        />
      </div>

      {meetings.length === 0 ? (
        <ChartCard title="" className="flex flex-col items-center justify-center py-12">
          <Calendar size={48} className="text-gray-300 mb-4" />
          <p className="text-text-secondary mb-4">Aucune réunion planifiée</p>
          <Button onClick={() => setShowModal(true)}>
            <Plus size={18} className="mr-2" />
            Planifier une réunion
          </Button>
        </ChartCard>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upcoming */}
          <ChartCard title="À venir">
            {upcomingMeetings.length === 0 ? (
              <p className="text-text-secondary text-center py-8">
                Aucune réunion à venir
              </p>
            ) : (
              <div className="space-y-4">
                {upcomingMeetings.map((meeting) => {
                  const typeInfo = typeConfig[meeting.type];
                  return (
                    <div
                      key={meeting.id}
                      className="flex items-start gap-4 p-4 bg-background-secondary rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${typeInfo.color}`}
                      >
                        {meeting.type === "REUNION" ||
                        meeting.type === "FORMATION" ? (
                          <Calendar size={20} className={typeInfo.iconColor} />
                        ) : (
                          <MapPin size={20} className={typeInfo.iconColor} />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-primary-dark">
                          {meeting.title}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
                          <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            {new Date(meeting.date).toLocaleDateString("fr-FR")}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {new Date(meeting.date).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
                          {meeting.location && (
                            <span className="flex items-center gap-1">
                              <MapPin size={14} />
                              {meeting.location}
                            </span>
                          )}
                          {meeting.site && (
                            <span className="flex items-center gap-1">
                              <Users size={14} />
                              {meeting.site.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${typeInfo.color} ${typeInfo.iconColor}`}
                      >
                        {typeInfo.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </ChartCard>

          {/* Past meetings */}
          <ChartCard title="Réunions passées">
            {pastMeetings.length === 0 ? (
              <p className="text-text-secondary text-center py-8">
                Aucune réunion passée
              </p>
            ) : (
              <div className="space-y-4">
                {pastMeetings.slice(0, 5).map((meeting) => {
                  const typeInfo = typeConfig[meeting.type];
                  return (
                    <div
                      key={meeting.id}
                      className="p-4 bg-background-secondary rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-primary-dark">
                          {meeting.title}
                        </p>
                        <span className="text-sm text-text-secondary">
                          {new Date(meeting.date).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.color} ${typeInfo.iconColor}`}
                        >
                          {typeInfo.label}
                        </span>
                        {meeting.site && (
                          <span className="text-sm text-text-secondary">
                            {meeting.site.name}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ChartCard>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">
                Planifier une réunion
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Titre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="Réunion exploitation Q4"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Type *
                  </label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="REUNION">Réunion</option>
                    <option value="VISITE">Visite terrain</option>
                    <option value="AUDIT">Audit</option>
                    <option value="FORMATION">Formation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Site
                  </label>
                  <select
                    value={formData.siteId}
                    onChange={(e) =>
                      setFormData({ ...formData, siteId: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="">Sélectionner un site</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Date et heure *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Lieu
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                    placeholder="Mairie centrale / Visio"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  rows={3}
                  placeholder="Ordre du jour, participants..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowModal(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" className="flex-1" disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      Création...
                    </>
                  ) : (
                    "Planifier"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
