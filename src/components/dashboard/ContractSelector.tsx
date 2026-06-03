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
    return <div className="h-9 w-64 bg-gray-100 rounded-lg animate-pulse" />;
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
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors border max-w-[420px]",
            open
              ? "border-accent/30 bg-accent/5 text-accent"
              : "border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50"
          )}
        >
          <Building2 size={15} className="text-gray-400 flex-shrink-0" />
          <span className="font-medium truncate">
            {currentClient?.name || "Sélectionner un client"}
          </span>
          <ChevronDown
            size={14}
            className={cn(
              "text-gray-400 transition-transform ml-auto flex-shrink-0",
              open && "rotate-180"
            )}
          />
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 w-[420px] bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
            {/* Lien fiche patrimoine pour le client courant */}
            {currentClient && (
              <Link
                href={`/clients/${currentClient.id}`}
                onClick={() => setOpen(false)}
                className="mx-2 mt-2 mb-1 flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-accent/5 hover:bg-accent/10 text-accent text-sm font-medium transition-colors"
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
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                    Clients & contrats actifs
                  </p>
                </div>
                <div className="max-h-80 overflow-y-auto py-1">
                  {groups.map((g) => (
                    <div key={g.id} className="mb-1 last:mb-0">
                      <div className="px-3 py-1.5 flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-700 truncate">
                            {g.name}
                          </p>
                          {g.city && (
                            <p className="text-[10px] text-gray-400 truncate">
                              {g.city}
                            </p>
                          )}
                        </div>
                        {g.id !== "__none__" && (
                          <Link
                            href={`/clients/${g.id}`}
                            onClick={() => setOpen(false)}
                            className="text-[10px] text-accent hover:underline flex-shrink-0"
                          >
                            Voir patrimoine
                          </Link>
                        )}
                      </div>
                      {g.contracts.map((contract) => {
                        const isSelected = selectedContract?.id === contract.id;
                        return (
                          <button
                            key={contract.id}
                            onClick={() => {
                              selectContract(contract);
                              setOpen(false);
                            }}
                            className={cn(
                              "w-full pl-6 pr-3 py-2 text-left hover:bg-gray-50 flex items-start gap-2 transition-colors",
                              isSelected && "bg-accent/5"
                            )}
                          >
                            <FileText
                              size={13}
                              className="text-gray-300 mt-0.5 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-900 truncate">
                                  {contract.reference}
                                </span>
                                {contract._count && (
                                  <span className="text-[10px] text-gray-400">
                                    {contract._count.contractSites} site
                                    {contract._count.contractSites > 1 ? "s" : ""}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-500 truncate">
                                {contract.title} — {contract.provider}
                              </p>
                            </div>
                            {isSelected && (
                              <Check
                                size={14}
                                className="text-accent mt-1 flex-shrink-0"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </>
            )}

            {groups.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-gray-400">
                Aucun client. Commence par en créer un.
              </div>
            )}

            {/* Actions de création — Client en primary */}
            <div className="border-t border-gray-100 p-2 space-y-1">
              <button
                onClick={() => {
                  setOpen(false);
                  router.push("/clients");
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-accent hover:bg-accent/90 rounded-lg transition-colors"
              >
                <Plus size={16} />
                Nouveau client
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  setShowCreateModal(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <FileText size={16} className="text-gray-400" />
                Nouveau contrat
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  setShowAEModal(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <FileSpreadsheet size={16} className="text-gray-400" />
                Créer depuis AE
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
