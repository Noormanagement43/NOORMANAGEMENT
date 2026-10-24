import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("document declares language and responsive viewport", () => {
  assert.match(html, /<html\s+lang=["']en["']/i);
  assert.match(html, /<meta\s+name=["']viewport["'][^>]*content=["'][^"']*width=device-width/i);
});

test("inline JavaScript parses without executing browser code", () => {
  const tags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  const inlineScripts = tags.filter(([, attrs, source]) => !/\bsrc\s*=/.test(attrs) && source.trim());
  assert.ok(inlineScripts.length > 0, "expected at least one inline script");
  inlineScripts.forEach(([, , source], index) => {
    assert.doesNotThrow(() => new vm.Script(source), "inline script " + (index + 1));
  });
});

test("keyboard focus and reduced-motion accommodations are present", () => {
  assert.match(html, /:focus-visible/);
  assert.match(html, /prefers-reduced-motion\s*:\s*reduce/);
});

test("membership lookup is scoped to the signed-in user and active membership", () => {
  assert.match(html, /from\(['"]institution_memberships['"]\)[\s\S]{0,500}eq\(['"]user_id['"],\s*currentUser\.id\)[\s\S]{0,200}eq\(['"]status['"],\s*['"]active['"]\)/);
});

test("academic group reads and writes include institution scope in the frontend query", () => {
  assert.match(html, /from\(['"]academic_groups['"]\)\.select\([\s\S]{0,300}eq\(['"]institution_id['"],\s*membership\.institution_id\)/);
  assert.match(html, /from\(['"]academic_groups['"]\)\.delete\(\)\.eq\(['"]id['"],\s*c\.id\)\.eq\(['"]institution_id['"],\s*membership\.institution_id\)/);
});

test("browser bundle does not contain a Supabase service-role key", () => {
  assert.doesNotMatch(html, /SUPABASE_SERVICE_ROLE_KEY|service_role\s*[:=]/i);
});


test("principal overview includes academic setup health indicators", () => {
  assert.match(html, /id=["']health-title["']/);
  assert.match(html, /id=["']health-groups["']/);
  assert.match(html, /id=["']health-rooms["']/);
  assert.match(html, /id=["']health-descriptions["']/);
});

test("setup health values are derived from institution-scoped live groups", () => {
  assert.match(html, /function renderInstitutionHealth\(\)[\s\S]{0,800}liveGroups\.length/);
  assert.match(html, /liveGroups\.filter\(function\(group\)\{return group\.room/);
  assert.match(html, /liveGroups\.filter\(function\(group\)\{return !!\(group\.subject/);
  assert.match(html, /No active academic groups are available yet/);
});


test("teacher accounts receive a safe workspace without administrator data loading", () => {
  assert.match(html, /const teacherRoles=\[['"]teacher['"],['"]faculty['"]\]/);
  assert.match(html, /if\(teacherRoles\.indexOf\(role\)>=0\)\{showTeacherWorkspace\(\);return;\}\s*await refreshData\(\)/);
  const teacherWorkspace = html.match(/function showTeacherWorkspace\(\)\{([\s\S]*?)\n \}/);
  assert.ok(teacherWorkspace, "expected teacher workspace renderer");
  assert.doesNotMatch(teacherWorkspace[1], /from\(['"]academic_groups['"]\)|functions\.invoke/);
  assert.match(teacherWorkspace[1], /Assigned classes are not connected for teacher accounts yet/);
});

test("ambiguous multiple active institution memberships pause access", () => {
  assert.match(html, /if\(activeMemberships\.length>1\) throw new Error\('Your account belongs to more than one institution/);
});


test("student accounts receive a safe learning-space state without administrator data loading", () => {
  assert.match(html, /const studentRoles=\[['"]student['"],['"]university_student['"]\]/);
  assert.match(html, /if\(studentRoles\.indexOf\(role\)>=0\)\{showStudentWorkspace\(\);return;\}/);
  const studentWorkspace = html.match(/function showStudentWorkspace\(\)\{([\s\S]*?)\n \}/);
  assert.ok(studentWorkspace, "expected student workspace renderer");
  assert.doesNotMatch(studentWorkspace[1], /from\(['"]academic_groups['"]\)|functions\.invoke/);
  assert.match(studentWorkspace[1], /Your enrolled classes are not connected for student accounts yet/);
  assert.match(studentWorkspace[1], /health\.style\.display='none'/);
});
