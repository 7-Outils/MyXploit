// Couleurs d'urgence : sémantiques uniquement (rouge = critique, orange/ambre =
// attention), le reste en encre neutre — thème « bureau d'études ».
export const URGENCY_CONFIG = {
  CRITICAL: {
    label: "Critique",
    color: "bg-red-50 text-red-700 border border-red-600/20",
    bgColor: "bg-red-600",
  },
  HIGH: {
    label: "Haute",
    color: "bg-orange-50 text-orange-700 border border-orange-600/20",
    bgColor: "bg-orange-500",
  },
  MEDIUM: {
    label: "Moyenne",
    color: "bg-amber-50 text-amber-700 border border-amber-600/20",
    bgColor: "bg-amber-500",
  },
  LOW: {
    label: "Basse",
    color: "bg-white text-ink/60 border border-ink/15",
    bgColor: "bg-ink/30",
  },
  NONE: {
    label: "Aucune",
    color: "bg-white text-ink/40 border border-ink/10",
    bgColor: "bg-ink/15",
  },
};
