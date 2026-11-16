export async function api<T = Record<string, unknown>>(
  route: string,
  method = "GET",
  value?: unknown,
): Promise<T> {
  const res = await fetch(`/api/${route}`, {
    method,
    headers:
      value instanceof FormData
        ? undefined
        : value !== undefined
          ? { "Content-Type": "application/json" }
          : undefined,
    body:
      value instanceof FormData
        ? value
        : value !== undefined
          ? JSON.stringify(value)
          : undefined,
    cache: "no-store",
  });
  const result = await res.json();
  if (!res.ok)
    throw new Error(result.error || "No se pudo completar la operación.");
  return result;
}
export function download(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const date = (s: string) =>
  new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(s));
export type Session = {
  demo: boolean;
  accepting: boolean;
  evidence_enabled: boolean;
  user: null | {
    id: string;
    name: string;
    email: string;
    role: string;
    needsMfa: boolean;
  };
};
