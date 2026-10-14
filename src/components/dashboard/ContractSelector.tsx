"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, FileText, Search } from "lucide-react";
import { useContract } from "@/contexts/ContractContext";
import { cn } from "@/lib/utils";

type Contract = ReturnType<typeof useContract>["contracts"][number];

interface ClientGroup {
  id: string;
  name: string;
  contracts: Contract[];
}

/**
 * Sélecteur de contexte : uniquement des contrats, rangés sous le nom
 * de leur client (simple en-tête). La gestion des clients se fait sur
 * la page Clients.
 */
export function ContractSelector() {
  const { contracts, selectedContract, isLoading, selectContract } = useContract();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open]);

  // Un groupe par client ayant au moins un contrat, "Sans client" en dernier
  const groups = useMemo(() => {
    const idx = new Map<string, ClientGroup>();
    for (const c of contracts) {
      const key = c.client?.id || "__none__";
      let g = idx.get(key);
      if (!g) {
        g = { id: key, name: c.client?.name || "Sans client", contracts: [] };
        idx.set(key, g);
      }
      g.contracts.push(c);
    }
    const list = Array.from(idx.values());
    list.sort((a, b) => {
      if (a.id === "__none__") return 1;
      if (b.id === "__none__") return -1;
      return a.name.localeCompare(b.name, "fr");
    });
    for (const g of list) {
      g.contracts.sort((a, b) => (a.reference || a.title || "").localeCompare(b.reference || b.title || "", "fr"));
    }
    return list;
  }, [contracts]);

  // Filtre : nom du client, référence, titre ou exploitant
  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => {
        if (g.name.toLowerCase().includes(q)) return g;
        const kept = g.contracts.filter((c) =>
          [c.reference, c.title, c.provider].filter(Boolean).some((s) => s!.toLowerCase().includes(q))
        );
        return kept.length ? { ...g, contracts: kept } : null;
      })
      .filter((g): g is ClientGroup => g !== null);
  }, [groups, query]);

  if (isLoading) {
    return <div className="h-9 w-64 bg-ink/5 animate-pulse" />;
  }

  const pick = (contract: Contract) => {
    selectContract(contract);
    setOpen(false);
  };

  const label = selectedContract
    ? [selectedContract.client?.name, selectedContract.reference || selectedContract.title || selectedContract.provider || "Contrat sans référence"]
        .filter(Boolean)
        .join(" · ")
    : "Sélectionner un contrat";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 text-sm transition-colors border max-w-[460px]",
          open
            ? "border-accent bg-accent/5 text-accent"
            : "border-ink/20 text-ink hover:border-accent hover:text-accent"
        )}
      >
        <FileText size={15} className="text-ink/40 flex-shrink-0" />
        <span className="font-medium truncate">{label}</span>
        <ChevronDown
          size={14}
          className={cn("text-ink/40 transition-transform ml-auto flex-shrink-0", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-[400px] bg-white shadow-large border border-ink/15 z-50">
          <div className="flex items-center gap-2 border-b border-ink/10 px-3 py-2">
            <Search size={14} className="text-ink/30 flex-shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un contrat, un client, un exploitant..."
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink/30 focus:outline-none"
            />
          </div>

          <div className="max-h-96 overflow-y-auto py-1">
            {filteredGroups.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-ink/40">
                {groups.length === 0 ? "Aucun contrat. Créez-en un depuis la fiche d'un client." : "Aucun résultat"}
              </div>
            )}
            {filteredGroups.map((g) => (
              <div key={g.id} className="py-1">
                <div
                  className={cn(
                    "label-tech px-3 pt-1.5 pb-1 truncate",
                    g.id === "__none__" ? "text-ink/30" : "text-ink/50"
                  )}
                >
                  {g.name}
                </div>
                {g.contracts.map((contract) => {
                  const isSelected = selectedContract?.id === contract.id;
                  return (
                    <button
                      key={contract.id}
                      onClick={() => pick(contract)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-ink/[0.03]",
                        isSelected && "bg-accent/5"
                      )}
                    >
                      <span className={cn("min-w-0 flex-1 truncate text-[13px]", isSelected ? "text-accent" : "text-ink/80")}>
                        {contract.reference && (
                          <span className={cn("font-mono font-medium", isSelected ? "text-accent" : "text-ink")}>
                            {contract.reference}
                            {" · "}
                          </span>
                        )}
                        {contract.provider || contract.title || (contract.reference ? "" : "Contrat sans référence")}
                      </span>
                      {contract.status === "EN_ATTENTE" && (
                        <span className="label-tech flex-shrink-0 text-ink/40">en attente</span>
                      )}
                      {isSelected && <Check size={13} className="flex-shrink-0 text-accent" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
