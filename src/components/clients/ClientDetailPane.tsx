"use client";

/**
 * Volet droit de la page Clients : le client (renommer / supprimer) et la
 * liste de ses contrats, avec le lien client → contrat (créer, créer depuis
 * un AE, rattacher, détacher). Le contrat lui-même se gère dans /contrat.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  FileSpreadsheet,
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
import EditContractModal from "@/components/administratif/modals/EditContractModal";
import type { Contract as FullContract } from "@/components/administratif/types";
import AEImportModal from "@/components/administratif/modals/AEImportModal";
import CreateContractModal from "@/components/administratif/modals/CreateContractModal";
import { STATUS_LABELS, STATUS_TEXT, type ClientContractSummary, type ClientDetail } from "./types";

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

  // Renommage en place
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Modales
  const [confirmDeleteClient, setConfirmDeleteClient] = useState(false);
  const [detaching, setDetaching] = useState<ClientContractSummary | null>(null);
  const [deletingContract, setDeletingContract] = useState<ClientContractSummary | null>(null);
  const [editingContract, setEditingContract] = useState<FullContract | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCreateContract, setShowCreateContract] = useState(false);
  const [showCreateAE, setShowCreateAE] = useState(false);
  const [showAttach, setShowAttach] = useState(false);

  const contracts = useMemo(() => {
    const list = Array.isArray(client?.contracts) ? [...client.contracts] : [];
    // Actifs d'abord, puis par référence
    return list.sort((a, b) => {
      const sa = a.status === "ACTIF" ? 0 : 1;
      const sb = b.status === "ACTIF" ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return (a.reference || "").localeCompare(b.reference || "", "fr");
    });
  }, [client]);

  const refreshAll = useCallback(async () => {
    await Promise.all([mutate(), onListChanged()]);
  }, [mutate, onListChanged]);

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
    if (c.status !== "ACTIF" && c.status !== "EN_ATTENTE") {
      toast.info("Les contrats expirés ou résiliés ne s'ouvrent pas dans l'espace contrat.");
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

  const deleteContract = async () => {
    if (!deletingContract) return;
    setBusy(true);
    try {
      await api.del(`/api/contracts/${deletingContract.id}`);
      toast.success("Contrat supprimé");
      setDeletingContract(null);
      await refreshAll();
    } catch (err) {
      // Le serveur explique le refus (droits, sites rattachés) : on l'affiche tel quel.
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const detachContract = async () => {
    if (!detaching) return;
    setBusy(true);
    try {
      await api.put(`/api/contracts/${detaching.id}`, { clientId: null });
      toast.success(`Contrat ${detaching.reference} détaché`);
      setDetaching(null);
      await refreshAll();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // ── Rendu ───────────────────────────────────────────────────
  if (isLoading && !client) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink/30" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-10 text-center text-sm text-ink/50">
        {error ? "Client introuvable ou inaccessible." : "Chargement…"}
      </div>
    );
  }

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

      {/* Contrats du client + lien client → contrat */}
      <div className="flex items-center justify-between gap-2 border-b border-ink/10 px-5 py-2">
        <p className="label-tech">
          Contrats <span className="tabular-nums">({contracts.length})</span>
        </p>
        {canCreate && (
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowCreateContract(true)} title="Nouveau contrat" className="flex h-9 w-9 items-center justify-center bg-ink text-paper transition-colors hover:bg-accent">
              <Plus size={16} />
            </button>
            <button onClick={() => setShowCreateAE(true)} title="Créer un contrat depuis un fichier AE" className={iconBtn}>
              <FileSpreadsheet size={16} />
            </button>
            <button onClick={() => setShowAttach(true)} title="Rattacher un contrat existant sans client" className={iconBtn}>
              <Link2 size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 p-5">
        <Table>
          <THead>
            <Th>Référence</Th>
            <Th>Exploitant</Th>
            <Th>Statut</Th>
            <Th align="right"> </Th>
          </THead>
          <TBody>
            {contracts.length === 0 && (
              <TableEmpty colSpan={4} message="Aucun contrat. Créez-en un, importez un AE ou rattachez un contrat existant." />
            )}
            {contracts.map((c) => (
              <Tr key={c.id}>
                <Td className="py-2 font-mono font-medium text-ink">{c.reference || "—"}</Td>
                <Td className="py-2">{c.provider || "—"}</Td>
                <Td className={cn("py-2", STATUS_TEXT[c.status] ?? "text-ink/50")}>{STATUS_LABELS[c.status] ?? c.status}</Td>
                <Td align="right" className="py-1">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openContract(c)}
                      disabled={c.status !== "ACTIF" && c.status !== "EN_ATTENTE"}
                      title="Ouvrir dans l'espace contrat"
                      className={cn(iconBtn, "border-transparent")}
                    >
                      <ArrowUpRight size={16} />
                    </button>
                    {canEdit && (
                      <>
                        <button onClick={() => editContract(c.id)} title="Modifier le contrat" className={cn(iconBtn, "border-transparent")}>
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => setDetaching(c)} title="Détacher du client" className={cn(iconBtn, "border-transparent")}>
                          <Unlink size={16} />
                        </button>
                      </>
                    )}
                    {canDelete && (
                      <button onClick={() => setDeletingContract(c)} title="Supprimer le contrat" className={cn(dangerBtn, "border-transparent")}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
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
            Ses <span className="font-mono tabular-nums">{contracts.length}</span> contrat(s) et leurs sites seront détachés, pas supprimés.
          </p>
        </Modal>
      )}

      {detaching && (
        <Modal
          title="Détacher du client"
          subtitle={`${detaching.reference} · ${detaching.provider}`}
          size="sm"
          onClose={() => setDetaching(null)}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setDetaching(null)}>Annuler</Button>
              <Button size="sm" onClick={detachContract} disabled={busy}>
                {busy && <Loader2 size={14} className="mr-2 animate-spin" />}
                Détacher
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink/70">
            Le contrat et ses sites ne seront plus rattachés à ce client. Ils restent intacts et pourront être rattachés ailleurs.
          </p>
        </Modal>
      )}

      {deletingContract && (
        <Modal
          title="Supprimer le contrat"
          subtitle={[deletingContract.provider || deletingContract.title, deletingContract.reference].filter(Boolean).join(" · ") || "Contrat sans titre"}
          size="sm"
          onClose={() => setDeletingContract(null)}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setDeletingContract(null)}>Annuler</Button>
              <Button size="sm" onClick={deleteContract} disabled={busy} className="bg-red-700 hover:bg-red-800">
                {busy && <Loader2 size={14} className="mr-2 animate-spin" />}
                Supprimer
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink/70">
            Les sites partagés avec d&apos;autres contrats sont conservés. Les sites propres à ce contrat et toutes leurs données
            sont supprimés. Action irréversible.
          </p>
        </Modal>
      )}

      {editingContract && (
        <EditContractModal
          contractId={editingContract.id}
          contractDetail={editingContract}
          onClose={() => setEditingContract(null)}
          onUpdated={refreshAll}
        />
      )}

      {showAttach && (
        <AttachContractsModal
          clientId={clientId}
          clientName={client.name}
          onClose={() => setShowAttach(false)}
          onAttached={refreshAll}
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
                </div>
                <span className="font-mono text-xs tabular-nums text-ink/50">
                  {c._count?.contractSites ?? 0} site{(c._count?.contractSites ?? 0) > 1 ? "s" : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
