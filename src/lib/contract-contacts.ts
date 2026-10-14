/** Validation d'un contact de contrat (API contacts). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (v: unknown, max = 120) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Tous les champs sont facultatifs ; il faut juste quelque chose qui identifie la personne. */
export function parseContact(body: Record<string, unknown>) {
  const firstName = text(body.firstName);
  const lastName = text(body.lastName);
  const email = text(body.email, 200);
  const phone = text(body.phone, 40);
  const role = text(body.role);
  const side = body.side === "CLIENT" ? "CLIENT" : "EXPLOITANT";
  if (email && !EMAIL_RE.test(email)) return { error: "Adresse email invalide" } as const;
  if (!firstName && !lastName && !email) return { error: "Indiquez au moins un prénom, un nom ou un email" } as const;
  return { data: { firstName, lastName, email, phone, role, side } } as const;
}
