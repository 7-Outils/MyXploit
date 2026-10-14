"use client";

/**
 * Portefeuille clients — écran maître-détail.
 *
 * Gauche : la liste des clients (recherche nom / référence / exploitant,
 * filtres « échéance proche » et « sans contrat », tri nom ou échéance).
 * Droite : la fiche du client sélectionné (ClientDetailPane).
 *
 * /clients et /clients/[id] rendent ce même écran ; la sélection est
 * reflétée dans l'URL par history.replaceState (pas de remontage).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  ArrowDownAZ,
  CalendarClock,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/contexts/PermissionContext";
import { api, getErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import ClientDetailPane from "./ClientDetailPane";
import {
  EXPIRING_SOON_DAYS,
  digestClient,
  formatMonthYear,
  formatRemaining,
  remainingTone,
  type ClientDigest,
  type ClientListItem,
} from "./types";

type SortMode = "name" | "deadline";

interface Row {
  client: ClientListItem;
  digest: ClientDigest;
}

export default function ClientsWorkspace({ initialClientId }: { initialClientId?: string }) {
  const toast = useToast();
  const { canCreate } = usePermissions();
  const { data, error, isLoading, mutate } = useSWR<ClientListItem[]>("/api/clients");

  const [selectedId, setSelectedId] = useState<string | null>(initialClientId ?? null);
  const [search, setSearch] = useState("");
  const [onlyExpiring, setOnlyExpiring] = useState(false);
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [sort, setSort] = useState<SortMode>("name");
  // Mobile : la liste et la fiche ne tiennent pas côte à côte.
  const [mobileDetail, setMobileDetail] = useState(!!initialClientId);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);

  const clients = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const rows: Row[] = useMemo(() => {
    const now = Date.now();
    return clients.map((client) => ({ client, digest: digestClient(client, now) }));
  }, [clients]);

  const totals = useMemo(() => {
    let contracts = 0;
    let active = 0;
    let sites = 0;
    let expiring = 0;
    let empty = 0;
    for (const { digest } of rows) {
      contracts += digest.contractCount;
      active += digest.activeCount;
      sites += digest.siteCount;
      if (digest.nextDays !== null && digest.nextDays <= EXPIRING_SOON_DAYS) expiring++;
      if (digest.contractCount === 0) empty++;
    }
    return { contracts, active, sites, expiring, empty };
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter(({ client, digest }) => {
      if (onlyEmpty && digest.contractCount > 0) return false;
      if (onlyExpiring && (digest.nextDays === null || digest.nextDays > EXPIRING_SOON_DAYS)) return false;
      if (!q) return true;
      if (client.name.toLowerCase().includes(q)) return true;
      return digest.contracts.some(
        (c) =>
          (c.reference || "").toLowerCase().includes(q) ||
          (c.provider || "").toLowerCase().includes(q) ||
          (c.title || "").toLowerCase().includes(q)
      );
    });
    return filtered.sort((a, b) => {
      if (sort === "deadline") {
        const da = a.digest.nextDays ?? Number.POSITIVE_INFINITY;
        const db = b.digest.nextDays ?? Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
      }
      return a.client.name.localeCompare(b.client.name, "fr");
    });
  }, [rows, search, onlyEmpty, onlyExpiring, sort]);

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
      // Lien /clients/[id] vers un client inconnu : retour à la liste.
      toast.error("Client introuvable");
    }
    select(visible[0]?.client.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, clients, selectedId]);

  // Garder la ligne sélectionnée visible lors de la navigation clavier.
  useEffect(() => {
    if (!selectedId) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-client-id="${selectedId}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const idx = visible.findIndex((r) => r.client.id === selectedId);
    const next = e.key === "ArrowDown" ? Math.min(idx + 1, visible.length - 1) : Math.max(idx - 1, 0);
    const row = visible[next];
    if (row) select(row.client.id);
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
    const idx = visible.findIndex((r) => r.client.id === selectedId);
    const neighbour = visible[idx + 1] ?? visible[idx - 1] ?? null;
    select(neighbour?.client.id ?? null);
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
    return (
      <div className="panel p-10 text-center text-sm text-red-700">
        Impossible de charger les clients.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-7rem)]">
      {/* En-tête : totaux du portefeuille, une ligne */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-ink/10 pb-3">
        <div>
          <p className="label-tech">Portefeuille</p>
          <h1 className="mt-1 text-xl font-semibold text-ink">Clients</h1>
        </div>
        <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm text-ink/50">
          <Total label="clients" value={clients.length} />
          <Total label={`contrat${totals.contracts > 1 ? "s" : ""} dont ${totals.active} actif${totals.active > 1 ? "s" : ""}`} value={totals.contracts} />
          <Total label="sites" value={totals.sites} />
          <Total label="échéances < 12 mois" value={totals.expiring} tone={totals.expiring > 0 ? "text-accent" : undefined} />
        </dl>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* ── Maître : liste des clients ── */}
        <section className={cn("panel flex min-h-0 flex-col", mobileDetail && "hidden lg:flex")}>
          <div className="space-y-2 border-b border-ink/10 p-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink/30" />
                <input
                  type="text"
                  placeholder="Client, référence, exploitant…"
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
              <button
                onClick={() => setSort(sort === "name" ? "deadline" : "name")}
                title={sort === "name" ? "Trié par nom — trier par échéance" : "Trié par échéance — trier par nom"}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center border border-ink/20 text-ink/60 transition-colors hover:border-accent hover:text-accent"
              >
                {sort === "name" ? <ArrowDownAZ size={16} /> : <CalendarClock size={16} />}
              </button>
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
            <div className="flex items-center gap-1.5">
              <FilterToggle
                active={onlyExpiring}
                onClick={() => setOnlyExpiring((v) => !v)}
                label="Échéance < 12 mois"
                count={totals.expiring}
              />
              <FilterToggle
                active={onlyEmpty}
                onClick={() => setOnlyEmpty((v) => !v)}
                label="Sans contrat"
                count={totals.empty}
              />
            </div>
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
                {clients.length === 0
                  ? "Aucun client. Créez le premier avec le bouton +."
                  : "Aucun client ne correspond."}
              </p>
            ) : (
              visible.map(({ client, digest }) => (
                <ClientRow
                  key={client.id}
                  client={client}
                  digest={digest}
                  selected={client.id === selectedId}
                  onSelect={() => select(client.id, { openOnMobile: true })}
                />
              ))
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

        {/* ── Détail : fiche du client ── */}
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
              {clients.length === 0 ? "Le portefeuille est vide." : "Sélectionnez un client."}
            </div>
          )}
        </section>
      </div>

      {showCreate && (
        <Modal
          title="Nouveau client"
          subtitle="La collectivité titulaire des marchés. Les contrats se créent ou se rattachent ensuite sur sa fiche."
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

function Total({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dd className={cn("font-mono text-base font-semibold tabular-nums text-ink", tone)}>{value}</dd>
      <dt>{label}</dt>
    </div>
  );
}

function FilterToggle({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      title={active ? `Retirer le filtre « ${label} »` : `Filtrer : ${label}`}
      className={cn(
        "flex h-7 items-center gap-1.5 border px-2 font-mono text-[11px] uppercase tracking-widest transition-colors",
        active ? "border-ink bg-ink text-paper" : "border-ink/15 text-ink/50 hover:border-accent hover:text-accent"
      )}
    >
      {label}
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

function ClientRow({
  client,
  digest,
  selected,
  onSelect,
}: {
  client: ClientListItem;
  digest: ClientDigest;
  selected: boolean;
  onSelect: () => void;
}) {
  const empty = digest.contractCount === 0;
  return (
    <button
      role="option"
      aria-selected={selected}
      data-client-id={client.id}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 border-l-2 px-3 py-2.5 text-left transition-colors",
        selected ? "border-l-accent bg-accent/5" : "border-l-transparent hover:bg-ink/[0.02]"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", selected ? "text-accent" : "text-ink")}>{client.name}</p>
        {empty ? (
          <p className="mt-0.5 font-mono text-[11px] uppercase tracking-widest text-accent">Aucun contrat</p>
        ) : (
          <p className="mt-0.5 truncate text-xs text-ink/50">
            <span className="font-mono tabular-nums">{digest.contractCount}</span> ctr ·{" "}
            <span className="font-mono tabular-nums">{digest.siteCount}</span> sites
            {digest.providers.length > 0 && <> · {digest.providers.join(", ")}</>}
          </p>
        )}
      </div>
      {!empty && (
        <div className="flex-shrink-0 text-right" title={digest.nextContract ? `Prochaine échéance : ${digest.nextContract.reference}` : "Aucun contrat actif"}>
          <p className={cn("font-mono text-xs tabular-nums", remainingTone(digest.nextDays))}>
            {formatRemaining(digest.nextDays)}
          </p>
          <p className="font-mono text-[11px] tabular-nums text-ink/35">
            {digest.nextContract ? formatMonthYear(digest.nextContract.endDate) : "—"}
          </p>
        </div>
      )}
    </button>
  );
}
