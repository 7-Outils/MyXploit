"use client";

interface Props {
  reference?: string;
  title?: string;
  startDate: string | Date;
  endDate: string | Date;
}

function fmt(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ContractPeriodBar({ reference, title, startDate, endDate }: Props) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = Date.now();

  const span = end.getTime() - start.getTime();
  const elapsed = Math.max(0, now - start.getTime());
  const progress = span > 0 ? Math.min(100, (elapsed / span) * 100) : 0;
  const totalDays = Math.max(1, Math.round(span / 86_400_000));
  const elapsedDays = Math.max(0, Math.round(elapsed / 86_400_000));
  const daysLeft = totalDays - elapsedDays;
  const isExpired = daysLeft < 0;
  const isEndingSoon = !isExpired && daysLeft <= 90;

  const barColor = isExpired ? "bg-rose-500" : isEndingSoon ? "bg-amber-500" : "bg-accent";
  const statusColor = isExpired ? "text-rose-700" : isEndingSoon ? "text-amber-700" : "text-text-secondary";
  const statusLabel = isExpired
    ? `expiré · ${Math.abs(daysLeft)} j`
    : `${daysLeft.toLocaleString("fr-FR")} j restants`;

  return (
    <div className="bg-white rounded-lg border border-gray-200/80 px-4 h-11 flex items-center gap-4 text-xs">
      {reference && (
        <span className="text-text-secondary shrink-0">
          Contrat <span className="text-primary-dark font-semibold">{reference}</span>
        </span>
      )}
      {title && (
        <span className="text-text-secondary truncate shrink min-w-0 hidden md:inline">{title}</span>
      )}
      <span className="text-text-secondary tabular-nums shrink-0 hidden sm:inline">
        {fmt(start)} → {fmt(end)}
      </span>

      <div className="flex-1 min-w-[80px] relative h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={`absolute inset-y-0 left-0 ${barColor} transition-all`} style={{ width: `${progress}%` }} />
      </div>

      <span className="text-primary-dark tabular-nums font-semibold shrink-0">
        {Math.round(progress)}%
      </span>
      <span className={`tabular-nums font-medium shrink-0 ${statusColor}`}>
        {statusLabel}
      </span>
    </div>
  );
}
