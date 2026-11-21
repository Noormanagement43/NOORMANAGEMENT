export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"] as const;

export function parseBearerToken(header: string | null): string | null {
  if (!header || header.length > 8200) return null;
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export function isAllowedOrigin(origin: string | null, allowedOrigins: string[]): boolean {
  if (origin === null) return true; // Native/server-side MCP clients do not send Origin.
  if (origin === "null" || origin.length > 512) return false;
  let parsed: URL;
  try { parsed = new URL(origin); } catch { return false; }
  if (!["https:", "http:"].includes(parsed.protocol)) return false;
  if (parsed.origin !== origin || parsed.username || parsed.password) return false;
  return allowedOrigins.includes(parsed.origin);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isoDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

export function isJsonRpcRequest(value: unknown): value is {
  jsonrpc: "2.0"; method: string; id?: string | number; params?: Record<string, unknown>;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (item.jsonrpc !== "2.0" || typeof item.method !== "string" || !item.method.length) return false;
  if (item.id !== undefined && !(typeof item.id === "string" || (typeof item.id === "number" && Number.isFinite(item.id)))) return false;
  if (item.params !== undefined && (!item.params || typeof item.params !== "object" || Array.isArray(item.params))) return false;
  return true;
}

export function parseAllowedOrigins(value: string | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))].filter((item) => {
    try {
      const parsed = new URL(item);
      return ["https:", "http:"].includes(parsed.protocol) && parsed.origin === item && !parsed.username && !parsed.password;
    } catch { return false; }
  });
}
