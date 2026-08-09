"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Check,
  Plus,
  FileSpreadsheet,
  Building2,
  FileText,
  ArrowRight,
} from "lucide-react";
import { useContract } from "@/contexts/ContractContext";
import { cn } from "@/lib/utils";
import CreateContractModal from "@/components/administratif/modals/CreateContractModal";
import AEImportModal from "@/components/administratif/modals/AEImportModal";

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAEModal, setShowAEModal] = useState(false);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const ref = useRef<HTMLDivElement>(null);

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

  if (isLoading) {
    return <div className="h-9 w-64 bg-ink/5 animate-pulse" />;
  }

  // Un groupe par client (même à 0 contrat), + un groupe "Sans client" pour les orphelins.
  const groups: ClientGroup[] = [];
  const idx = new Map<string, ClientGroup>();

  // Amorce : tous les clients existants, y compris ceux sans contrat
  for (const cl of clients) {
    const g: ClientGroup = { id: cl.id, name: cl.name, city: cl.city, contracts: [] };
    idx.set(cl.id, g);
    groups.push(g);
  }

  // Range les contrats dans leur client (ou "Sans client")
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
      groups.push(g);
    }
    g.contracts.push(c);
  }
  // Tri alpha, mais "Sans client" toujours en dernier (bac à orphelins)
  groups.sort((a, b) => {
    if (a.id === "__none__") return 1;
    if (b.id === "__none__") return -1;
    return a.name.localeCompare(b.name, "fr");
  });

  const currentClient = selectedContract?.client ?? null;

  return (
    <>
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
          <div className="absolute left-0 top-full mt-1 w-[420px] bg-white shadow-large border border-ink/15 py-1 z-50">
            {/* Lien fiche patrimoine pour le client courant */}
            {currentClient && (
              <Link
                href={`/clients/${currentClient.id}`}
                onClick={() => setOpen(false)}
                className="mx-2 mt-1 mb-1 flex items-center justify-between gap-2 border-l-2 border-accent bg-accent/5 px-3 py-2 hover:bg-accent/10 text-accent text-sm font-medium transition-colors"
              >
                <span className="flex items-center gap-2 truncate">
                  <Building2 size={14} className="flex-shrink-0" />
                  Patrimoine de {currentClient.name}
                </span>
                <ArrowRight size={14} className="flex-shrink-0" />
              </Link>
            )}

            {groups.length > 0 && (
              <>
                <div className="px-3 py-2 border-b border-ink/10">
                  <p className="label-tech">Clients &amp; contrats actifs</p>
                </div>
                <div className="max-h-80 overflow-y-auto py-1">
                  {groups.map((g) => (
                    <div key={g.id} className="mb-2 last:mb-0">
                      {/* En-tête client : le parent domine */}
                      {g.id !== "__none__" ? (
                        <Link
                          href={`/clients/${g.id}`}
                          onClick={() => setOpen(false)}
                          className="group/h mx-2 px-2 py-1.5 flex items-center gap-2 hover:bg-ink/[0.02] transition-colors"
                        >
                          <span className="text-sm font-semibold text-ink truncate">
                            {g.name}
                          </span>
                          <ArrowRight
                            size={13}
                            className="text-ink/20 opacity-0 group-hover/h:opacity-100 group-hover/h:text-accent transition-all flex-shrink-0"
                          />
                        </Link>
                      ) : (
                        <div className="mx-2 px-2 py-1.5">
                          <span className="text-sm font-semibold text-ink/40 truncate">
                            {g.name}
                          </span>
                        </div>
                      )}

                      {/* Contrats : enfants subordonnés, rail d'indentation */}
                      <div className="ml-[18px] pl-3 border-l border-ink/10">
                        {g.contracts.length === 0 && (
                          <p className="px-2 py-1.5 text-[11px] text-ink/30">
                            Aucun contrat
                          </p>
                        )}
                        {g.contracts.map((contract) => {
                          const isSelected = selectedContract?.id === contract.id;
                          // Évite le doublon nom de contrat == nom de client
                          const showRef =
                            contract.reference &&
                            contract.reference.trim().toLowerCase() !==
                              g.name.trim().toLowerCase();
                          return (
                            <button
                              key={contract.id}
                              onClick={() => {
                                selectContract(contract);
                                setOpen(false);
                              }}
                              className={cn(
                                "w-full px-2 py-1.5 text-left hover:bg-ink/[0.02] flex items-center gap-2 transition-colors",
                                isSelected && "bg-accent/5 text-accent"
                              )}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] text-ink/70 truncate">
                                  {showRef && (
                                    <span className="font-mono text-ink font-medium">
                                      {contract.reference} ·{" "}
                                    </span>
                                  )}
                                  {contract.title} — {contract.provider}
                                </p>
                              </div>
                              {contract._count && (
                                <span className="font-mono text-[10px] tabular-nums text-ink/40 flex-shrink-0">
                                  {contract._count.contractSites} site
                                  {contract._count.contractSites > 1 ? "s" : ""}
                                </span>
                              )}
                              {isSelected && (
                                <Check
                                  size={13}
                                  className="text-accent flex-shrink-0"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {groups.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-ink/40">
                Aucun client. Commence par en créer un.
              </div>
            )}

            {/* Actions de création — discrètes, en pied de menu */}
            <div className="border-t border-ink/10 p-1.5 flex items-center gap-1">
              <button
                onClick={() => {
                  setOpen(false);
                  router.push("/clients");
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[13px] font-medium text-accent hover:bg-accent/5 transition-colors"
              >
                <Plus size={14} />
                Client
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  setShowCreateModal(true);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[13px] text-ink/70 hover:bg-ink/[0.02] hover:text-accent transition-colors"
              >
                <FileText size={14} className="text-ink/40" />
                Contrat
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  setShowAEModal(true);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[13px] text-ink/70 hover:bg-ink/[0.02] hover:text-accent transition-colors"
              >
                <FileSpreadsheet size={14} className="text-ink/40" />
                Depuis AE
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateContractModal onClose={() => setShowCreateModal(false)} />
      )}
      {showAEModal && <AEImportModal onClose={() => setShowAEModal(false)} />}
    </>
  );
}
