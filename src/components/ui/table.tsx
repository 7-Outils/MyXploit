/**
 * Primitives de table partagées — reprennent l'idiome des tables existantes
 * (card blanche arrondie, thead gris, en-têtes uppercase) pour remplacer
 * les <table> réécrites page par page.
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
        "overflow-hidden rounded-xl border border-gray-100 bg-white",
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
    <thead className="border-b border-gray-100 bg-gray-50/50">
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
        "px-6 py-3 text-xs font-medium uppercase text-gray-500",
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
  return <tbody className="divide-y divide-gray-50">{children}</tbody>;
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
        onClick && "cursor-pointer hover:bg-gray-50",
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
        "px-6 py-3.5 text-sm text-gray-700",
        align === "center" && "text-center",
        align === "right" && "text-right",
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
        className="px-6 py-12 text-center text-sm text-gray-400"
      >
        {message}
      </td>
    </tr>
  );
}
