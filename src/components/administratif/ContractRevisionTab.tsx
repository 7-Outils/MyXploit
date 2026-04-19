"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, Plus, Trash2, Pencil, Check, X, Calculator, AlertTriangle, Clock, ArrowDown } from "lucide-react";
import { ReadOnlyGate } from "@/components/permissions";

type PType = "P1" | "P2" | "P3";
type Periodicity = "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL";

interface IndexValue {
  id: string;
  date: string;
  value: number;
  isProvisional: boolean;
}

interface RevisionIndex {
  id: string;
  name: string;
  identifier: string | null;
  values: IndexValue[];
}

interface FormulaComponent {
  id?: string;
  indexId: string;
  coefficient: number;
  baseValue: number;
  reconnectionCoef: number;
  index?: { id: string; name: string };
}

interface Formula {
  id: string;
  pType: PType;
  periodicity: Periodicity;
  baseDate: string;
  constantPart: number;
  roundingDecimals: number;
  components: FormulaComponent[];
}

interface PendingRevision {
  pType: PType;
  periodicity: Periodicity;
  lastAppliedDate: string | null;
  nextDueDate: string;
  isOverdue: boolean;
  indicesReady: boolean;
  missingIndex: string | null;
}

const PERIOD_LABEL: Record<Periodicity, string> = {
  MONTHLY: "Mensuel",
  QUARTERLY: "Trimestriel",
  SEMI_ANNUAL: "Semestriel",
  ANNUAL: "Annuel",
};

export default function ContractRevisionTab({ contractId }: { contractId: string }) {
  const [indices, setIndices] = useState<RevisionIndex[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [pending, setPending] = useState<PendingRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndexId, setSelectedIndexId] = useState<string | null>(null);
  const [applyTarget, setApplyTarget] = useState<{ pType: PType; periodStart: string } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch(`/api/contracts/${contractId}/revision-indices`),
        fetch(`/api/contracts/${contractId}/revision-formulas`),
        fetch(`/api/contracts/${contractId}/revision-pending`),
      ]);
      const idx: RevisionIndex[] = r1.ok ? await r1.json() : [];
      const frm: Formula[] = r2.ok ? await r2.json() : [];
      const pnd: PendingRevision[] = r3.ok ? await r3.json() : [];
      setIndices(idx);
      setFormulas(frm);
      setPending(pnd);
      if (idx.length > 0 && !selectedIndexId) setSelectedIndexId(idx[0].id);
    } finally {
      setLoading(false);
    }
  }, [contractId, selectedIndexId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const selectedIndex = indices.find((i) => i.id === selectedIndexId) ?? null;

  return (
    <div className="space-y-8">
      <PendingSection
        pending={pending}
        onApply={(p) => {
          setApplyTarget({ pType: p.pType, periodStart: p.nextDueDate.slice(0, 10) });
          document.getElementById("revision-apply")?.scrollIntoView({ behavior: "smooth" });
        }}
      />
      <IndicesSection
        contractId={contractId}
        indices={indices}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndexId}
        onChanged={fetchAll}
      />
      <FormulasSection
        contractId={contractId}
        indices={indices}
        formulas={formulas}
        onChanged={fetchAll}
      />
      <ApplySection
        contractId={contractId}
        formulas={formulas}
        indices={indices}
        target={applyTarget}
        onApplied={fetchAll}
      />
    </div>
  );
}

// ============ Section 0 — Révisions à venir ============

