"use client";

/**
 * Contrat › Contacts : le carnet du contrat, en deux colonnes — Exploitant et
 * Client. Ajout et modification en place, suppression confirmée.
 */

import { useState } from "react";
import useSWR from "swr";
import { Check, Copy, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";
import { api, getErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/contexts/PermissionContext";

type Side = "EXPLOITANT" | "CLIENT";

interface ContractContact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  side: Side;
}

type Draft = Omit<ContractContact, "id">;

const SIDES: { value: Side; label: string }[] = [
  { value: "EXPLOITANT", label: "Exploitant" },
  { value: "CLIENT", label: "Client" },
];

const iconBtn =
  "flex h-9 w-9 flex-shrink-0 items-center justify-center text-ink/45 transition-colors hover:bg-ink/[0.03] hover:text-accent disabled:pointer-events-none disabled:opacity-30";
const inputCls =
  "h-9 w-full border border-ink/20 bg-white px-2.5 text-sm text-ink placeholder:text-ink/35 focus:border-accent focus:outline-none";

const emptyDraft = (side: Side): Draft => ({ firstName: "", lastName: "", email: "", phone: "", role: "", side });

function displayName(c: Pick<ContractContact, "firstName" | "lastName" | "email">): string {
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return name || c.email || "Sans nom";
}

function initials(c: Pick<ContractContact, "firstName" | "lastName" | "email">): string {
  const a = c.firstName?.trim()?.[0] ?? "";
  const b = c.lastName?.trim()?.[0] ?? "";
  const s = (a + b) || c.email?.trim()?.[0] || "?";
  return s.toUpperCase();
}

/** 0612345678 → 06 12 34 56 78 ; le reste tel quel. */
function formatPhone(p: string): string {
  const digits = p.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) return digits.replace(/(\d{2})(?=\d)/g, "$1 ");
  return p;
}

// ─── Formulaire ─────────────────────────────────────────────────────────────

function ContactForm({
  initial,
  mode,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  mode: "add" | "edit";
  busy: boolean;
  onSubmit: (d: Draft) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const filled = !!(d.firstName?.trim() || d.lastName?.trim() || d.email?.trim());

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (filled && !busy) onSubmit(d);
      }}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      className="space-y-2 border-y border-accent/40 bg-accent/[0.025] px-4 py-3 animate-fade-in"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex border border-ink/20" role="radiogroup" aria-label="Côté">
          {SIDES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={d.side === s.value}
              onClick={() => set("side", s.value)}
              className={cn(
                "h-8 border-l border-ink/10 px-3 font-mono text-[11px] uppercase tracking-wider transition-colors first:border-l-0",
                d.side === s.value ? "bg-ink text-paper" : "text-ink/55 hover:bg-ink/[0.03] hover:text-accent"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="submit"
            disabled={busy || !filled}
            title={filled ? (mode === "add" ? "Ajouter (Entrée)" : "Enregistrer (Entrée)") : "Indiquez un prénom, un nom ou un email"}
            className="flex h-9 w-9 items-center justify-center bg-ink text-paper transition-colors hover:bg-accent disabled:opacity-40"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : mode === "add" ? <Plus size={16} /> : <Check size={16} />}
          </button>
          <button
            type="button"
            onClick={onCancel}
            title="Annuler (Échap)"
            className="flex h-9 w-9 items-center justify-center border border-ink/20 text-ink/60 transition-colors hover:border-accent hover:text-accent"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          autoFocus
          aria-label="Prénom"
          placeholder="Prénom"
          value={d.firstName ?? ""}
          onChange={(e) => set("firstName", e.target.value)}
          className={inputCls}
        />
        <input
          aria-label="Nom"
          placeholder="Nom"
          value={d.lastName ?? ""}
          onChange={(e) => set("lastName", e.target.value)}
          className={inputCls}
        />
      </div>
      <input
        aria-label="Fonction"
        placeholder="Fonction (ex. responsable d'exploitation)"
        value={d.role ?? ""}
        onChange={(e) => set("role", e.target.value)}
        className={inputCls}
      />
      <div className="grid grid-cols-[1fr_11rem] gap-2">
        <input
          type="email"
          aria-label="Email"
          placeholder="email@domaine.fr"
          value={d.email ?? ""}
          onChange={(e) => set("email", e.target.value)}
          className={cn(inputCls, "font-mono")}
        />
        <input
          type="tel"
          aria-label="Téléphone"
          placeholder="Téléphone"
          value={d.phone ?? ""}
          onChange={(e) => set("phone", e.target.value)}
          className={cn(inputCls, "font-mono tabular-nums")}
        />
      </div>
    </form>
  );
}

