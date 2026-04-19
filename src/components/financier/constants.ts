import { Check, Clock, X } from "lucide-react";

export const typeConfig = {
  P1: { label: "P1 - Énergie", color: "bg-orange-100 text-orange-700" },
  P2: { label: "P2 - Petit entretien", color: "bg-blue-100 text-blue-700" },
  P3: { label: "P3 - Gros entretien", color: "bg-purple-100 text-purple-700" },
  TRAVAUX: { label: "Travaux", color: "bg-green-100 text-green-700" },
  AUTRE: { label: "Autre", color: "bg-gray-100 text-gray-700" },
};

export const statusConfig = {
  EN_ATTENTE: { label: "En attente", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  VALIDEE: { label: "Validée", color: "bg-green-100 text-green-700", icon: Check },
  REFUSEE: { label: "Refusée", color: "bg-red-100 text-red-700", icon: X },
};
