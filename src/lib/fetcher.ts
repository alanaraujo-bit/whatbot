/** Erro HTTP com o corpo já desserializado, para os formulários lerem `fields`. */
export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields?: Record<string, string>
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Fetcher padrão do SWR. */
export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new HttpError(body.error ?? "Falha ao carregar dados", res.status, body.fields);
  }

  return res.json() as Promise<T>;
}

/** Wrapper para mutações (POST/PATCH/DELETE) com erro tipado. */
export async function apiRequest<T = unknown>(
  url: string,
  options: { method: "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown } = { method: "POST" }
): Promise<T> {
  const res = await fetch(url, {
    method: options.method,
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new HttpError(data.error ?? "Operação falhou", res.status, data.fields);
  }

  return data as T;
}
