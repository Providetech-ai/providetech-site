// Copies supabase/functions/_shared/*.ts into every function folder that uses them
// (including files those shared files import). Run from the project folder:
//   node supabase/sync-shared.mjs
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "functions");
const sharedDir = join(root, "_shared");
const shared = new Set(readdirSync(sharedDir));
const importsOf = (src) => [...src.matchAll(/from\s+"\.\/([\w.-]+\.ts)"/g)].map((m) => m[1]).filter((f) => shared.has(f));
for (const fn of readdirSync(root)) {
  if (fn.startsWith("_") || !existsSync(join(root, fn, "index.ts"))) continue;
  const need = new Set(), queue = importsOf(readFileSync(join(root, fn, "index.ts"), "utf8"));
  while (queue.length) { const f = queue.pop(); if (need.has(f)) continue; need.add(f); queue.push(...importsOf(readFileSync(join(sharedDir, f), "utf8"))); }
  for (const f of need) {
    writeFileSync(join(root, fn, f), "// GENERATED from _shared/" + f + " — edit that file instead.\n" + readFileSync(join(sharedDir, f), "utf8"));
    console.log(fn + "/" + f);
  }
}
