import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Règle UI globale: les onglets sont triés par ordre alphabétique (français)
// et le premier sert d'onglet par défaut.
export function sortTabsAlpha<T extends { label: string }>(tabs: T[]): T[] {
  return [...tabs].sort((a, b) => a.label.localeCompare(b.label, "fr"));
}
