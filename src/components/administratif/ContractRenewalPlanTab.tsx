"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import { Loader2, Sparkles, Plus, Trash2, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api, getErrorMessage } from "@/lib/api-client";
import { ReadOnlyGate } from "@/components/permissions";
import {
  Table,
  THead,
  Th,
  TBody,
  Tr,
  Td,
  TableEmpty,
} from "@/components/ui/table";

/**
 * Onglet Renouvellement (fiche contrat) — saisie et import IA du plan
 * de renouvellement contractuel P3 (table contract_renewal_items).
 * Les trames Excel des exploitants n'ont pas de format standard :
 * l'import passe par Gemini, avec relecture/correction avant enregistrement.
 */

interface RenewalItem {
  id: string;
  label: string;
  plannedYear: number;
  amountHT: number;
  status: "PREVU" | "REALISE" | "REPORTE" | "ABANDONNE";
  source: "PLAN_INITIAL" | "AVENANT" | "DEVIS_P3";
  notes: string | null;
  site: { id: string; name: string } | null;
  quote: { id: string; reference: string } | null;
}

interface Proposal {
  include: boolean;
  label: string;
  plannedYear: number;
  amountHT: number;
  siteId: string | null;
  notes: string | null;
}

const STATUS_LABELS: Record<RenewalItem["status"], string> = {
  PREVU: "Prévu",
  REALISE: "Réalisé",
  REPORTE: "Reporté",
  ABANDONNE: "Abandonné",
};

const STATUS_CLASSES: Record<RenewalItem["status"], string> = {
  PREVU: "bg-blue-50 text-blue-700",
  REALISE: "bg-green-50 text-green-700",
  REPORTE: "bg-amber-50 text-amber-700",
  ABANDONNE: "bg-gray-100 text-gray-500 line-through",
};

const SOURCE_LABELS: Record<RenewalItem["source"], string> = {
  PLAN_INITIAL: "Plan initial",
  AVENANT: "Avenant",
  DEVIS_P3: "Devis P3",
};

const euro = (v: number) =>
  v.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";

