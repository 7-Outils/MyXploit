"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, FileText, Check } from "lucide-react";
import { useContract } from "@/contexts/ContractContext";
import { cn } from "@/lib/utils";

export function ContractSelector() {
  const { contracts, selectedContract, isLoading, selectContract } =
    useContract();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (isLoading) {
    return (
      <div className="h-9 w-48 bg-gray-100 rounded-lg animate-pulse" />
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="text-sm text-gray-400 flex items-center gap-2">
        <FileText size={16} />
        Aucun contrat actif
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors border",
          open
            ? "border-accent/30 bg-accent/5 text-accent"
            : "border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50"
        )}
      >
        <FileText size={15} className="text-gray-400 flex-shrink-0" />
        <span className="max-w-[200px] truncate font-medium">
          {selectedContract?.reference || "Sélectionner un contrat"}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            "text-gray-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-80 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Contrats actifs
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {contracts.map((contract) => {
              const isSelected = selectedContract?.id === contract.id;
              return (
                <button
                  key={contract.id}
                  onClick={() => {
                    selectContract(contract);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2.5 text-left hover:bg-gray-50 flex items-start gap-3 transition-colors",
                    isSelected && "bg-accent/5"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {contract.reference}
                      </span>
                      {contract._count && (
                        <span className="text-xs text-gray-400">
                          {contract._count.contractSites} site
                          {contract._count.contractSites > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {contract.title} - {contract.provider}
                    </p>
                  </div>
                  {isSelected && (
                    <Check size={16} className="text-accent mt-0.5 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
