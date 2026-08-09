"use client";

/**
 * Modal partagé — remplace les overlays réécrits dans chaque composant.
 *
 * Usage :
 *   {open && (
 *     <Modal title="Importer un AE" onClose={() => setOpen(false)} size="lg"
 *            footer={<Button onClick={save}>Enregistrer</Button>}>
 *       …contenu…
 *     </Modal>
 *   )}
 *
 * Gère : Escape, clic sur le fond, blocage du scroll, focus initial.
 */

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

const SIZES = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
} as const;

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof SIZES;
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[90vh] w-full flex-col border border-ink/15 bg-white shadow-large outline-none ${SIZES[size]}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-sm text-ink/50">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            title="Fermer"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-ink/10 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
