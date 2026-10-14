"use client";

/**
 * Fiche client (volet droit du portefeuille).
 *
 * En-tête : nom (renommage en place) + chiffres clés sans cadre.
 * Onglets Contrats / Sites. Dans Contrats, sélection façon Finder
 * (clic, Cmd/Ctrl+clic, Maj+clic, double-clic = ouvrir) : la barre d'outils
 * montre les actions de création quand rien n'est sélectionné, les actions
 * sur la sélection sinon — chaque action n'existe qu'une fois à l'écran.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  FileSpreadsheet,
  FileUp,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Table, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/contexts/PermissionContext";
import { api, getErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { SITE_TYPE_LABELS } from "@/components/buildings/constants";
import EditContractModal from "@/components/administratif/modals/EditContractModal";
import AEImportModal from "@/components/administratif/modals/AEImportModal";
import CreateContractModal from "@/components/administratif/modals/CreateContractModal";
import type { Contract as FullContract } from "@/components/administratif/types";
import {
  STATUS_LABELS,
  STATUS_TEXT,
  daysUntil,
  digestClient,
  formatDate,
  formatRemaining,
  remainingTone,
  type ClientContractSummary,
  type ClientDetail,
} from "./types";

type Tab = "contracts" | "sites";

interface OrphanContract extends ClientContractSummary {
  client?: { id: string; name: string } | null;
}

const iconBtn =
  "flex h-9 w-9 flex-shrink-0 items-center justify-center border border-ink/20 text-ink/60 transition-colors hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-30";
const dangerBtn =
  "flex h-9 w-9 flex-shrink-0 items-center justify-center border border-ink/20 text-ink/60 transition-colors hover:border-red-600/40 hover:text-red-600";

export default function ClientDetailPane({
  clientId,
  onBack,
  onListChanged,
  onDeleted,
}: {
  clientId: string;
  onBack: () => void;
  onListChanged: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const router = useRouter();
  const toast = useToast();
  const { canEdit, canDelete, canCreate } = usePermissions();
  const url = `/api/clients/${clientId}`;
  const { data: client, error, isLoading, mutate } = useSWR<ClientDetail>(url);

  const [tab, setTab] = useState<Tab>("contracts");

  // Renommage en place
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Sélection Finder dans la table des contrats
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const anchorRef = useRef<number | null>(null);

  // Modales
  const [confirmDeleteClient, setConfirmDeleteClient] = useState(false);
  const [confirmContracts, setConfirmContracts] = useState<"detach" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingContract, setEditingContract] = useState<FullContract | null>(null);
  const [aeContractId, setAeContractId] = useState<string | null>(null);
  const [showCreateContract, setShowCreateContract] = useState(false);
  const [showCreateAE, setShowCreateAE] = useState(false);
  const [showAttach, setShowAttach] = useState(false);

  const contracts = useMemo(() => {
    const list = Array.isArray(client?.contracts) ? [...client.contracts] : [];
    // Actifs d'abord, puis par échéance
    return list.sort((a, b) => {
      const sa = a.status === "ACTIF" ? 0 : 1;
      const sb = b.status === "ACTIF" ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
    });
  }, [client]);
  const sites = useMemo(() => (Array.isArray(client?.sites) ? client.sites : []), [client]);
  const digest = useMemo(() => (client ? digestClient(client) : null), [client]);
  const unreadAlerts = useMemo(() => sites.reduce((n, s) => n + (s._count?.alerts ?? 0), 0), [sites]);

  // La sélection ne garde que des contrats encore présents
  const selection = useMemo(
    () => contracts.filter((c) => selected.has(c.id)),
    [contracts, selected]
  );
  const single = selection.length === 1 ? selection[0] : null;

  const refreshAll = useCallback(async () => {
    await Promise.all([mutate(), onListChanged()]);
  }, [mutate, onListChanged]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selected.size > 0 && !document.querySelector('[role="dialog"]')) {
        setSelected(new Set());
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected.size]);

  // ── Sélection ───────────────────────────────────────────────
  const clickRow = (index: number, e: React.MouseEvent) => {
    const id = contracts[index].id;
    if (e.shiftKey && anchorRef.current !== null) {
      const [from, to] = [anchorRef.current, index].sort((a, b) => a - b);
      const next = new Set(e.metaKey || e.ctrlKey ? selected : []);
      for (let i = from; i <= to; i++) next.add(contracts[i].id);
      setSelected(next);
      return;
    }
    anchorRef.current = index;
    if (e.metaKey || e.ctrlKey) {
      toggle(id);
      return;
    }
    setSelected(selected.size === 1 && selected.has(id) ? new Set() : new Set([id]));
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const allSelected = contracts.length > 0 && selection.length === contracts.length;

  // ── Actions client ──────────────────────────────────────────
  const startRename = () => {
    setNameDraft(client?.name ?? "");
    setRenaming(true);
  };

  const saveName = async () => {
    const name = nameDraft.trim();
    if (!name || name === client?.name) {
      setRenaming(false);
      return;
    }
    setSavingName(true);
    try {
      await api.put(url, { name });
      await refreshAll();
      setRenaming(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingName(false);
    }
  };

  const deleteClient = async () => {
    setBusy(true);
    try {
      await api.del(url);
      toast.success(`Client « ${client?.name} » supprimé`);
      setConfirmDeleteClient(false);
      await onDeleted();
    } catch (err) {
      // Le serveur explique le refus (missions, droits) : on l'affiche tel quel.
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // ── Actions contrats ────────────────────────────────────────
  const openContract = (c: ClientContractSummary) => {
    if (c.status !== "ACTIF") {
      toast.info("Seuls les contrats actifs s'ouvrent dans l'espace contrat.");
      return;
    }
    router.push(`/contrat?contract=${c.id}`);
  };

  const editContract = async (id: string) => {
    try {
      setEditingContract(await api.get<FullContract>(`/api/contracts/${id}`));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const runOnSelection = async () => {
    if (!confirmContracts) return;
    const mode = confirmContracts;
    setBusy(true);
    const results = await Promise.allSettled(
      selection.map((c) =>
        mode === "delete"
          ? api.del(`/api/contracts/${c.id}`)
          : api.put(`/api/contracts/${c.id}`, { clientId: null })
      )
    );
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    const ok = results.length - failed.length;
    if (ok > 0) {
      toast.success(
        `${ok} contrat${ok > 1 ? "s" : ""} ${mode === "delete" ? "supprimé" : "détaché"}${ok > 1 ? "s" : ""}`
      );
    }
    if (failed.length > 0) toast.error(getErrorMessage(failed[0].reason));
    setSelected(new Set());
    setConfirmContracts(null);
    setBusy(false);
    await refreshAll();
  };

  // ── Rendu ───────────────────────────────────────────────────
  if (isLoading && !client) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink/30" />
      </div>
    );
  }

  if (!client || !digest) {
    return (
      <div className="p-10 text-center text-sm text-ink/50">
        {error ? "Client introuvable ou inaccessible." : "Chargement…"}
      </div>
    );
  }

  const siteCount = client._count?.sites ?? sites.length;
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "contracts", label: "Contrats", count: contracts.length },
    { id: "sites", label: "Sites", count: sites.length },
  ];

  return (
    <div className="flex min-h-full flex-col">
      {/* En-tête : identité + actions client */}
      <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 pb-4 pt-4">
        <div className="flex min-w-0 items-start gap-2">
          <button onClick={onBack} title="Retour à la liste" className={cn(iconBtn, "border-transparent lg:hidden")}>
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <p className="label-tech">Client</p>
            {renaming ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveName();
                }}
                className="mt-1 flex items-center gap-1.5"
              >
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setRenaming(false)}
                  className="h-9 w-80 max-w-full border border-ink/20 bg-white px-2 text-base font-semibold text-ink focus:border-accent focus:outline-none"
                />
                <button type="submit" title="Enregistrer le nom" disabled={savingName} className={iconBtn}>
                  {savingName ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                </button>
                <button type="button" title="Annuler" onClick={() => setRenaming(false)} className={iconBtn}>
                  <X size={16} />
                </button>
              </form>
            ) : (
              <h2 className="mt-1 truncate text-lg font-semibold text-ink">{client.name}</h2>
            )}
          </div>
        </div>
        {!renaming && (
          <div className="flex items-center gap-1.5">
            {canEdit && (
              <button onClick={startRename} title="Renommer le client" className={iconBtn}>
                <Pencil size={16} />
              </button>
            )}
            {canDelete && (
              <button onClick={() => setConfirmDeleteClient(true)} title="Supprimer le client" className={dangerBtn}>
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Chiffres clés, sans cadre */}
      <dl className="grid grid-cols-2 border-b border-ink/10 sm:grid-cols-4">
        <Kpi label="Contrats actifs" value={`${digest.activeCount}`} sub={`sur ${contracts.length}`} />
        <Kpi label="Sites" value={`${siteCount}`} />
        <Kpi
          label="Alertes non lues"
          value={`${unreadAlerts}`}
          tone={unreadAlerts > 0 ? "text-accent" : undefined}
        />
        <Kpi
          label="Prochaine échéance"
          value={formatRemaining(digest.nextDays)}
          sub={digest.nextContract ? `${formatDate(digest.nextContract.endDate)} · ${digest.nextContract.reference}` : "aucun contrat actif"}
          tone={remainingTone(digest.nextDays)}
        />
      </dl>

      {/* Onglets + barre d'outils contextuelle */}
      <div className="flex items-end justify-between gap-2 border-b border-ink/10 px-5">
        <div className="-mb-px flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "label-tech border-b-2 px-3 py-2.5 transition-colors",
                tab === t.id ? "border-accent text-accent" : "border-transparent hover:text-ink"
              )}
            >
              {t.label} <span className="tabular-nums">({t.count})</span>
            </button>
          ))}
        </div>

        {tab === "contracts" && (
          <div className="flex items-center gap-1.5 py-1.5">
            {selection.length === 0 ? (
              canCreate && (
                <>
                  <button onClick={() => setShowCreateContract(true)} title="Nouveau contrat" className="flex h-9 w-9 items-center justify-center bg-ink text-paper transition-colors hover:bg-accent">
                    <Plus size={16} />
                  </button>
                  <button onClick={() => setShowCreateAE(true)} title="Créer un contrat depuis un fichier AE" className={iconBtn}>
                    <FileSpreadsheet size={16} />
                  </button>
                  <button onClick={() => setShowAttach(true)} title="Rattacher des contrats sans client" className={iconBtn}>
                    <Link2 size={16} />
                  </button>
                </>
              )
            ) : (
              <>
                <span className="label-tech mr-1.5 whitespace-nowrap">
                  <span className="tabular-nums">{selection.length}</span> sélectionné{selection.length > 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => single && openContract(single)}
                  disabled={!single || single.status !== "ACTIF"}
                  title="Ouvrir dans l'espace contrat (double-clic)"
                  className={iconBtn}
                >
                  <ArrowUpRight size={16} />
                </button>
                {canEdit && (
                  <>
                    <button onClick={() => single && editContract(single.id)} disabled={!single} title="Modifier le contrat" className={iconBtn}>
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => single && setAeContractId(single.id)} disabled={!single} title="Importer un AE dans ce contrat (mise à jour)" className={iconBtn}>
                      <FileUp size={16} />
                    </button>
                    <button onClick={() => setConfirmContracts("detach")} title="Détacher du client" className={iconBtn}>
                      <Unlink size={16} />
                    </button>
                  </>
                )}
                {canDelete && (
                  <button onClick={() => setConfirmContracts("delete")} title="Supprimer définitivement" className={dangerBtn}>
                    <Trash2 size={16} />
                  </button>
                )}
                <button onClick={() => setSelected(new Set())} title="Désélectionner (Échap)" className={cn(iconBtn, "border-transparent")}>
                  <X size={16} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 p-5">
        {tab === "contracts" ? (
          <Table>
            <THead>
              <Th className="w-10 px-3">
                <Checkbox
                  checked={allSelected}
                  partial={selection.length > 0 && !allSelected}
                  onClick={() => setSelected(allSelected ? new Set() : new Set(contracts.map((c) => c.id)))}
                  title={allSelected ? "Tout désélectionner" : "Tout sélectionner"}
                  disabled={contracts.length === 0}
                />
              </Th>
              <Th>Référence</Th>
              <Th>Exploitant</Th>
              <Th>Intitulé</Th>
              <Th>Statut</Th>
              <Th align="right">Début</Th>
              <Th align="right">Échéance</Th>
              <Th align="right">Reste</Th>
              <Th align="right">Sites</Th>
            </THead>
            <TBody>
              {contracts.length === 0 && (
                <TableEmpty
                  colSpan={9}
                  message="Aucun contrat. Créez-en un, importez un AE ou rattachez un contrat existant (boutons ci-dessus)."
                />
              )}
              {contracts.map((c, i) => {
                const isSel = selected.has(c.id);
                const days = c.status === "ACTIF" ? daysUntil(c.endDate) : null;
                return (
                  <tr
                    key={c.id}
                    aria-selected={isSel}
                    onClick={(e) => clickRow(i, e)}
                    onDoubleClick={() => openContract(c)}
                    className={cn(
                      "cursor-default select-none transition-colors",
                      isSel ? "bg-accent/5" : "hover:bg-ink/[0.02]"
                    )}
                  >
                    <td
                      className="w-10 px-3 py-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        anchorRef.current = i;
                        toggle(c.id);
                      }}
                    >
                      <Checkbox checked={isSel} title={isSel ? "Désélectionner" : "Sélectionner"} />
                    </td>
                    <Td className="py-2 font-mono font-medium text-ink">{c.reference || "—"}</Td>
                    <Td className="py-2">{c.provider || "—"}</Td>
                    <Td className="max-w-[280px] truncate py-2 text-ink/60">
                      <span title={c.title}>{c.title || "—"}</span>
                    </Td>
                    <Td className={cn("py-2", STATUS_TEXT[c.status] ?? "text-ink/50")}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </Td>
                    <Td align="right" className="py-2 font-mono text-ink/50">{formatDate(c.startDate)}</Td>
                    <Td align="right" className="py-2 font-mono text-ink">{formatDate(c.endDate)}</Td>
                    <Td align="right" className={cn("py-2 font-mono", remainingTone(days))}>
                      {c.status === "ACTIF" ? formatRemaining(days) : "—"}
                    </Td>
                    <Td align="right" className="py-2 font-mono text-ink/60">{c._count?.contractSites ?? 0}</Td>
                  </tr>
                );
              })}
            </TBody>
          </Table>
        ) : (
          <Table>
            <THead>
              <Th>Site</Th>
              <Th>Ville</Th>
              <Th>Type</Th>
              <Th>Énergie</Th>
              <Th align="right">Surface</Th>
              <Th align="right">Équip.</Th>
              <Th align="right">Alertes</Th>
            </THead>
            <TBody>
              {sites.length === 0 && (
                <TableEmpty colSpan={7} message="Aucun site. Les sites arrivent avec les contrats du client." />
              )}
              {sites.map((s) => {
                const alerts = s._count?.alerts ?? 0;
                return (
                  <Tr key={s.id} onClick={() => router.push(`/buildings/${s.id}`)}>
                    <Td className="py-2 font-medium text-ink">{s.name}</Td>
                    <Td className="py-2 text-ink/60">{s.city || "—"}</Td>
                    <Td className="py-2 text-ink/60">{SITE_TYPE_LABELS[s.type] ?? s.type}</Td>
                    <Td className="py-2 text-ink/60">{s.energyType || "—"}</Td>
                    <Td align="right" className="py-2 font-mono text-ink/60">
                      {s.surface ? `${Math.round(s.surface).toLocaleString("fr-FR")} m²` : "—"}
                    </Td>
                    <Td align="right" className="py-2 font-mono text-ink/60">{s._count?.equipments ?? 0}</Td>
                    <Td align="right" className={cn("py-2 font-mono", alerts > 0 ? "text-accent" : "text-ink/30")}>{alerts}</Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        )}
      </div>

      {/* ── Modales ── */}
      {confirmDeleteClient && (
        <Modal
          title="Supprimer le client"
          subtitle={client.name}
          size="sm"
          onClose={() => setConfirmDeleteClient(false)}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteClient(false)}>Annuler</Button>
              <Button size="sm" onClick={deleteClient} disabled={busy} className="bg-red-700 hover:bg-red-800">
                {busy && <Loader2 size={14} className="mr-2 animate-spin" />}
                Supprimer
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink/70">
            Ses <span className="font-mono tabular-nums">{contracts.length}</span> contrat(s) et{" "}
            <span className="font-mono tabular-nums">{siteCount}</span> site(s) seront détachés, pas supprimés.
          </p>
        </Modal>
      )}

      {confirmContracts && (
        <Modal
          title={confirmContracts === "delete" ? "Supprimer définitivement" : "Détacher du client"}
          subtitle={`${selection.length} contrat${selection.length > 1 ? "s" : ""}`}
          size="sm"
          onClose={() => setConfirmContracts(null)}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setConfirmContracts(null)}>Annuler</Button>
              <Button
                size="sm"
                onClick={runOnSelection}
                disabled={busy || selection.length === 0}
                className={confirmContracts === "delete" ? "bg-red-700 hover:bg-red-800" : undefined}
              >
                {busy && <Loader2 size={14} className="mr-2 animate-spin" />}
                {confirmContracts === "delete" ? "Supprimer" : "Détacher"}
              </Button>
            </>
          }
        >
          <ul className="mb-3 divide-y divide-ink/10 border border-ink/10">
            {selection.map((c) => (
              <li key={c.id} className="flex items-baseline gap-2 px-3 py-1.5 text-sm">
                <span className="font-mono font-medium text-ink">{c.reference}</span>
                <span className="truncate text-ink/50">{c.provider}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-ink/70">
            {confirmContracts === "delete"
              ? "Les sites partagés avec d'autres contrats sont conservés ; les sites propres à ces contrats et leurs données sont supprimés. Action irréversible."
              : "Les contrats et leurs sites ne seront plus rattachés à ce client. Ils restent intacts et pourront être rattachés ailleurs."}
          </p>
        </Modal>
      )}

      {showAttach && (
        <AttachContractsModal
          clientId={clientId}
          clientName={client.name}
          onClose={() => setShowAttach(false)}
          onAttached={refreshAll}
        />
      )}

      {editingContract && (
        <EditContractModal
          contractId={editingContract.id}
          contractDetail={editingContract}
          onClose={() => setEditingContract(null)}
          onUpdated={refreshAll}
        />
      )}

      {aeContractId && (
        <AEImportModal
          contractId={aeContractId}
          onClose={() => {
            setAeContractId(null);
            refreshAll();
          }}
        />
      )}

      {/* Ces deux modales rechargent la page au succès ; l'URL /clients/[id] garde la sélection. */}
      {showCreateContract && (
        <CreateContractModal clientId={clientId} onClose={() => setShowCreateContract(false)} />
      )}
      {showCreateAE && (
        <AEImportModal clientId={clientId} onClose={() => setShowCreateAE(false)} />
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="min-w-0 border-ink/10 px-5 py-3 [&:not(:first-child)]:border-l">
      <dt className="label-tech">{label}</dt>
      <dd className={cn("mt-1 font-mono text-2xl font-semibold tabular-nums text-ink", tone)}>{value}</dd>
      {sub && <dd className="mt-0.5 truncate font-mono text-[11px] tabular-nums text-ink/40" title={sub}>{sub}</dd>}
    </div>
  );
}

function Checkbox({
  checked,
  partial,
  onClick,
  title,
  disabled,
}: {
  checked: boolean;
  partial?: boolean;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={partial ? "mixed" : checked}
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        "flex h-4 w-4 items-center justify-center border transition-colors disabled:opacity-30",
        checked || partial ? "border-accent bg-accent text-paper" : "border-ink/25 bg-white hover:border-accent"
      )}
    >
      {checked ? <Check size={11} /> : partial ? <span className="h-px w-2 bg-paper" /> : null}
    </button>
  );
}

function AttachContractsModal({
  clientId,
  clientName,
  onClose,
  onAttached,
}: {
  clientId: string;
  clientName: string;
  onClose: () => void;
  onAttached: () => Promise<void>;
}) {
  const toast = useToast();
  const [orphans, setOrphans] = useState<OrphanContract[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<OrphanContract[]>("/api/contracts")
      .then((all) => {
        if (!cancelled) setOrphans((Array.isArray(all) ? all : []).filter((c) => !c.client));
      })
      .catch((err) => {
        if (!cancelled) {
          setOrphans([]);
          toast.error(getErrorMessage(err));
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attach = async () => {
    if (picked.size === 0) return;
    setSaving(true);
    const results = await Promise.allSettled(
      Array.from(picked).map((id) => api.put(`/api/contracts/${id}`, { clientId }))
    );
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    const ok = results.length - failed.length;
    if (ok > 0) toast.success(`${ok} contrat${ok > 1 ? "s" : ""} rattaché${ok > 1 ? "s" : ""} à ${clientName}`);
    if (failed.length > 0) toast.error(getErrorMessage(failed[0].reason));
    setSaving(false);
    await onAttached();
    onClose();
  };

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  return (
    <Modal
      title="Rattacher des contrats"
      subtitle={`Contrats sans client → ${clientName}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={attach} disabled={saving || picked.size === 0}>
            {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
            Rattacher{picked.size > 0 ? ` (${picked.size})` : ""}
          </Button>
        </>
      }
    >
      {orphans === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-ink/30" />
        </div>
      ) : orphans.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink/50">Aucun contrat sans client : tous sont déjà rattachés.</p>
      ) : (
        <div className="-mx-5 -my-4 divide-y divide-ink/10">
          {orphans.map((c) => {
            const on = picked.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors",
                  on ? "bg-accent/5" : "hover:bg-ink/[0.02]"
                )}
              >
                <span className={cn("flex h-4 w-4 flex-shrink-0 items-center justify-center border", on ? "border-accent bg-accent text-paper" : "border-ink/25")}>
                  {on && <Check size={11} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <span className="font-mono font-medium text-ink">{c.reference}</span>
                    <span className="text-ink/50"> · {c.provider}</span>
                  </p>
                  <p className="truncate text-xs text-ink/40">{c.title}</p>
                </div>
                <span className="font-mono text-xs tabular-nums text-ink/50">
                  {c._count?.contractSites ?? 0} sites · {formatDate(c.endDate)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
