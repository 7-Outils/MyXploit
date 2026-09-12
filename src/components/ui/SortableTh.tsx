"use client";

/**
 * En-tête de colonne triable : flèche discrète sur la colonne active
 * seulement. Le tri lui-même est appliqué côté serveur — la page ne voit
 * qu'un extrait de la table, trier les lignes affichées mentirait.
 *
 * Usage :
 *   const [sort, setSort] = useState({ key: "issueDate", dir: "desc" });
 *   const toggleSort = (key) =>
 *     setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));
 *   <SortableTh label="Date" col="issueDate" sort={sort} onSort={toggleSort} />
 */

export interface SortState<K extends string> {
  key: K;
  dir: "asc" | "desc";
}

export function SortableTh<K extends string>({
  label,
  col,
  sort,
  onSort,
  className = "text-left",
}: {
  label: string;
  col: K;
  sort: SortState<K>;
  onSort: (k: K) => void;
  className?: string;
}) {
  const active = sort.key === col;
  return (
    <th className={`label-tech px-4 py-2.5 ${className}`}>
      <button
        type="button"
        onClick={() => onSort(col)}
        title={`Trier par ${label.toLowerCase()}`}
        className={`inline-flex items-center gap-1 hover:text-ink ${active ? "text-ink" : ""}`}
      >
        {label}
        <span className={`font-mono text-[10px] ${active ? "" : "invisible"}`}>
          {sort.dir === "asc" ? "↑" : "↓"}
        </span>
      </button>
    </th>
  );
}
