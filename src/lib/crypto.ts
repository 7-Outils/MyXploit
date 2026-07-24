import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Chiffrement des secrets stockés en DB (tokens OAuth Enedis/GRDF).
 * AES-256-GCM, clé 32 octets en base64 dans TOKEN_ENCRYPTION_KEY.
 * Format stocké : "enc.v1.<iv>.<tag>.<ciphertext>" (base64url).
 *
 * Générer une clé : openssl rand -base64 32
 */

const PREFIX = "enc.v1.";

function getKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    console.error("TOKEN_ENCRYPTION_KEY invalide: attendu 32 octets en base64");
    return null;
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  if (!key) {
    // Ne jamais casser une connexion Enedis/GRDF pour une clé absente,
    // mais le signaler bruyamment : le secret partirait en clair.
    console.error(
      "TOKEN_ENCRYPTION_KEY manquante — secret stocké EN CLAIR. Configurer la variable d'environnement."
    );
    return plaintext;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return (
    PREFIX +
    [iv, tag, ciphertext].map((b) => b.toString("base64url")).join(".")
  );
}

/**
 * Déchiffre une valeur. Les valeurs legacy stockées en clair (sans préfixe)
 * sont renvoyées telles quelles — elles seront re-chiffrées à la prochaine
 * écriture (reconnexion ou refresh de token).
 */
export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;

  const key = getKey();
  if (!key) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY manquante: impossible de déchiffrer un secret chiffré"
    );
  }

  const [ivB64, tagB64, ctB64] = stored.slice(PREFIX.length).split(".");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
