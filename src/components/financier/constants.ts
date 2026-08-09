import { Check, Clock, X } from "lucide-react";

export const typeConfig = {
  P1: { label: "P1 - Énergie", color: "bg-orange-50 text-orange-700 border border-orange-600/20" },
  P2: { label: "P2 - Petit entretien", color: "bg-accent/10 text-accent border border-accent/20" },
  P3: { label: "P3 - Gros entretien", color: "bg-ink/5 text-ink border border-ink/10" },
  TRAVAUX: { label: "Travaux", color: "bg-green-50 text-green-700 border border-green-600/20" },
  AUTRE: { label: "Autre", color: "bg-ink/5 text-ink/80 border border-ink/10" },
};

export const statusConfig = {
  EN_ATTENTE: { label: "En attente", color: "bg-amber-50 text-amber-700 border border-amber-600/20", icon: Clock },
  VALIDEE: { label: "Validée", color: "bg-green-50 text-green-700 border border-green-600/20", icon: Check },
  REFUSEE: { label: "Refusée", color: "bg-red-50 text-red-700 border border-red-600/20", icon: X },
};
