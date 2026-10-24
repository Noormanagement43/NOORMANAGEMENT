import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';

const page = await readFile(new URL('../platform-creator.html', import.meta.url), 'utf8');
const styles = await readFile(new URL('../platform-creator.css', import.meta.url), 'utf8');
const script = await readFile(new URL('../platform-creator.js', import.meta.url), 'utf8');
const config = await readFile(new URL('../config.js', import.meta.url), 'utf8');

test('Platform Creator page loads the shared public config and responsive console assets', () => {
  assert.match(page, /platform-creator\.css/);
  assert.match(page, /\.\/config\.js/);
  assert.match(page, /@supabase\/supabase-js@2/);
  assert.match(page, /platform-creator\.js/);
  assert.match(page, /id="authGate"/);
  assert.match(page, /id="institutionRows"/);
  assert.match(styles, /@media\(max-width:640px\)/);
  assert.match(styles, /prefers-reduced-motion/);
});

test('Creator authorization is checked against the caller platform_roles row', () => {
  assert.match(script, /from\('platform_roles'\)/);
  assert.match(script, /\.eq\('user_id', currentUser\.id\)/);
  assert.match(script, /platform_owner/);
  assert.match(script, /platform_admin/);
  assert.match(script, /data\.role === 'support'/);
  assert.doesNotMatch(script, /from\('platform_roles'\)\.insert/);
  assert.doesNotMatch(script, /from\('platform_roles'\)\.upsert/);
  assert.doesNotMatch(script, /user_metadata|raw_user_meta_data/);
});

test('Institution metrics and list are live database queries, not seeded numbers', () => {
  assert.match(script, /countInstitutions\(\)/);
  assert.match(script, /select\('id', \{ count: 'exact', head: true \}\)/);
  assert.match(script, /from\('institutions'\)/);
  assert.match(script, /range\(currentPage \* PAGE_SIZE, currentPage \* PAGE_SIZE \+ PAGE_SIZE - 1\)/);
  assert.match(script, /No institutions matched these filters/);
  assert.match(script, /no fallback or sample data was loaded/i);
  assert.doesNotMatch(script, /metricTotal'\)\.textContent\s*=\s*['"](?:100|250|500|999)/);
});

test('Sensitive status changes are explicitly confirmed and use optimistic concurrency', () => {
  assert.match(script, /window\.confirm\(/);
  assert.match(script, /immutable platform audit log/);
  assert.match(script, /\.eq\('updated_at', version\)/);
  assert.match(script, /\.update\(\{/);
  assert.doesNotMatch(script, /\.from\('institutions'\)\.delete\(/);
  assert.doesNotMatch(script, /service_role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(config, /service_role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY/);
});

test('Platform Creator JavaScript parses with no syntax errors', () => {
  assert.doesNotThrow(() => new Script(script, { filename: 'platform-creator.js' }));
});

test('Page explicitly surfaces unsupported metrics and onboarding limitations', () => {
  assert.match(page, /Membership summary/);
  assert.match(page, /immutable platform audit log/i);
  assert.match(page, /atomic onboarding workflow/i);
  assert.match(page, /subscription metrics are intentionally not fabricated/i);
});