// ─── Fiche ──────────────────────────────────────────────────────────────────

function ContactRow({
  contact,
  fresh,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  contact: ContractContact;
  fresh: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!contact.email) return;
    try {
      await navigator.clipboard.writeText(contact.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // presse-papiers refusé : rien à faire
    }
  };

  return (
    <li className={cn("group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-ink/[0.015]", fresh && "animate-row-flash")}>
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center border border-ink/10 bg-ink/[0.03] font-mono text-xs font-medium text-ink/70">
        {initials(contact)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="truncate text-sm font-medium text-ink">{displayName(contact)}</span>
          {!contact.email && (
            <span
              title="Sans email, ce contact n'est pas proposé comme destinataire des devis acceptés"
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-ink/40"
            >
              <span className="inline-block h-1.5 w-1.5 bg-amber-600" />
              sans email
            </span>
          )}
        </div>
        {contact.role && <div className="truncate text-xs text-ink/50">{contact.role}</div>}
        {(contact.email || contact.phone) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 font-mono text-xs">
            {contact.email && (
              <span className="inline-flex min-w-0 items-center">
                <a
                  href={`mailto:${contact.email}`}
                  className="truncate text-ink/70 transition-colors hover:text-accent"
                  title={`Écrire à ${contact.email}`}
                >
                  {contact.email}
                </a>
                <button
                  type="button"
                  onClick={copy}
                  title={copied ? "Copié" : "Copier l'email"}
                  className={cn(
                    "-my-2 flex h-9 w-9 flex-shrink-0 items-center justify-center transition-colors",
                    copied ? "text-green-700" : "text-ink/30 hover:text-accent"
                  )}
                >
                  {copied ? <Check size={13} className="animate-pop-in" /> : <Copy size={12} />}
                </button>
              </span>
            )}
            {contact.phone && (
              <a
                href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
                className="tabular-nums text-ink/70 transition-colors hover:text-accent"
                title={`Appeler le ${contact.phone}`}
              >
                {formatPhone(contact.phone)}
              </a>
            )}
          </div>
        )}
      </div>

      {(canEdit || canDelete) && (
        <div className="flex flex-shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          {canEdit && (
            <button type="button" className={iconBtn} title="Modifier" onClick={onEdit}>
              <Pencil size={14} />
            </button>
          )}
          {canDelete && (
            <button type="button" className={cn(iconBtn, "hover:text-red-700")} title="Supprimer" onClick={onDelete}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </li>
  );
}

// ─── Onglet ─────────────────────────────────────────────────────────────────

export default function ContractContactsTab({ contractId }: { contractId: string }) {
  const toast = useToast();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const url = `/api/contracts/${contractId}/contacts`;
  const { data, isLoading, mutate } = useSWR<ContractContact[]>(url, fetcher);
  const contacts = Array.isArray(data) ? data : [];

  const [addingSide, setAddingSide] = useState<Side | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ContractContact | null>(null);
  const [busy, setBusy] = useState(false);
  const [freshId, setFreshId] = useState<string | null>(null);

  const flash = (id: string) => {
    setFreshId(id);
    window.setTimeout(() => setFreshId((cur) => (cur === id ? null : cur)), 1800);
  };

  const payload = (d: Draft) => ({
    firstName: d.firstName?.trim() || null,
    lastName: d.lastName?.trim() || null,
    email: d.email?.trim() || null,
    phone: d.phone?.trim() || null,
    role: d.role?.trim() || null,
    side: d.side,
  });

  const create = async (d: Draft) => {
    setBusy(true);
    try {
      const created = await api.post<ContractContact>(url, payload(d));
      await mutate((cur) => [...(cur ?? []), created], { revalidate: true });
      setAddingSide(null);
      if (created?.id) flash(created.id);
      toast.success("Contact ajouté");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const update = async (id: string, d: Draft) => {
    setBusy(true);
    try {
      const updated = await api.put<ContractContact>(`${url}/${id}`, payload(d));
      await mutate((cur) => (cur ?? []).map((c) => (c.id === id ? updated : c)), { revalidate: true });
      setEditingId(null);
      flash(id);
      toast.success("Contact modifié");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    const id = deleting.id;
    setBusy(true);
    try {
      await api.del(`${url}/${id}`);
      await mutate((cur) => (cur ?? []).filter((c) => c.id !== id), { revalidate: false });
      setDeleting(null);
      toast.success("Contact supprimé");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {SIDES.map(({ value: side, label }) => {
          const list = contacts.filter((c) => c.side === side);
          const adding = addingSide === side;
          return (
            <section key={side} className="panel self-start">
              <div className="panel-header">
                <div className="flex items-baseline gap-2">
                  <span className="label-tech !text-ink/70">{label}</span>
                  <span className="font-mono text-xs tabular-nums text-ink/40">{list.length}</span>
                </div>
                {canCreate && (
                  <button
                    type="button"
                    className={cn(
                      "-my-1.5 flex h-9 w-9 items-center justify-center border border-ink/20 text-ink/60 transition-colors hover:border-accent hover:text-accent",
                      adding && "border-accent text-accent"
                    )}
                    title={adding ? "Fermer" : `Ajouter un contact ${label.toLowerCase()}`}
                    onClick={() => {
                      setEditingId(null);
                      setAddingSide(adding ? null : side);
                    }}
                  >
                    <Plus size={16} className={cn("transition-transform duration-200", adding && "rotate-45")} />
                  </button>
                )}
              </div>

              {adding && (
                <ContactForm
                  key={`add-${side}`}
                  initial={emptyDraft(side)}
                  mode="add"
                  busy={busy}
                  onSubmit={create}
                  onCancel={() => setAddingSide(null)}
                />
              )}

              {list.length === 0 && !adding ? (
                <p className="px-4 py-6 text-center text-sm text-ink/40">Aucun contact {label.toLowerCase()}</p>
              ) : (
                <ul className="divide-y divide-ink/[0.07]">
                  {list.map((c) =>
                    editingId === c.id ? (
                      <li key={c.id}>
                        <ContactForm
                          initial={{
                            firstName: c.firstName ?? "",
                            lastName: c.lastName ?? "",
                            email: c.email ?? "",
                            phone: c.phone ?? "",
                            role: c.role ?? "",
                            side: c.side,
                          }}
                          mode="edit"
                          busy={busy}
                          onSubmit={(d) => update(c.id, d)}
                          onCancel={() => setEditingId(null)}
                        />
                      </li>
                    ) : (
                      <ContactRow
                        key={c.id}
                        contact={c}
                        fresh={freshId === c.id}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        onEdit={() => {
                          setAddingSide(null);
                          setEditingId(c.id);
                        }}
                        onDelete={() => setDeleting(c)}
                      />
                    )
                  )}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {deleting && (
        <Modal
          title="Supprimer le contact"
          subtitle={displayName(deleting)}
          onClose={() => setDeleting(null)}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleting(null)} disabled={busy}>
                Annuler
              </Button>
              <Button onClick={remove} disabled={busy} className="bg-red-700 hover:bg-red-800">
                {busy && <Loader2 size={14} className="mr-2 animate-spin" />}
                Supprimer
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink/70">Le contact sera supprimé.</p>
        </Modal>
      )}
    </>
  );
}
