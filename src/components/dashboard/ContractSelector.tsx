"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Check,
  Plus,
  Building2,
  ArrowRight,
  Search,
} from "lucide-react";
import { useContract } from "@/contexts/ContractContext";
import { cn } from "@/lib/utils";

interface ClientGroup {
  id: string;
  name: string;
  city?: string | null;
  contracts: Array<ReturnType<typeof useContract>["contracts"][number]>;
}

interface ClientSummary {
  id: string;
  name: string;
  city?: string | null;
}

export function ContractSelector() {
  const router = useRouter();
  const { contracts, selectedContract, isLoading, selectContract } =
    useContract();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Charge tous les clients pour afficher aussi ceux sans contrat rattaché
  useEffect(() => {
    fetch("/api/clients")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ClientSummary[]) => setClients(data))
      .catch(() => setClients([]));
  }, []);

  // À l'ouverture : recherche vide, focus dessus, client courant déplié
  useEffect(() => {
    if (open) {
      setQuery("");
      setExpandedId(selectedContract?.client?.id ?? null);
      // Le focus doit attendre le rendu du panneau
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open, selectedContract]);

  // Un groupe par client (même à 0 contrat), + "Sans client" pour les orphelins
  const groups = useMemo(() => {
    const list: ClientGroup[] = [];
    const idx = new Map<string, ClientGroup>();

    for (const cl of clients) {
      const g: ClientGroup = { id: cl.id, name: cl.name, city: cl.city, contracts: [] };
      idx.set(cl.id, g);
      list.push(g);
    }
    for (const c of contracts) {
      const key = c.client?.id || "__none__";
      let g = idx.get(key);
      if (!g) {
        g = {
          id: key,
          name: c.client?.name || "Sans client",
          city: c.client?.city,
          contracts: [],
        };
        idx.set(key, g);
        list.push(g);
      }
      g.contracts.push(c);
    }
    list.sort((a, b) => {
      if (a.id === "__none__") return 1;
      if (b.id === "__none__") return -1;
      return a.name.localeCompare(b.name, "fr");
    });
    return list;
  }, [clients, contracts]);

  // Filtre de recherche : nom du client, ou référence/titre/exploitant d'un contrat
  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.contracts.some((c) =>
          [c.reference, c.title, c.provider]
            .filter(Boolean)
            .some((s) => s!.toLowerCase().includes(q))
        )
    );
  }, [groups, query]);

  if (isLoading) {
    return <div className="h-9 w-64 bg-ink/5 animate-pulse" />;
  }

  const currentClient = selectedContract?.client ?? null;

  const pickContract = (contract: ClientGroup["contracts"][number]) => {
    selectContract(contract);
    setOpen(false);
  };

  const handleClientClick = (g: ClientGroup) => {
    if (g.contracts.length === 1) {
      // Un seul contrat : le choisir directement, pas d'étape inutile
      pickContract(g.contracts[0]);
    } else if (g.contracts.length > 1) {
      setExpandedId(expandedId === g.id ? null : g.id);
    } else if (g.id !== "__none__") {
      // Aucun contrat : la fiche client est l'endroit où en créer un
      setOpen(false);
      router.push(`/clients/${g.id}`);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 text-sm transition-colors border max-w-[420px]",
          open
            ? "border-accent bg-accent/5 text-accent"
            : "border-ink/20 text-ink hover:border-accent hover:text-accent"
        )}
      >
        <Building2 size={15} className="text-ink/40 flex-shrink-0" />
        <span className="font-medium truncate">
          {currentClient?.name || "Sélectionner un client"}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            "text-ink/40 transition-transform ml-auto flex-shrink-0",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-[380px] bg-white shadow-large border border-ink/15 z-50">
          {/* Recherche */}
          <div className="flex items-center gap-2 border-b border-ink/10 px-3 py-2">
            <Search size={14} className="text-ink/30 flex-shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un client, un contrat..."
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink/30 focus:outline-none"
            />
          </div>

          {/* Lien fiche patrimoine pour le client courant */}
          {currentClient && !query && (
            <Link
              href={`/clients/${currentClient.id}`}
              onClick={() => setOpen(false)}
              className="mx-2 mt-2 flex items-center justify-between gap-2 border-l-2 border-accent bg-accent/5 px-3 py-2 hover:bg-accent/10 text-accent text-sm font-medium transition-colors"
            >
              <span className="flex items-center gap-2 truncate">
                <Building2 size={14} className="flex-shrink-0" />
                Patrimoine de {currentClient.name}
              </span>
              <ArrowRight size={14} className="flex-shrink-0" />
            </Link>
          )}

          {/* Clients */}
          <div className="max-h-80 overflow-y-auto py-1.5">
            {filteredGroups.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-ink/40">
                {groups.length === 0
                  ? "Aucun client. Commence par en créer un."
                  : "Aucun résultat"}
              </div>
            )}
            {filteredGroups.map((g) => {
              const isCurrent = currentClient?.id === g.id ||
                (g.id === "__none__" && selectedContract && !selectedContract.client);
              const multi = g.contracts.length > 1;
              const expanded = multi && (expandedId === g.id || !!query.trim());
              return (
                <div key={g.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClientClick(g)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleClientClick(g); }}
                    className={cn(
                      "group/r mx-1.5 flex cursor-pointer items-center gap-2 px-2 py-2 transition-colors hover:bg-ink/[0.03]",
                      isCurrent && !multi && "bg-accent/5"
                    )}
                  >
                    {multi ? (
                      <ChevronRight
                        size={13}
                        className={cn(
                          "flex-shrink-0 text-ink/30 transition-transform",
                          expanded && "rotate-90"
                        )}
                      />
                    ) : (
                      <span className="w-[13px] flex-shrink-0" />
                    )}
                    <span
                      className={cn(
                        "flex-1 truncate text-sm font-medium",
                        g.id === "__none__" ? "text-ink/40" : "text-ink",
                        isCurrent && !multi && "text-accent"
                      )}
                    >
                      {g.name}
                    </span>
                    {multi && (
                      <span className="font-mono text-[10px] tabular-nums text-ink/40 flex-shrink-0">
                        {g.contracts.length} contrats
                      </span>
                    )}
                    {g.contracts.length === 0 && (
                      <span className="text-[10px] text-ink/30 flex-shrink-0">
                        aucun contrat
                      </span>
                    )}
                    {isCurrent && !multi && (
                      <Check size={13} className="text-accent flex-shrink-0" />
                    )}
                    {g.id !== "__none__" && (
                      <Link
                        href={`/clients/${g.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(false);
                        }}
                        title="Fiche client"
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center text-ink/0 transition-colors group-hover/r:text-ink/30 hover:!text-accent"
                      >
                        <ArrowRight size={13} />
                      </Link>
                    )}
                  </div>

                  {/* Contrats du client, seulement si plusieurs */}
                  {expanded && (
                    <div className="ml-[26px] mr-2 mb-1 border-l border-ink/10 pl-2">
                      {g.contracts.map((contract) => {
                        const isSelected = selectedContract?.id === contract.id;
                        return (
                          <button
                            key={contract.id}
                            onClick={() => pickContract(contract)}
                            className={cn(
                              "flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-ink/[0.02]",
                              isSelected && "bg-accent/5 text-accent"
                            )}
                          >
                            <span className="min-w-0 flex-1 truncate text-[13px] text-ink/70">
                              {contract.reference && (
                                <span className="font-mono font-medium text-ink">
                                  {contract.reference} ·{" "}
                                </span>
                              )}
                              {contract.provider}
                            </span>
                            {isSelected && (
                              <Check size={13} className="flex-shrink-0 text-accent" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Création : la fiche client reste le hub pour les contrats */}
          <div className="border-t border-ink/10 p-1.5">
            <button
              onClick={() => {
                setOpen(false);
                router.push("/clients?new=1");
              }}
              className="flex w-full items-center justify-center gap-1.5 px-2 py-1.5 text-[13px] font-medium text-accent hover:bg-accent/5 transition-colors"
            >
              <Plus size={14} />
              Nouveau client
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
