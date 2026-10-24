import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const tags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
let checked = 0;
for (const [, attributes, source] of tags) {
  if (/\bsrc\s*=/.test(attributes) || !source.trim()) continue;
  new vm.Script(source, { filename: "index.html:inline-script-" + (++checked) + ".js" });
}
if (checked === 0) throw new Error("No inline JavaScript blocks were validated.");
console.log("Static syntax check passed for " + checked + " inline JavaScript block(s).");