export default function ContractRenewalPlanTab({
  contractId,
}: {
  contractId: string;
}) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, mutate } = useSWR<{ items: RenewalItem[] }>(
    `/api/contracts/${contractId}/renewal-items`,
    (url: string) => api.get<{ items: RenewalItem[] }>(url)
  );
  const items = data?.items ?? [];

  // Import IA
  const [importOpen, setImportOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [contractSites, setContractSites] = useState<
    { id: string; name: string }[]
  >([]);
  const [fileName, setFileName] = useState("");

  // Suppression
  const [toDelete, setToDelete] = useState<RenewalItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Ajout manuel
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    label: "",
    plannedYear: new Date().getFullYear() + 1,
    amountHT: "",
  });

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setAnalyzing(true);
    setProposals([]);
    try {
      // xlsx est lourd et n'est utile qu'au moment où l'utilisateur dépose un
      // fichier : on le charge ici plutôt qu'au montage de l'onglet.
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      // Toutes les feuilles, en lignes de chaînes (trames non standardisées)
      const rows: string[][] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = XLSX.utils.sheet_to_json<unknown[]>(
          workbook.Sheets[sheetName],
          { header: 1, raw: false, defval: "" }
        );
        if (workbook.SheetNames.length > 1)
          rows.push([`=== Feuille : ${sheetName} ===`]);
        for (const r of sheet) {
          rows.push(r.map((c) => String(c ?? "").slice(0, 500)).slice(0, 60));
        }
      }
      const trimmed = rows.filter((r) => r.some((c) => c.trim())).slice(0, 800);
      if (trimmed.length === 0) {
        toast.error("Fichier vide ou illisible");
        return;
      }

      const result = await api.post<{
        proposals: Array<Omit<Proposal, "include">>;
        sites: { id: string; name: string }[];
      }>(`/api/contracts/${contractId}/renewal-items/import-ai`, {
        rows: trimmed,
      });

      if (result.proposals.length === 0) {
        toast.info(
          "Aucun poste de renouvellement détecté dans ce fichier — vérifiez la feuille ou saisissez manuellement"
        );
        return;
      }
      setContractSites(result.sites);
      setProposals(result.proposals.map((p) => ({ ...p, include: true })));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setAnalyzing(false);
    }
  };

  const updateProposal = (index: number, patch: Partial<Proposal>) => {
    setProposals((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p))
    );
  };

  const saveProposals = async () => {
    const selected = proposals.filter((p) => p.include && p.label.trim());
    if (selected.length === 0) return;
    setSaving(true);
    try {
      await api.post(`/api/contracts/${contractId}/renewal-items`, {
        items: selected.map(({ include: _include, ...item }) => item),
      });
      toast.success(`${selected.length} postes ajoutés au plan`);
      setImportOpen(false);
      setProposals([]);
      mutate();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (item: RenewalItem, status: RenewalItem["status"]) => {
    try {
      await api.patch(`/api/renewal-items/${item.id}`, { status });
      mutate();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.del(`/api/renewal-items/${toDelete.id}`);
      toast.success("Poste supprimé");
      setToDelete(null);
      mutate();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const addManual = async () => {
    const amount = parseFloat(addForm.amountHT.replace(",", "."));
    if (!addForm.label.trim() || !Number.isFinite(amount)) {
      toast.error("Libellé et montant requis");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/api/contracts/${contractId}/renewal-items`, {
        items: [
          {
            label: addForm.label.trim(),
            plannedYear: addForm.plannedYear,
            amountHT: amount,
          },
        ],
      });
      toast.success("Poste ajouté");
      setAddOpen(false);
      setAddForm({ label: "", plannedYear: new Date().getFullYear() + 1, amountHT: "" });
      mutate();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const activeItems = items.filter((i) => i.status !== "ABANDONNE");
  const totalPlan = activeItems.reduce((s, i) => s + i.amountHT, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm text-text-secondary">
          {items.length === 0 ? (
            "Aucun poste au plan de renouvellement"
          ) : (
            <>
              <b className="text-primary-dark">{activeItems.length} postes</b> ·
              total plan {euro(totalPlan)} HT
            </>
          )}
        </div>
        <ReadOnlyGate>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => setAddOpen(true)}>
              <Plus size={16} className="mr-2" />
              Ajouter un poste
            </Button>
            <Button onClick={() => setImportOpen(true)}>
              <Sparkles size={16} className="mr-2" />
              Importer un plan (IA)
            </Button>
          </div>
        </ReadOnlyGate>
      </div>

      <Table>
        <THead>
          <Th>Année</Th>
          <Th>Poste</Th>
          <Th>Site</Th>
          <Th align="right">Montant HT</Th>
          <Th>Source</Th>
          <Th>Statut</Th>
          <Th />
        </THead>
        <TBody>
          {items.length === 0 && (
            <TableEmpty
              colSpan={7}
              message="Importez le plan P3 de l'exploitant (Excel) ou saisissez les postes manuellement."
            />
          )}
          {items.map((item) => (
            <Tr key={item.id}>
              <Td className="font-mono text-[12.5px] font-semibold">
                {item.plannedYear}
              </Td>
              <Td>
                {item.label}
                {item.notes && (
                  <span className="block text-xs text-gray-400">
                    {item.notes}
                  </span>
                )}
                {item.quote && (
                  <span className="block text-xs text-accent">
                    Devis {item.quote.reference}
                  </span>
                )}
              </Td>
              <Td>{item.site?.name || "—"}</Td>
              <Td align="right" className="font-semibold tabular-nums">
                {euro(item.amountHT)}
              </Td>
              <Td className="text-xs text-gray-500">
                {SOURCE_LABELS[item.source]}
              </Td>
              <Td>
                <select
                  value={item.status}
                  onChange={(e) =>
                    changeStatus(item, e.target.value as RenewalItem["status"])
                  }
                  className={`rounded-lg border-0 px-2 py-1 text-xs font-medium ${STATUS_CLASSES[item.status]}`}
                >
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Td>
              <Td align="right">
                <ReadOnlyGate>
                  <button
                    onClick={() => setToDelete(item)}
                    title="Supprimer le poste"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </ReadOnlyGate>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>

      {/* ─── Modal import IA ─── */}
      {importOpen && (
        <Modal
          title="Importer un plan de renouvellement"
          subtitle="Trame libre — l'IA identifie les postes, vous relisez avant d'enregistrer"
          size="xl"
          onClose={() => !saving && setImportOpen(false)}
          footer={
            proposals.length > 0 ? (
              <>
                <Button variant="outline" onClick={() => setProposals([])}>
                  Autre fichier
                </Button>
                <Button onClick={saveProposals} disabled={saving}>
                  {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
                  Enregistrer {proposals.filter((p) => p.include).length} postes
                </Button>
              </>
            ) : undefined
          }
        >
          {proposals.length === 0 ? (
            <div className="py-6 text-center">
              {analyzing ? (
                <div className="space-y-3">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-accent" />
                  <p className="text-sm text-text-secondary">
                    Analyse de {fileName}…
                  </p>
                </div>
              ) : (
                <>
                  <FileUp className="mx-auto mb-3 h-8 w-8 text-gray-300" />
                  <p className="mb-4 text-sm text-text-secondary">
                    Déposez le plan P3 de l&apos;exploitant tel quel (Excel ou
                    CSV) — aucune mise en forme préalable n&apos;est nécessaire.
                  </p>
                  <Button onClick={() => fileInputRef.current?.click()}>
                    Choisir un fichier
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                      e.target.value = "";
                    }}
                  />
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-text-secondary">
                {proposals.length} postes détectés dans {fileName} — corrigez ou
                décochez avant d&apos;enregistrer.
              </p>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                    <th className="py-2 pr-2" />
                    <th className="py-2 pr-2">Poste</th>
                    <th className="py-2 pr-2 w-20">Année</th>
                    <th className="py-2 pr-2 w-28">Montant HT</th>
                    <th className="py-2 w-44">Site</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((p, i) => (
                    <tr
                      key={i}
                      className={`border-b border-gray-100 ${p.include ? "" : "opacity-40"}`}
                    >
                      <td className="py-1.5 pr-2">
                        <input
                          type="checkbox"
                          checked={p.include}
                          onChange={(e) =>
                            updateProposal(i, { include: e.target.checked })
                          }
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input
                          value={p.label}
                          onChange={(e) =>
                            updateProposal(i, { label: e.target.value })
                          }
                          className="w-full border border-gray-200 px-2 py-1 text-sm focus:border-accent focus:outline-none"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input
                          type="number"
                          value={p.plannedYear}
                          onChange={(e) =>
                            updateProposal(i, {
                              plannedYear: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full border border-gray-200 px-2 py-1 text-sm tabular-nums focus:border-accent focus:outline-none"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input
                          type="number"
                          value={p.amountHT}
                          onChange={(e) =>
                            updateProposal(i, {
                              amountHT: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full border border-gray-200 px-2 py-1 text-sm tabular-nums focus:border-accent focus:outline-none"
                        />
                      </td>
                      <td className="py-1.5">
                        <select
                          value={p.siteId || ""}
                          onChange={(e) =>
                            updateProposal(i, {
                              siteId: e.target.value || null,
                            })
                          }
                          className="w-full border border-gray-200 px-2 py-1 text-sm focus:border-accent focus:outline-none"
                        >
                          <option value="">— Non rattaché</option>
                          {contractSites.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}

      {/* ─── Modal ajout manuel ─── */}
      {addOpen && (
        <Modal
          title="Ajouter un poste au plan"
          size="sm"
          onClose={() => setAddOpen(false)}
          footer={
            <Button onClick={addManual} disabled={saving}>
              {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
              Ajouter
            </Button>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Libellé
              </label>
              <input
                value={addForm.label}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, label: e.target.value }))
                }
                placeholder="Remplacement chaudière n°1"
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Année
                </label>
                <input
                  type="number"
                  value={addForm.plannedYear}
                  onChange={(e) =>
                    setAddForm((f) => ({
                      ...f,
                      plannedYear: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="w-full border border-gray-200 px-3 py-2 text-sm tabular-nums focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Montant HT (€)
                </label>
                <input
                  value={addForm.amountHT}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, amountHT: e.target.value }))
                  }
                  placeholder="12000"
                  className="w-full border border-gray-200 px-3 py-2 text-sm tabular-nums focus:border-accent focus:outline-none"
                />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Confirmation suppression ─── */}
      {toDelete && (
        <Modal
          title="Supprimer ce poste ?"
          size="sm"
          onClose={() => setToDelete(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setToDelete(null)}>
                Annuler
              </Button>
              <Button
                onClick={confirmDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleting && <Loader2 size={16} className="mr-2 animate-spin" />}
                Supprimer
              </Button>
            </>
          }
        >
          <p className="text-sm text-text-secondary">
            « {toDelete.label} » ({toDelete.plannedYear},{" "}
            {euro(toDelete.amountHT)}) sera retiré du plan de renouvellement.
          </p>
        </Modal>
      )}
    </div>
  );
}
