export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error("Erreur lors de la récupération");
    try {
      const body = await res.json();
      (error as Error & { info?: unknown; status?: number }).info = body;
    } catch {
      // ignore
    }
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }
  return res.json();
}
