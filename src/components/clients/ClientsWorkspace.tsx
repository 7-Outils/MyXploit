"use client";

/**
 * Page Clients — maître-détail.
 * Gauche : liste des clients (recherche par nom, création).
 * Droite : le client sélectionné et ses contrats (ClientDetailPane).
 * /clients et /clients/[id] rendent ce même écran ; la sélection est
 * reflétée dans l'URL par history.replaceState (pas de remontage).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Loader2, Plus, Search, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/contexts/PermissionContext";
import { api, getErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import ClientDetailPane from "./ClientDetailPane";
import type { ClientListItem } from "./types";

export default function ClientsWorkspace({ initialClientId }: { initialClientId?: string }) {
  const toast = useToast();
  const { canCreate } = usePermissions();
  const { data, error, isLoading, mutate } = useSWR<ClientListItem[]>("/api/clients");

  const [selectedId, setSelectedId] = useState<string | null>(initialClientId ?? null);
  const [search, setSearch] = useState("");
  // Mobile : la liste et la fiche ne tiennent pas côte à côte.
  const [mobileDetail, setMobileDetail] = useState(!!initialClientId);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);

  const clients = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [clients, search]);

  const select = useCallback((id: string | null, opts?: { openOnMobile?: boolean }) => {
    setSelectedId(id);
    if (opts?.openOnMobile) setMobileDetail(true);
    if (typeof window !== "undefined") {
      const target = id ? `/clients/${id}` : "/clients";
      if (window.location.pathname !== target) window.history.replaceState(null, "", target);
    }
  }, []);

  // Sans sélection (ou sélection disparue), on ouvre le premier client visible.
  useEffect(() => {
    if (!data) return;
    if (selectedId && clients.some((c) => c.id === selectedId)) return;
    if (selectedId && initialClientId === selectedId && clients.length > 0) {
      toast.error("Client introuvable");
    }
    select(visible[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, clients, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-client-id="${selectedId}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const idx = visible.findIndex((c) => c.id === selectedId);
    const next = e.key === "ArrowDown" ? Math.min(idx + 1, visible.length - 1) : Math.max(idx - 1, 0);
    if (visible[next]) select(visible[next].id);
  };

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await api.post<ClientListItem>("/api/clients", { name });
      await mutate();
      setShowCreate(false);
      setNewName("");
      select(created.id, { openOnMobile: true });
      toast.success(`Client « ${created.name} » créé`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const onClientDeleted = useCallback(async () => {
    const idx = visible.findIndex((c) => c.id === selectedId);
    const neighbour = visible[idx + 1] ?? visible[idx - 1] ?? null;
    select(neighbour?.id ?? null);
    setMobileDetail(false);
    await mutate();
  }, [visible, selectedId, select, mutate]);

  const refreshList = useCallback(async () => {
    await mutate();
  }, [mutate]);

  if (isLoading && !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink/30" />
      </div>
    );
  }

  if (error && !data) {
    return <div className="panel p-10 text-center text-sm text-red-700">Impossible de charger les clients.</div>;
  }

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-7rem)]">
      <div className="border-b border-ink/10 pb-3">
        <h1 className="text-xl font-semibold text-ink">Clients</h1>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* ── Maître : liste des clients ── */}
        <section className={cn("panel flex min-h-0 flex-col", mobileDetail && "hidden lg:flex")}>
          <div className="flex items-center gap-2 border-b border-ink/10 p-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink/30" />
              <input
                type="text"
                placeholder="Rechercher un client"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full border border-ink/20 bg-white pl-8 pr-8 text-sm focus:border-accent focus:outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  title="Effacer la recherche"
                  className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-ink/30 hover:text-accent"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {canCreate && (
              <button
                onClick={() => setShowCreate(true)}
                title="Nouveau client"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center bg-ink text-paper transition-colors hover:bg-accent"
              >
                <Plus size={16} />
              </button>
            )}
          </div>

          <div
            ref={listRef}
            role="listbox"
            aria-label="Clients"
            tabIndex={0}
            onKeyDown={onListKeyDown}
            className="min-h-0 flex-1 divide-y divide-ink/10 overflow-y-auto outline-none"
          >
            {visible.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-ink/40">
                {clients.length === 0 ? "Aucun client. Créez le premier avec le bouton +." : "Aucun client ne correspond."}
              </p>
            ) : (
              visible.map((client) => {
                const selected = client.id === selectedId;
                const n = client._count?.contracts ?? 0;
                return (
                  <button
                    key={client.id}
                    role="option"
                    aria-selected={selected}
                    data-client-id={client.id}
                    onClick={() => select(client.id, { openOnMobile: true })}
                    className={cn(
                      "flex w-full items-center gap-3 border-l-2 px-3 py-2.5 text-left transition-colors",
                      selected ? "border-l-accent bg-accent/5" : "border-l-transparent hover:bg-ink/[0.02]"
                    )}
                  >
                    <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", selected ? "text-accent" : "text-ink")}>
                      {client.name}
                    </span>
                    <span className={cn("font-mono text-xs tabular-nums", n > 0 ? "text-ink/50" : "text-ink/25")}>
                      {n} contrat{n > 1 ? "s" : ""}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-ink/10 px-3 py-2">
            <p className="label-tech">
              <span className="tabular-nums">{visible.length}</span>
              {visible.length !== clients.length && <span className="tabular-nums"> / {clients.length}</span>} client
              {clients.length > 1 ? "s" : ""}
            </p>
          </div>
        </section>

        {/* ── Détail : le client et ses contrats ── */}
        <section className={cn("panel min-h-0 overflow-y-auto", !mobileDetail && "hidden lg:block")}>
          {selectedId ? (
            <ClientDetailPane
              key={selectedId}
              clientId={selectedId}
              onBack={() => setMobileDetail(false)}
              onListChanged={refreshList}
              onDeleted={onClientDeleted}
            />
          ) : (
            <div className="flex h-full min-h-[300px] items-center justify-center p-10 text-center text-sm text-ink/40">
              {clients.length === 0 ? "Aucun client." : "Sélectionnez un client."}
            </div>
          )}
        </section>
      </div>

      {showCreate && (
        <Modal
          title="Nouveau client"
          size="sm"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>
                Annuler
              </Button>
              <Button size="sm" onClick={() => handleCreate()} disabled={creating || !newName.trim()}>
                {creating && <Loader2 size={14} className="mr-2 animate-spin" />}
                Créer
              </Button>
            </>
          }
        >
          <form onSubmit={handleCreate}>
            <label className="label-tech mb-1 block">Nom du client</label>
            <input
              type="text"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex : Commune de Saint-Priest"
              className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
