"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

interface ContractSummary {
  id: string;
  reference: string;
  title: string;
  provider: string;
  status: string;
  startDate: string;
  endDate: string;
  yearType?: "CIVIL" | "HEATING_SEASON" | "CONTRACTUAL";
  billingFrequency?: "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL";
  client?: { id: string; name: string; city?: string | null } | null;
  _count?: { contractSites: number };
}

interface ContractContextType {
  contracts: ContractSummary[];
  selectedContract: ContractSummary | null;
  isLoading: boolean;
  selectContract: (contract: ContractSummary) => void;
  clearContract: () => void;
}

const ContractContext = createContext<ContractContextType | null>(null);

const STORAGE_KEY = "myxploit-selected-contract-id";

export function ContractProvider({ children }: { children: React.ReactNode }) {
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [selectedContract, setSelectedContract] =
    useState<ContractSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Fetch contracts
  const fetchContracts = useCallback(async () => {
    try {
      const res = await fetch("/api/contracts");
      if (res.ok) {
        const data = await res.json();
        const active = data.filter(
          (c: ContractSummary) => c.status === "ACTIF"
        );
        setContracts(active);
        return active;
      }
    } catch (error) {
      console.error("Error fetching contracts:", error);
    } finally {
      setIsLoading(false);
    }
    return [];
  }, []);

  // Initialize: fetch contracts then restore selection
  useEffect(() => {
    fetchContracts().then((active: ContractSummary[]) => {
      if (active.length === 0) return;

      // Priority: URL param > localStorage > first contract
      const urlContractId = searchParams.get("contract");
      const storedId =
        typeof window !== "undefined"
          ? localStorage.getItem(STORAGE_KEY)
          : null;
      const targetId = urlContractId || storedId;

      const found = targetId
        ? active.find((c: ContractSummary) => c.id === targetId)
        : null;
      setSelectedContract(found || active[0]);

      // Persist
      if (found || active[0]) {
        const id = (found || active[0]).id;
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, id);
        }
      }
    });
  }, [fetchContracts, searchParams]);

  const selectContract = useCallback(
    (contract: ContractSummary) => {
      setSelectedContract(contract);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, contract.id);
      }
      // Update URL param
      const params = new URLSearchParams(searchParams.toString());
      params.set("contract", contract.id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const clearContract = useCallback(() => {
    setSelectedContract(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return (
    <ContractContext.Provider
      value={{
        contracts,
        selectedContract,
        isLoading,
        selectContract,
        clearContract,
      }}
    >
      {children}
    </ContractContext.Provider>
  );
}

export function useContract() {
  const context = useContext(ContractContext);
  if (!context) {
    throw new Error("useContract must be used within a ContractProvider");
  }
  return context;
}

export function useSelectedContractId(): string | null {
  const { selectedContract } = useContract();
  return selectedContract?.id || null;
}
