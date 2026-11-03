import {
  isAllowedOrigin,
  isJsonRpcRequest,
  isUuid,
  isoDate,
  parseAllowedOrigins,
  parseBearerToken,
  SUPPORTED_PROTOCOL_VERSIONS,
} from "./security.ts";

Deno.test("Bearer parser accepts only a single Bearer token", () => {
  if (parseBearerToken("Bearer abc.def_123-~") !== "abc.def_123-~") throw new Error("valid token rejected");
  for (const value of [null, "", "Basic abc", "Bearer ", "Bearer abc extra", "Bearer " + "x".repeat(9000)]) {
    if (parseBearerToken(value) !== null) throw new Error("invalid bearer header accepted");
  }
});

Deno.test("Origin validation rejects absent allowlist, null and lookalike origins", () => {
  const allowed = ["https://noor.example", "https://admin.noor.example"];
  if (!isAllowedOrigin(null, allowed)) throw new Error("server-side client should be allowed");
  for (const origin of ["null", "https://noor.example.attacker.test", "https://noor.example/path", "javascript:alert(1)"]) {
    if (isAllowedOrigin(origin, allowed)) throw new Error("untrusted origin accepted: " + origin);
  }
  if (!isAllowedOrigin("https://noor.example", allowed)) throw new Error("configured origin rejected");
});

Deno.test("Origin allowlist parsing only retains exact HTTP(S) origins", () => {
  const parsed = parseAllowedOrigins("https://noor.example, https://noor.example/path, javascript:bad,https://admin.noor.example");
  if (parsed.length !== 2 || !parsed.includes("https://noor.example")) throw new Error("origin parsing failed");
});

Deno.test("UUID validation rejects malformed tenant IDs", () => {
  if (!isUuid("123e4567-e89b-42d3-a456-426614174000")) throw new Error("valid UUID rejected");
  if (isUuid("not-a-uuid") || isUuid(42)) throw new Error("invalid UUID accepted");
});

Deno.test("Date validation rejects impossible calendar dates", () => {
  if (isoDate("2026-11-03") !== "2026-11-03") throw new Error("valid date rejected");
  for (const value of ["2026-02-30", "03-11-2026", "2026-2-03", null]) {
    if (isoDate(value) !== null) throw new Error("invalid date accepted");
  }
});

Deno.test("JSON-RPC request shape and supported protocol versions are explicit", () => {
  if (!isJsonRpcRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" })) throw new Error("valid request rejected");
  if (isJsonRpcRequest({ jsonrpc: "1.0", id: 1, method: "tools/list" })) throw new Error("bad version accepted");
  if (isJsonRpcRequest({ jsonrpc: "2.0", id: {}, method: "tools/list" })) throw new Error("bad id accepted");
  if (!SUPPORTED_PROTOCOL_VERSIONS.includes("2025-11-25")) throw new Error("current protocol version missing");
});
