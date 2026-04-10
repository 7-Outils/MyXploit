export const statusLabels = {
  ACTIF: "Actif",
  EXPIRE: "Expiré",
  EN_ATTENTE: "En attente",
  RESILIE: "Résilié",
};

export const parseFrenchDate = (dateStr: string): string => {
  const parts = dateStr.split("/");
  if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  return dateStr;
};

export const formatToFrench = (isoDate: string): string => {
  const date = isoDate.split("T")[0];
  const parts = date.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return date;
};
