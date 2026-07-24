/**
 * Client API centralisé.
 *
 * Remplace les fetch('/api/…') dispersés : parse le JSON, extrait le
 * message d'erreur renvoyé par les routes ({ error: "…" }) et jette une
 * ApiError avec un message affichable tel quel dans un toast.
 *
 * Usage :
 *   const { workOrders } = await api.get<{ workOrders: WorkOrder[] }>("/api/work-orders");
 *   await api.post("/api/tickets", { title });
 *   catch (e) { toast.error(getErrorMessage(e)); }
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  method: string,
  url: string,
  body?: unknown
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Erreur de connexion au serveur", 0);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (data && typeof data.error === "string" && data.error) ||
      `Erreur serveur (${response.status})`;
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T = unknown>(url: string, body?: unknown) => request<T>("POST", url, body),
  put: <T = unknown>(url: string, body?: unknown) => request<T>("PUT", url, body),
  patch: <T = unknown>(url: string, body?: unknown) => request<T>("PATCH", url, body),
  del: <T = unknown>(url: string) => request<T>("DELETE", url),
};

/** Message affichable pour n'importe quelle erreur attrapée. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue";
}
