import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const workflows = readFileSync(new URL('../academic-workflows.js', import.meta.url), 'utf8');

test('all inline JavaScript and academic workflow module parse', () => {
  const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .filter(source => source.trim());
  assert.ok(inlineScripts.length >= 2, 'expected inline application scripts');
  for (const source of inlineScripts) new vm.Script(source);
  new vm.Script(workflows);
});

test('workflow module is loaded by the static app and receives the authenticated context', () => {
  assert.match(html, /<script src="\.\/academic-workflows\.js"><\/script>/);
  assert.match(html, /window\.noorApp=\{client:client/);
  assert.match(html, /getMembership:function\(\)\{return membership\}/);
});

test('academic data operations are institution-scoped and use only existing tables', () => {
  assert.match(workflows, /from\('class_sessions'\).*eq\('institution_id',m\.institution_id\)/s);
  assert.match(workflows, /from\('academic_groups'\).*eq\('institution_id',m\.institution_id\)/s);
  assert.match(workflows, /from\('attendance_records'\).*eq\('institution_id',m\.institution_id\)/s);
  assert.match(workflows, /from\('academic_years'\).*eq\('institution_id',m\.institution_id\)/s);
});

test('attendance status options match the database constraint', () => {
  for (const status of ['present', 'absent', 'late', 'leave']) {
    assert.ok(workflows.includes('value="' + status + '"'), 'missing status ' + status);
  }
  assert.ok(!workflows.includes('value="excused"'));
});

test('frontend does not embed a service-role secret or seed demo student data', () => {
  const source = html + '\n' + workflows;
  assert.doesNotMatch(source, /service[_-]?role[_-]?(key|secret)\s*[:=]/i);
  assert.doesNotMatch(source, /demo student|fake student|seed student/i);
});
