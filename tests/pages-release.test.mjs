import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('Pages package preserves browser assets, removes stale output and excludes backend/source archives', async () => {
  const root = await mkdtemp(join(tmpdir(), 'noor-pages-'));
  try {
    for (const directory of ['scripts', 'supabase', 'assets', 'sounds', 'dist', 'docs']) await mkdir(join(root, directory));
    await cp(new URL('../scripts/build-pages.mjs', import.meta.url), join(root, 'scripts/build-pages.mjs'));
    const sources = {
      'index.html': '<link href="./style.css?v=1"><script src="app.js"></script><img src="assets/photo.png"><a href="./">Home</a>',
      'style.css': 'body{}', 'app.js': 'void 0;', 'assets/photo.png': 'image', 'sounds/player.js': 'void 0;',
      '.env': 'private', 'supabase/function.js': 'server', 'docs/internal.html': 'internal',
      'backup.zip': 'archive', 'create-noor-zip.js': 'build tool', 'dist/stale.js': 'old release',
    };
    for (const [path, content] of Object.entries(sources)) await writeFile(join(root, path), content);
    const run = () => spawnSync(process.execPath, [join(root, 'scripts/build-pages.mjs')], { encoding: 'utf8' });
    const built = run();
    assert.equal(built.status, 0, built.stderr);
    for (const path of ['index.html', 'style.css', 'app.js', 'assets/photo.png', 'sounds/player.js']) {
      assert.equal(await readFile(join(root, 'dist', path), 'utf8'), sources[path]);
    }
    for (const path of ['.env', 'supabase/function.js', 'docs/internal.html', 'backup.zip', 'create-noor-zip.js', 'stale.js']) {
      await assert.rejects(readFile(join(root, 'dist', path)), { code: 'ENOENT' });
    }
    await writeFile(join(root, 'index.html'), '<script src="missing.js"></script>');
    const missing = run();
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /Missing release asset/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
