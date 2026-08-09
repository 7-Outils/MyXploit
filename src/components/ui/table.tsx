/**
 * Primitives de table partagées — thème « bureau d'études » : panneau à
 * hairline (pas d'ombre, coins carrés), en-têtes de colonne en label mono
 * (.label-tech), lignes séparées par des hairlines ink/10.
 *
 * Usage :
 *   <Table>
 *     <THead>
 *       <Th>Référence</Th>
 *       <Th align="right">Montant</Th>
 *     </THead>
 *     <TBody>
 *       {rows.length === 0 && <TableEmpty colSpan={2} message="Aucune facture" />}
 *       {rows.map((r) => (
 *         <Tr key={r.id} onClick={() => open(r)}>
 *           <Td>{r.ref}</Td>
 *           <Td align="right">{r.amount} €</Td>
 *         </Tr>
 *       ))}
 *     </TBody>
 *   </Table>
 */

import { cn } from "@/lib/utils";

export function Table({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden border border-ink/10 bg-white",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full">{children}</table>
      </div>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-ink/10 bg-white">
      <tr>{children}</tr>
    </thead>
  );
}

export function Th({
  children,
  align = "left",
  className,
}: {
  children?: React.ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
}) {
  return (
    <th
      className={cn(
        "label-tech whitespace-nowrap px-4 py-2.5",
        align === "left" && "text-left",
        align === "center" && "text-center",
        align === "right" && "text-right",
        className
      )}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-ink/10">{children}</tbody>;
}

export function Tr({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "transition-colors",
        onClick && "cursor-pointer hover:bg-ink/[0.02]",
        className
      )}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  align = "left",
  className,
}: {
  children?: React.ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-4 py-2.5 text-sm text-ink/80",
        align === "center" && "text-center",
        // Colonnes de droite = valeurs chiffrées : chiffres alignés
        align === "right" && "text-right tabular-nums",
        className
      )}
    >
      {children}
    </td>
  );
}

export function TableEmpty({
  colSpan,
  message,
}: {
  colSpan: number;
  message: string;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-10 text-center text-sm text-ink/40"
      >
        {message}
      </td>
    </tr>
  );
}
