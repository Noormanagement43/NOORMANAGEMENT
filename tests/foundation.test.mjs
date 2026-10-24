import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("document declares language and responsive viewport", () => {
  assert.match(html, /<html\\s+lang=["']en["']/i);
  assert.match(html, /<meta\\s+name=["']viewport["'][^>]*content=["'][^"']*width=device-width/i);
});

test("inline JavaScript parses without executing browser code", () => {
  const tags = [...html.matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script>/gi)];
  const inlineScripts = tags.filter(([, attrs, source]) => !/\\bsrc\\s*=/.test(attrs) && source.trim());
  assert.ok(inlineScripts.length > 0, "expected at least one inline script");
  inlineScripts.forEach(([, , source], index) => {
    assert.doesNotThrow(() => new vm.Script(source), `inline script ${index + 1}`);
  });
});

test("keyboard focus and reduced-motion accommodations are present", () => {
  assert.match(html, /:focus-visible/);
  assert.match(html, /prefers-reduced-motion\\s*:\\s*reduce/);
});

test("membership lookup is scoped to the signed-in user and active membership", () => {
  assert.match(html, /from\\(['"]institution_memberships['"]\\)[\\s\\S]{0,500}eq\\(['"]user_id['"],\\s*currentUser\\.id\\)[\\s\\S]{0,200}eq\\(['"]status['"],\\s*['"]active['"]\\)/);
});

test("academic group reads and writes include institution scope in the frontend query", () => {
  assert.match(html, /from\\(['"]academic_groups['"]\\)\\.select\\([\\s\\S]{0,300}eq\\(['"]institution_id['"],\\s*membership\\.institution_id\\)/);
  assert.match(html, /from\\(['"]academic_groups['"]\\)\\.delete\\(\\)\\.eq\\(['"]id['"],\\s*c\\.id\\)\\.eq\\(['"]institution_id['"],\\s*membership\\.institution_id\\)/);
});

test("browser bundle does not contain a Supabase service-role key", () => {
  assert.doesNotMatch(html, /SUPABASE_SERVICE_ROLE_KEY|service_role\s*[:=]/i);
});
