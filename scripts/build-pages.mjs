import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'dist');
const browserTypes = new Set(['.html', '.css', '.js', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.woff', '.woff2', '.mp3', '.wav', '.ogg']);
const files = [];
async function collect(directory = '') {
  for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && (directory || ['assets', 'sounds'].includes(entry.name))) {
      await collect(path);
    } else if (entry.isFile() && browserTypes.has(extname(entry.name)) && entry.name !== 'create-noor-zip.js') {
      files.push(path);
    }
  }
}
await collect();
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const path of files) {
  await mkdir(dirname(join(output, path)), { recursive: true });
  await cp(join(root, path), join(output, path));
}
await writeFile(join(output, '.nojekyll'), '');

// Check packaged HTML references, not the source checkout: missing release assets
// must fail the build before GitHub can publish the site.
for (const path of files.filter(path => extname(path) === '.html')) {
  const html = await readFile(join(output, path), 'utf8');
  for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
    const reference = match[1].split(/[?#]/)[0];
    if (!reference || /^(?:[a-z]+:|\/\/)/i.test(reference) || reference.includes('${')) continue;
    const target = resolve(dirname(join(output, path)), reference, reference.endsWith('/') ? 'index.html' : '');
    if (!target.startsWith(output + '/')) throw Error(`Asset escapes release: ${path}: ${reference}`);
    if (!(await stat(target).catch(() => null))?.isFile()) throw Error(`Missing release asset: ${path}: ${reference}`);
  }
}
console.log(`Packaged ${files.length} browser assets; HTML asset references verified.`);
