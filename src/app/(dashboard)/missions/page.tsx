"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FolderKanban,
  Plus,
  Search,
  Loader2,
  X,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";

interface MissionType {
  id: string;
  name: string;
}

interface Mission {
  id: string;
  reference: string;
  title: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  amountHT: number | null;
  billingModality: string | null;
  client: { id: string; name: string };
  missionType: { id: string; name: string };
  engineers: Array<{
    user: { id: string; firstName: string | null; lastName: string | null; email: string };
  }>;
  deliverableStats: { total: number; completed: number; overdue: number };
  _count: { sites: number; contracts: number };
}

interface Client {
  id: string;
  name: string;
}

interface TeamMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PROSPECT: { label: "Pipeline", color: "bg-purple-100 text-purple-700" },
  ACTIVE: { label: "Active", color: "bg-green-100 text-green-700" },
  EN_PAUSE: { label: "En pause", color: "bg-yellow-100 text-yellow-700" },
  TERMINEE: { label: "Terminee", color: "bg-gray-100 text-gray-700" },
  ANNULEE: { label: "Annulee", color: "bg-red-100 text-red-700" },
};

const BILLING_OPTIONS = [
  { value: "FORFAIT", label: "Forfait" },
  { value: "REGIE", label: "Regie" },
  { value: "POURCENTAGE", label: "% travaux" },
  { value: "MIXTE", label: "Mixte" },
];

export default function MissionsPage() {
  const router = useRouter();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [missionTypes, setMissionTypes] = useState<MissionType[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Modal creation
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    missionTypeId: "",
    clientId: "",
    startDate: "",
    endDate: "",
    amountHT: "",
    billingModality: "",
    status: "ACTIVE",
    engineerIds: [] as string[],
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [missionsRes, typesRes, clientsRes, teamRes] = await Promise.all([
          fetch("/api/missions"),
          fetch("/api/mission-types"),
          fetch("/api/clients"),
          fetch("/api/team"),
        ]);

        if (missionsRes.ok) setMissions(await missionsRes.json());
        if (typesRes.ok) setMissionTypes(await typesRes.json());
        if (clientsRes.ok) setClients(await clientsRes.json());
        if (teamRes.ok) {
          const team = await teamRes.json();
          setTeamMembers(team.filter((m: TeamMember) => m.role === "EDITOR" || m.role === "ADMIN"));
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCreate = async () => {
    if (!form.title || !form.missionTypeId || !form.clientId) {
      setCreateError("Le titre, le type et le client sont requis");
      return;
    }

    setCreating(true);
    setCreateError("");

    try {
      const res = await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amountHT: form.amountHT ? parseFloat(form.amountHT) : null,
          billingModality: form.billingModality || null,
        }),
      });

      if (res.ok) {
        const newMission = await res.json();
        router.push(`/missions/${newMission.id}`);
      } else {
        const data = await res.json();
        setCreateError(data.error || "Erreur lors de la creation");
      }
    } catch {
      setCreateError("Erreur reseau");
    } finally {
      setCreating(false);
    }
  };

  const filtered = missions.filter((m) => {
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (typeFilter !== "all" && m.missionType.id !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        m.title.toLowerCase().includes(s) ||
        m.reference.toLowerCase().includes(s) ||
        m.client.name.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const statusTabs = [
    { key: "all", label: "Toutes", count: missions.length },
    { key: "ACTIVE", label: "Actives", count: missions.filter((m) => m.status === "ACTIVE").length },
    { key: "PROSPECT", label: "Pipeline", count: missions.filter((m) => m.status === "PROSPECT").length },
    { key: "TERMINEE", label: "Terminees", count: missions.filter((m) => m.status === "TERMINEE").length },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <FolderKanban size={28} className="text-accent" />
            Missions
          </h1>
          <p className="text-gray-500 mt-1">{missions.length} mission(s)</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90"
        >
          <Plus size={18} />
          Nouvelle mission
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === tab.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Search + type filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une mission..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            <option value="all">Tous les types</option>
            {missionTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <FolderKanban size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">Aucune mission</h3>
          <p className="text-gray-500 mb-4">Commencez par creer votre premiere mission</p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90"
          >
            <Plus size={18} />
            Nouvelle mission
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Reference</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Mission</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Ingenieur(s)</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Livrables</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Montant HT</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Echeance</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const statusCfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.ACTIVE;
                  return (
                    <tr
                      key={m.id}
                      onClick={() => router.push(`/missions/${m.id}`)}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="py-3 px-4 text-sm font-mono text-gray-500">{m.reference}</td>
                      <td className="py-3 px-4">
                        <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{m.title}</p>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">{m.client.name}</td>
                      <td className="py-3 px-4">
                        <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700">
                          {m.missionType.name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {m.engineers.length === 0 ? (
                          <span className="text-gray-400">-</span>
                        ) : (
                          m.engineers.map((e) =>
                            `${e.user.firstName || ""} ${e.user.lastName || ""}`.trim() || e.user.email
                          ).join(", ")
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-sm text-gray-700">
                            {m.deliverableStats.completed}/{m.deliverableStats.total}
                          </span>
                          {m.deliverableStats.overdue > 0 && (
                            <span className="flex items-center gap-0.5 text-xs text-red-600">
                              <AlertTriangle size={12} />
                              {m.deliverableStats.overdue}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-gray-700">
                        {m.amountHT ? `${m.amountHT.toLocaleString("fr-FR")} €` : "-"}
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-gray-500">
                        {m.endDate ? new Date(m.endDate).toLocaleDateString("fr-FR") : "-"}
                      </td>
                      <td className="py-3 px-4">
                        <ChevronRight size={16} className="text-gray-400" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal creation */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Nouvelle mission</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {createError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">{createError}</div>
              )}

              {/* Client */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
                <select
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">Selectionner un client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type de mission *</label>
                <select
                  value={form.missionTypeId}
                  onChange={(e) => setForm({ ...form, missionTypeId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">Selectionner un type</option>
                  {missionTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Titre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex: Suivi contrat chauffage Mairie de Lyon"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
                />
              </div>

              {/* Statut */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="PROSPECT">Pipeline (en negociation)</option>
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date debut</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Montant + facturation */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Montant HT (€)</label>
                  <input
                    type="number"
                    value={form.amountHT}
                    onChange={(e) => setForm({ ...form, amountHT: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Facturation</label>
                  <select
                    value={form.billingModality}
                    onChange={(e) => setForm({ ...form, billingModality: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="">-</option>
                    {BILLING_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ingenieurs */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ingenieur(s) affecte(s)</label>
                <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {teamMembers.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.engineerIds.includes(m.id)}
                        onChange={(e) => {
                          setForm({
                            ...form,
                            engineerIds: e.target.checked
                              ? [...form.engineerIds, m.id]
                              : form.engineerIds.filter((id) => id !== m.id),
                          });
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">
                        {m.firstName || ""} {m.lastName || ""} {!m.firstName && !m.lastName ? m.email : ""}
                      </span>
                    </label>
                  ))}
                  {teamMembers.length === 0 && (
                    <p className="text-xs text-gray-400 py-2 text-center">Aucun ingenieur dans l&apos;equipe</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2"
              >
                {creating && <Loader2 size={14} className="animate-spin" />}
                Creer la mission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