function PendingSection({ pending, onApply }: { pending: PendingRevision[]; onApply: (p: PendingRevision) => void }) {
  if (pending.length === 0) return null;

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-primary-dark mb-4 flex items-center gap-2">
        <Clock size={18} />
        Révisions à venir
      </h2>
      <ul className="divide-y divide-gray-100">
        {pending.map((p) => {
          const dueLabel = new Date(p.nextDueDate).toLocaleDateString("fr-FR");
          return (
            <li key={p.pType} className="py-3 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">{p.pType}</span>
                <div className="text-sm text-gray-700">
                  <div>Prochaine révision : <span className="font-medium">{dueLabel}</span></div>
                  <div className="text-xs text-gray-500">
                    {p.lastAppliedDate
                      ? `Dernière révision : ${new Date(p.lastAppliedDate).toLocaleDateString("fr-FR")}`
                      : "Aucune révision appliquée"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {p.isOverdue && (
                  <span className="px-2 py-1 rounded text-xs bg-red-50 text-red-700">En retard</span>
                )}
                {!p.indicesReady ? (
                  <span className="px-2 py-1 rounded text-xs bg-yellow-50 text-yellow-700 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    Indice {p.missingIndex} manquant
                  </span>
                ) : (
                  <ReadOnlyGate>
                    <button
                      onClick={() => onApply(p)}
                      className="px-3 py-1.5 text-sm bg-accent text-white rounded hover:bg-accent/90 flex items-center gap-1"
                    >
                      <ArrowDown size={14} />
                      Appliquer
                    </button>
                  </ReadOnlyGate>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ============ Section A — Indices ============

function IndicesSection({
  contractId, indices, selectedIndex, onSelect, onChanged,
}: {
  contractId: string;
  indices: RevisionIndex[];
  selectedIndex: RevisionIndex | null;
  onSelect: (id: string) => void;
  onChanged: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [newIdentifier, setNewIdentifier] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingIndexId, setEditingIndexId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingIdentifier, setEditingIdentifier] = useState("");

  const [newDate, setNewDate] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newProvisional, setNewProvisional] = useState(false);
  const [addingValue, setAddingValue] = useState(false);
  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editProvisional, setEditProvisional] = useState(false);

  const createIndex = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/revision-indices`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), identifier: newIdentifier.trim() || null }),
      });
      if (res.ok) { setNewName(""); setNewIdentifier(""); onChanged(); }
      else { alert((await res.json()).error ?? "Erreur"); }
    } finally { setCreating(false); }
  };

  const renameIndex = async (id: string) => {
    if (!editingName.trim()) return;
    const res = await fetch(`/api/contracts/${contractId}/revision-indices/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingName.trim(), identifier: editingIdentifier.trim() || null }),
    });
    if (res.ok) { setEditingIndexId(null); onChanged(); }
    else { alert((await res.json()).error ?? "Erreur"); }
  };

  const deleteIndex = async (id: string) => {
    if (!confirm("Supprimer cet indice ? (supprime aussi ses valeurs et les composantes qui l'utilisent)")) return;
    const res = await fetch(`/api/contracts/${contractId}/revision-indices/${id}`, { method: "DELETE" });
    if (res.ok) onChanged();
  };

  const addValue = async () => {
    if (!selectedIndex || !newDate || !newValue) return;
    setAddingValue(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/revision-indices/${selectedIndex.id}/values`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newDate, value: parseFloat(newValue), isProvisional: newProvisional }),
      });
      if (res.ok) { setNewDate(""); setNewValue(""); setNewProvisional(false); onChanged(); }
      else { alert((await res.json()).error ?? "Erreur"); }
    } finally { setAddingValue(false); }
  };

  const saveValue = async (valueId: string) => {
    if (!selectedIndex) return;
    const res = await fetch(`/api/contracts/${contractId}/revision-indices/${selectedIndex.id}/values/${valueId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: editDate, value: parseFloat(editValue), isProvisional: editProvisional }),
    });
    if (res.ok) { setEditingValueId(null); onChanged(); }
    else { alert((await res.json()).error ?? "Erreur"); }
  };

  const deleteValue = async (valueId: string) => {
    if (!selectedIndex) return;
    if (!confirm("Supprimer cette valeur ?")) return;
    const res = await fetch(`/api/contracts/${contractId}/revision-indices/${selectedIndex.id}/values/${valueId}`, { method: "DELETE" });
    if (res.ok) onChanged();
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-primary-dark mb-4">Indices de révision</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Liste indices */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Indices</span>
          </div>
          <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {indices.length === 0 && (
              <li className="px-4 py-6 text-sm text-text-secondary text-center">Aucun indice</li>
            )}
            {indices.map((i) => (
              <li key={i.id} className={`px-4 py-2 flex items-start justify-between gap-2 cursor-pointer ${selectedIndex?.id === i.id ? "bg-accent/5" : "hover:bg-gray-50"}`} onClick={() => onSelect(i.id)}>
                {editingIndexId === i.id ? (
                  <div className="flex-1 space-y-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") renameIndex(i.id); if (e.key === "Escape") setEditingIndexId(null); }}
                      placeholder="Nom"
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                    />
                    <input
                      value={editingIdentifier}
                      onChange={(e) => setEditingIdentifier(e.target.value)}
                      placeholder="Identifiant INSEE (ex: 001710973)"
                      className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                    />
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{i.name}</div>
                    {i.identifier && <div className="text-xs text-gray-500 truncate">Id. {i.identifier}</div>}
                  </div>
                )}
                <ReadOnlyGate>
                  <div className="flex items-center gap-1">
                    {editingIndexId === i.id ? (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); renameIndex(i.id); }} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setEditingIndexId(null); }} className="p-1 text-gray-500 hover:bg-gray-100 rounded"><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); setEditingIndexId(i.id); setEditingName(i.name); setEditingIdentifier(i.identifier ?? ""); }} className="p-1 text-gray-500 hover:bg-gray-100 rounded"><Pencil size={14} /></button>
                        <button onClick={(e) => { e.stopPropagation(); deleteIndex(i.id); }} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                </ReadOnlyGate>
              </li>
            ))}
          </ul>
          <ReadOnlyGate>
            <div className="border-t border-gray-100 p-3 space-y-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom (ex: BT40 — Chauffage central)" className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
              <div className="flex gap-2">
                <input value={newIdentifier} onChange={(e) => setNewIdentifier(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") createIndex(); }} placeholder="Identifiant INSEE (optionnel)" className="flex-1 text-sm border border-gray-300 rounded px-2 py-1.5" />
                <button onClick={createIndex} disabled={creating || !newName.trim()} className="px-3 py-1.5 bg-accent text-white text-sm rounded hover:bg-accent/90 disabled:opacity-50 flex items-center gap-1">
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Ajouter
                </button>
              </div>
            </div>
          </ReadOnlyGate>
        </div>

        {/* Valeurs */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-700">
              Valeurs {selectedIndex ? `de ${selectedIndex.name}` : ""}
            </span>
          </div>
          {!selectedIndex ? (
            <div className="p-6 text-sm text-text-secondary text-center">Sélectionnez un indice à gauche</div>
          ) : (
            <>
              <ul className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                {selectedIndex.values.length === 0 && (
                  <li className="px-4 py-6 text-sm text-text-secondary text-center">Aucune valeur</li>
                )}
                {selectedIndex.values.map((v) => (
                  <li key={v.id} className="px-4 py-2 flex items-center justify-between gap-2">
                    {editingValueId === v.id ? (
                      <>
                        <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="text-sm border border-gray-300 rounded px-2 py-1 w-32" />
                        <input type="number" step="0.001" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="text-sm border border-gray-300 rounded px-2 py-1 w-20 text-right" />
                        <label className="flex items-center gap-1 text-xs text-gray-600"><input type="checkbox" checked={editProvisional} onChange={(e) => setEditProvisional(e.target.checked)} />Prov.</label>
                        <div className="flex items-center gap-1">
                          <button onClick={() => saveValue(v.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
                          <button onClick={() => setEditingValueId(null)} className="p-1 text-gray-500 hover:bg-gray-100 rounded"><X size={14} /></button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-gray-700">{new Date(v.date).toLocaleDateString("fr-FR")}</span>
                        <div className="flex items-center gap-2 flex-1 justify-end">
                          {v.isProvisional && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">provisoire</span>}
                          <span className="text-sm font-medium">{v.value}</span>
                        </div>
                        <ReadOnlyGate>
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditingValueId(v.id); setEditDate(v.date.slice(0, 10)); setEditValue(String(v.value)); setEditProvisional(v.isProvisional); }} className="p-1 text-gray-500 hover:bg-gray-100 rounded"><Pencil size={14} /></button>
                            <button onClick={() => deleteValue(v.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                          </div>
                        </ReadOnlyGate>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <ReadOnlyGate>
                <div className="border-t border-gray-100 p-3 space-y-2">
                  <div className="flex gap-2">
                    <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="text-sm border border-gray-300 rounded px-2 py-1.5 w-36" />
                    <input type="number" step="0.001" value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Valeur" className="text-sm border border-gray-300 rounded px-2 py-1.5 flex-1" />
                    <button onClick={addValue} disabled={addingValue || !newDate || !newValue} className="px-3 py-1.5 bg-accent text-white text-sm rounded hover:bg-accent/90 disabled:opacity-50 flex items-center gap-1">
                      {addingValue ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" checked={newProvisional} onChange={(e) => setNewProvisional(e.target.checked)} />
                    Valeur provisoire (à confirmer ensuite)
                  </label>
                </div>
              </ReadOnlyGate>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// ============ Section B — Formules ============

function FormulasSection({
  contractId, indices, formulas, onChanged,
}: {
  contractId: string;
  indices: RevisionIndex[];
  formulas: Formula[];
  onChanged: () => void;
}) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-primary-dark mb-4">Formules de révision</h2>
      {indices.length === 0 ? (
        <p className="text-sm text-text-secondary">Ajoutez d'abord au moins un indice ci-dessus avant de définir une formule.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["P1", "P2", "P3"] as const).map((p) => (
            <FormulaCard
              key={p}
              pType={p}
              contractId={contractId}
              indices={indices}
              existing={formulas.find((f) => f.pType === p) ?? null}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function FormulaCard({
  pType, contractId, indices, existing, onChanged,
}: {
  pType: PType;
  contractId: string;
  indices: RevisionIndex[];
  existing: Formula | null;
  onChanged: () => void;
}) {
  const [enabled, setEnabled] = useState<boolean>(!!existing);
  const [periodicity, setPeriodicity] = useState<Periodicity>(existing?.periodicity ?? "ANNUAL");
  const [baseDate, setBaseDate] = useState<string>(existing?.baseDate?.slice(0, 10) ?? "");
  const [constantPart, setConstantPart] = useState<string>(String(existing?.constantPart ?? 0));
  const [roundingDecimals, setRoundingDecimals] = useState<string>(String(existing?.roundingDecimals ?? 4));
  const [components, setComponents] = useState<FormulaComponent[]>(
    existing?.components.map((c) => ({ ...c, indexId: c.index?.id ?? c.indexId, reconnectionCoef: c.reconnectionCoef ?? 1 })) ?? []
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(!!existing);
    setPeriodicity(existing?.periodicity ?? "ANNUAL");
    setBaseDate(existing?.baseDate?.slice(0, 10) ?? "");
    setConstantPart(String(existing?.constantPart ?? 0));
    setRoundingDecimals(String(existing?.roundingDecimals ?? 4));
    setComponents(existing?.components.map((c) => ({ ...c, indexId: c.index?.id ?? c.indexId, reconnectionCoef: c.reconnectionCoef ?? 1 })) ?? []);
  }, [existing]);

  const sum = useMemo(() => {
    const c = parseFloat(constantPart) || 0;
    return c + components.reduce((s, x) => s + (Number(x.coefficient) || 0), 0);
  }, [constantPart, components]);

  const formulaText = useMemo(() => {
    const parts: string[] = [];
    const cst = parseFloat(constantPart) || 0;
    if (cst !== 0) parts.push(cst.toString());
    for (const c of components) {
      const idx = indices.find((i) => i.id === c.indexId);
      const name = idx?.name ?? "?";
      const coef = Number(c.coefficient) || 0;
      const base = Number(c.baseValue) || 0;
      const recon = Number(c.reconnectionCoef) || 1;
      const ratioStr = recon !== 1 ? `(${name} × ${recon})/${base}` : `${name}/${base}`;
      parts.push(`${coef} × ${ratioStr}`);
    }
    if (parts.length === 0) return `${pType}ₙ = ${pType}₀`;
    return `${pType}ₙ = ${pType}₀ × ( ${parts.join(" + ")} )`;
  }, [pType, constantPart, components, indices]);

  const save = async () => {
    setSaving(true);
    try {
      const body = enabled
        ? {
            pType,
            enabled: true,
            periodicity,
            baseDate,
            constantPart: parseFloat(constantPart) || 0,
            roundingDecimals: parseInt(roundingDecimals, 10) || 4,
            components: components.map((c) => ({
              indexId: c.indexId,
              coefficient: Number(c.coefficient) || 0,
              baseValue: Number(c.baseValue) || 0,
              reconnectionCoef: Number(c.reconnectionCoef) || 1,
            })),
          }
        : { pType, enabled: false };
      const res = await fetch(`/api/contracts/${contractId}/revision-formulas`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) onChanged();
      else alert((await res.json()).error ?? "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-primary-dark">{pType}</h3>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Activer
        </label>
      </div>
      {enabled && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Périodicité</label>
              <select value={periodicity} onChange={(e) => setPeriodicity(e.target.value as Periodicity)} className="w-full text-sm border border-gray-300 rounded px-2 py-1.5">
                {(Object.keys(PERIOD_LABEL) as Periodicity[]).map((p) => (
                  <option key={p} value={p}>{PERIOD_LABEL[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Arrondi K (déc.)</label>
              <input type="number" min="0" max="10" step="1" value={roundingDecimals} onChange={(e) => setRoundingDecimals(e.target.value)} className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Date de base (I_0)</label>
            <input type="date" value={baseDate} onChange={(e) => setBaseDate(e.target.value)} className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Partie constante</label>
            <input type="number" step="0.01" value={constantPart} onChange={(e) => setConstantPart(e.target.value)} className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-gray-600">Composantes (indice / coef / I₀ / raccord.)</label>
            {components.map((c, i) => (
              <div key={i} className="flex items-center gap-1">
                <select
                  value={c.indexId}
                  onChange={(e) => setComponents((prev) => prev.map((x, j) => j === i ? { ...x, indexId: e.target.value } : x))}
                  className="text-xs border border-gray-300 rounded px-1 py-1 flex-1 min-w-0"
                >
                  <option value="">— Indice —</option>
                  {indices.map((idx) => <option key={idx.id} value={idx.id}>{idx.name}</option>)}
                </select>
                <input
                  type="number" step="0.01" value={c.coefficient}
                  onChange={(e) => setComponents((prev) => prev.map((x, j) => j === i ? { ...x, coefficient: parseFloat(e.target.value) || 0 } : x))}
                  className="text-xs border border-gray-300 rounded px-1 py-1 w-12 text-right" title="Coefficient"
                />
                <input
                  type="number" step="0.001" value={c.baseValue}
                  onChange={(e) => setComponents((prev) => prev.map((x, j) => j === i ? { ...x, baseValue: parseFloat(e.target.value) || 0 } : x))}
                  className="text-xs border border-gray-300 rounded px-1 py-1 w-14 text-right" title="I₀"
                />
                <input
                  type="number" step="0.001" value={c.reconnectionCoef}
                  onChange={(e) => setComponents((prev) => prev.map((x, j) => j === i ? { ...x, reconnectionCoef: parseFloat(e.target.value) || 1 } : x))}
                  className="text-xs border border-gray-300 rounded px-1 py-1 w-12 text-right" title="Coef. raccordement (changement de base INSEE, défaut 1)"
                />
                <button onClick={() => setComponents((prev) => prev.filter((_, j) => j !== i))} className="p-1 text-red-500 hover:bg-red-50 rounded">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <button
              onClick={() => setComponents((prev) => [...prev, { indexId: "", coefficient: 0, baseValue: 0, reconnectionCoef: 1 }])}
              className="w-full text-xs border border-dashed border-gray-300 rounded py-1.5 text-gray-500 hover:bg-gray-50"
            >
              + Composante
            </button>
          </div>

          <div className="text-xs font-mono bg-gray-50 border border-gray-200 rounded p-2 text-gray-700 break-words">
            {formulaText}
          </div>

          <div className={`text-xs px-2 py-1 rounded ${Math.abs(sum - 1) < 0.001 ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
            Somme : {sum.toFixed(3)} {Math.abs(sum - 1) < 0.001 ? "✓" : "⚠ devrait être 1"}
          </div>
        </>
      )}

      <ReadOnlyGate>
        <button onClick={save} disabled={saving} className="w-full px-3 py-2 bg-accent text-white text-sm rounded hover:bg-accent/90 disabled:opacity-50 flex items-center justify-center gap-1">
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          Enregistrer
        </button>
      </ReadOnlyGate>
    </div>
  );
}

// ============ Section C — Appliquer ============

interface PreviewComponent {
  indexId: string;
  indexName: string;
  coefficient: number;
  baseValue: number;
  currentValue: number;
  reconnectionCoef: number;
  isProvisional: boolean;
  valueDate: string;
  ratio: number;
}

interface PreviewResult {
  preview: boolean;
  pType: PType;
  periodStart: string;
  K: number;
  Kraw: number;
  roundingDecimals: number;
  constantPart: number;
  components: PreviewComponent[];
  sites: { contractSiteId: string; siteName: string; base: number; before: number; after: number; delta: number }[];
  hasProvisionalIndex: boolean;
}

function ApplySection({
  contractId, formulas, indices, target, onApplied,
}: {
  contractId: string;
  formulas: Formula[];
  indices: RevisionIndex[];
  target: { pType: PType; periodStart: string } | null;
  onApplied: () => void;
}) {
  void indices;
  const availablePTypes = formulas.map((f) => f.pType);
  const [pType, setPType] = useState<PType | "">(availablePTypes[0] ?? "");
  const [periodStart, setPeriodStart] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (availablePTypes.length > 0 && !availablePTypes.includes(pType as PType)) {
      setPType(availablePTypes[0]);
    }
  }, [availablePTypes, pType]);

  useEffect(() => {
    if (target) {
      setPType(target.pType);
      setPeriodStart(target.periodStart);
      setPreview(null);
    }
  }, [target]);

  const computePreview = async () => {
    if (!pType || !periodStart) return;
    setLoading(true); setPreview(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}/apply-revision?preview=1`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pType, periodStart }),
      });
      if (res.ok) setPreview(await res.json());
      else alert((await res.json()).error ?? "Erreur");
    } finally { setLoading(false); }
  };

  const apply = async () => {
    if (!pType || !periodStart) return;
    if (!confirm(`Appliquer la révision ${pType} au ${new Date(periodStart).toLocaleDateString("fr-FR")} ?`)) return;
    setApplying(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/apply-revision`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pType, periodStart }),
      });
      if (res.ok) {
        alert("Révision appliquée");
        setPreview(null);
        onApplied();
      } else {
        alert((await res.json()).error ?? "Erreur");
      }
    } finally { setApplying(false); }
  };

  if (formulas.length === 0) {
    return (
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-primary-dark mb-2">Appliquer une révision</h2>
        <p className="text-sm text-text-secondary">Définissez d'abord une formule pour pouvoir appliquer une révision.</p>
      </section>
    );
  }

  return (
    <section id="revision-apply" className="bg-white rounded-xl border border-gray-200 p-6 scroll-mt-20">
      <h2 className="text-lg font-semibold text-primary-dark mb-4">Appliquer une révision</h2>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="text-xs text-gray-600 block mb-1">P</label>
          <select value={pType} onChange={(e) => setPType(e.target.value as PType)} className="text-sm border border-gray-300 rounded px-2 py-1.5">
            {availablePTypes.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Date de la période</label>
          <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="text-sm border border-gray-300 rounded px-2 py-1.5" />
        </div>
        <button onClick={computePreview} disabled={loading || !pType || !periodStart} className="h-9 px-3 border border-gray-300 text-sm rounded hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Calculator size={14} />}
          Calculer
        </button>
      </div>

      {preview && (
        <div className="space-y-4">
          {preview.hasProvisionalIndex && (
            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              <AlertTriangle size={14} />
              Au moins un indice utilisé est <strong>provisoire</strong>. Une régularisation sera probablement nécessaire.
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
            <div className="text-xs text-gray-600 uppercase tracking-wider">Détail du calcul</div>
            <div className="font-mono text-sm text-gray-800">
              K = {preview.constantPart}
              {preview.components.map((c, i) => (
                <span key={i}>
                  {" + "}
                  {c.coefficient} × ({c.indexName} {new Date(c.valueDate).toLocaleDateString("fr-FR")} : {c.currentValue}
                  {c.reconnectionCoef !== 1 ? ` × ${c.reconnectionCoef}` : ""}
                  {c.isProvisional ? " [prov.]" : ""}
                  ) / {c.baseValue}
                </span>
              ))}
            </div>
            <div className="font-mono text-sm text-gray-800">
              K = {preview.Kraw.toFixed(8)} <span className="text-gray-500">→ arrondi à {preview.roundingDecimals} décimales →</span>{" "}
              <span className="font-semibold">{preview.K.toFixed(preview.roundingDecimals)}</span>
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Site</th>
                  <th className="px-3 py-2 text-right">Base P₀</th>
                  <th className="px-3 py-2 text-right">Avant</th>
                  <th className="px-3 py-2 text-right">Après (P₀ × K)</th>
                  <th className="px-3 py-2 text-right">Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.sites.map((s) => (
                  <tr key={s.contractSiteId}>
                    <td className="px-3 py-2">{s.siteName}</td>
                    <td className="px-3 py-2 text-right">{s.base.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €</td>
                    <td className="px-3 py-2 text-right">{s.before.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €</td>
                    <td className="px-3 py-2 text-right font-medium">{s.after.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €</td>
                    <td className={`px-3 py-2 text-right ${s.delta >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {s.delta >= 0 ? "+" : ""}{s.delta.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ReadOnlyGate>
            <button onClick={apply} disabled={applying} className="px-4 py-2 bg-accent text-white text-sm rounded hover:bg-accent/90 disabled:opacity-50 flex items-center gap-1">
              {applying ? <Loader2 size={14} className="animate-spin" /> : null}
              Valider et appliquer
            </button>
          </ReadOnlyGate>
        </div>
      )}
    </section>
  );
}
