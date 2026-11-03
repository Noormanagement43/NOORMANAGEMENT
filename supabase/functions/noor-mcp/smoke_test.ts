const endpoint = Deno.env.get("NOOR_MCP_TEST_ENDPOINT");
const studentToken = Deno.env.get("NOOR_MCP_TEST_STUDENT_TOKEN");
const principalToken = Deno.env.get("NOOR_MCP_TEST_PRINCIPAL_TOKEN");
const otherInstitutionId = Deno.env.get("NOOR_MCP_TEST_OTHER_INSTITUTION_ID");
const protocolVersion = "2025-11-25";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function headers(token?: string, origin?: string, version?: string) {
  const result = new Headers({
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
  });
  if (token) result.set("Authorization", "Bearer " + token);
  if (origin) result.set("Origin", origin);
  if (version) result.set("MCP-Protocol-Version", version);
  return result;
}
async function rpc(token: string, method: string, params: Record<string, unknown> = {}, version?: string) {
  const response = await fetch(endpoint!, {
    method: "POST",
    headers: headers(token, undefined, version),
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return { response, body: await response.json() };
}
if (endpoint) {
  Deno.test("NOOR MCP staging smoke: auth, tools and tenant boundaries", async () => {
    assert(studentToken && principalToken && otherInstitutionId, "Provide dedicated staging student/principal tokens and the other institution UUID.");
    const unauth = await fetch(endpoint!, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion } }),
    });
    assert(unauth.status === 401, "Unauthenticated request must be rejected with 401.");

    const badOrigin = await fetch(endpoint!, {
      method: "POST",
      headers: headers(studentToken, "https://attacker.invalid"),
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion } }),
    });
    assert(badOrigin.status === 403, "Untrusted browser Origin must be rejected with 403.");

    const init = await rpc(studentToken, "initialize", { protocolVersion });
    assert(init.response.status === 200, "Student initialize failed: " + init.response.status);
    assert(init.body?.result?.protocolVersion === protocolVersion, "Protocol negotiation failed.");

    const tools = await rpc(studentToken, "tools/list", {}, protocolVersion);
    assert(tools.response.status === 200, "tools/list failed.");
    const toolNames = (tools.body?.result?.tools || []).map((tool: { name: string }) => tool.name);
    assert(toolNames.includes("noor_list_my_institutions"), "Institution tool missing.");
    assert(toolNames.includes("noor_get_attendance_summary"), "Attendance tool missing.");
    assert(!toolNames.some((name: string) => name.includes("create") || name.includes("update") || name.includes("delete") || name.includes("mark")), "Write tool must not be exposed in read-only release.");

    const ownInstitutions = await rpc(studentToken, "tools/call", { name: "noor_list_my_institutions", arguments: {} }, protocolVersion);
    assert(ownInstitutions.response.status === 200 && ownInstitutions.body?.result?.isError === false, "Student cannot list their own institutions.");

    const principalInstitutions = await rpc(principalToken, "tools/call", { name: "noor_list_my_institutions", arguments: {} }, protocolVersion);
    assert(principalInstitutions.response.status === 200 && principalInstitutions.body?.result?.isError === false, "Principal cannot list their own institutions.");

    const crossTenant = await rpc(studentToken, "tools/call", {
      name: "noor_get_attendance_summary",
      arguments: { institution_id: otherInstitutionId },
    }, protocolVersion);
    assert(crossTenant.response.status === 200 && crossTenant.body?.result?.isError === true, "Student must not read attendance from another institution.");
  });
}
