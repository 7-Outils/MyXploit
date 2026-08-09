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
  PROSPECT: { label: "Pipeline", color: "bg-white text-ink/60 border border-ink/20" },
  ACTIVE: { label: "Active", color: "bg-green-50 text-green-700 border border-green-600/20" },
  EN_PAUSE: { label: "En pause", color: "bg-amber-50 text-amber-700 border border-amber-600/20" },
  TERMINEE: { label: "Terminee", color: "bg-white text-ink/50 border border-ink/15" },
  ANNULEE: { label: "Annulee", color: "bg-red-50 text-red-700 border border-red-600/20" },
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
      <div className="flex items-center justify-between border-b border-ink/10 pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-ink">
            <FolderKanban size={18} className="text-ink/40" />
            Missions
          </h1>
          <p className="mt-1 text-sm text-ink/50">
            <span className="font-mono tabular-nums">{missions.length}</span> mission(s)
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-ink px-4 py-2 text-sm text-paper transition-colors hover:bg-accent"
        >
          <Plus size={16} />
          Nouvelle mission
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Status tabs */}
        <div className="flex w-fit items-center border border-ink/10 divide-x divide-ink/10">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === tab.key
                  ? "bg-accent/5 text-accent"
                  : "text-ink/60 hover:bg-ink/[0.02] hover:text-ink"
              }`}
            >
              {tab.label} (<span className="font-mono tabular-nums">{tab.count}</span>)
            </button>
          ))}
        </div>

        {/* Search + type filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une mission..."
              className="w-full border border-ink/20 bg-white py-2 pl-10 pr-3 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
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
        <div className="panel py-16 text-center">
          <FolderKanban size={32} className="mx-auto mb-4 text-ink/20" />
          <h3 className="mb-2 text-sm font-semibold text-ink">Aucune mission</h3>
          <p className="mb-4 text-sm text-ink/50">Commencez par creer votre premiere mission</p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 bg-ink px-4 py-2 text-sm text-paper transition-colors hover:bg-accent"
          >
            <Plus size={16} />
            Nouvelle mission
          </button>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-ink/10 bg-white">
                <tr>
                  <th className="label-tech whitespace-nowrap px-4 py-2.5 text-left">Reference</th>
                  <th className="label-tech whitespace-nowrap px-4 py-2.5 text-left">Mission</th>
                  <th className="label-tech whitespace-nowrap px-4 py-2.5 text-left">Client</th>
                  <th className="label-tech whitespace-nowrap px-4 py-2.5 text-left">Type</th>
                  <th className="label-tech whitespace-nowrap px-4 py-2.5 text-center">Statut</th>
                  <th className="label-tech whitespace-nowrap px-4 py-2.5 text-left">Ingenieur(s)</th>
                  <th className="label-tech whitespace-nowrap px-4 py-2.5 text-center">Livrables</th>
                  <th className="label-tech whitespace-nowrap px-4 py-2.5 text-right">Montant HT</th>
                  <th className="label-tech whitespace-nowrap px-4 py-2.5 text-right">Echeance</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {filtered.map((m) => {
                  const statusCfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.ACTIVE;
                  return (
                    <tr
                      key={m.id}
                      onClick={() => router.push(`/missions/${m.id}`)}
                      className="cursor-pointer transition-colors hover:bg-ink/[0.02]"
                    >
                      <td className="px-4 py-2.5 font-mono text-sm tabular-nums text-ink/50">{m.reference}</td>
                      <td className="px-4 py-2.5">
                        <p className="max-w-[200px] truncate text-sm font-medium text-ink">{m.title}</p>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-ink/80">{m.client.name}</td>
                      <td className="px-4 py-2.5">
                        <span className="border border-ink/15 px-2 py-0.5 text-xs text-ink/70">
                          {m.missionType.name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 text-xs font-medium ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-ink/80">
                        {m.engineers.length === 0 ? (
                          <span className="text-ink/30">-</span>
                        ) : (
                          m.engineers.map((e) =>
                            `${e.user.firstName || ""} ${e.user.lastName || ""}`.trim() || e.user.email
                          ).join(", ")
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-mono text-sm tabular-nums text-ink/80">
                            {m.deliverableStats.completed}/{m.deliverableStats.total}
                          </span>
                          {m.deliverableStats.overdue > 0 && (
                            <span className="flex items-center gap-0.5 font-mono text-xs tabular-nums text-red-600">
                              <AlertTriangle size={12} />
                              {m.deliverableStats.overdue}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums text-ink">
                        {m.amountHT ? `${m.amountHT.toLocaleString("fr-FR")} €` : "-"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums text-ink/50">
                        {m.endDate ? new Date(m.endDate).toLocaleDateString("fr-FR") : "-"}
                      </td>
                      <td className="px-4 py-2.5">
                        <ChevronRight size={16} className="text-ink/30" />
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
        <div className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto border border-ink/10 bg-white shadow-large">
            <div className="panel-header">
              <h2 className="label-tech">Nouvelle mission</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 text-ink/50 hover:bg-ink/[0.03] hover:text-accent">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 p-4">
              {createError && (
                <div className="border border-red-600/20 bg-red-50 p-3 text-sm text-red-700">{createError}</div>
              )}

              {/* Client */}
              <div>
                <label className="label-tech mb-1 block">Client *</label>
                <select
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="">Selectionner un client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="label-tech mb-1 block">Type de mission *</label>
                <select
                  value={form.missionTypeId}
                  onChange={(e) => setForm({ ...form, missionTypeId: e.target.value })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="">Selectionner un type</option>
                  {missionTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Titre */}
              <div>
                <label className="label-tech mb-1 block">Titre *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex: Suivi contrat chauffage Mairie de Lyon"
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="label-tech mb-1 block">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full resize-none border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </div>

              {/* Statut */}
              <div>
                <label className="label-tech mb-1 block">Statut</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="PROSPECT">Pipeline (en negociation)</option>
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-tech mb-1 block">Date debut</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm tabular-nums focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="label-tech mb-1 block">Date fin</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm tabular-nums focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              {/* Montant + facturation */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-tech mb-1 block">Montant HT (€)</label>
                  <input
                    type="number"
                    value={form.amountHT}
                    onChange={(e) => setForm({ ...form, amountHT: e.target.value })}
                    placeholder="0"
                    className="w-full border border-ink/20 bg-white px-3 py-2 font-mono text-sm tabular-nums focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="label-tech mb-1 block">Facturation</label>
                  <select
                    value={form.billingModality}
                    onChange={(e) => setForm({ ...form, billingModality: e.target.value })}
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
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
                <label className="label-tech mb-1 block">Ingenieur(s) affecte(s)</label>
                <div className="max-h-32 space-y-1 overflow-y-auto border border-ink/20 p-2">
                  {teamMembers.map((m) => (
                    <label key={m.id} className="flex cursor-pointer items-center gap-2 px-2 py-1 hover:bg-ink/[0.02]">
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
                        className="border-ink/30 accent-accent"
                      />
                      <span className="text-sm text-ink/80">
                        {m.firstName || ""} {m.lastName || ""} {!m.firstName && !m.lastName ? m.email : ""}
                      </span>
                    </label>
                  ))}
                  {teamMembers.length === 0 && (
                    <p className="py-2 text-center text-xs text-ink/40">Aucun ingenieur dans l&apos;equipe</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-ink/10 p-4">
              <button
                onClick={() => setShowCreate(false)}
                className="border border-ink/20 px-4 py-2 text-sm text-ink transition-colors hover:border-accent hover:text-accent"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-2 bg-ink px-4 py-2 text-sm text-paper transition-colors hover:bg-accent disabled:opacity-50"
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
