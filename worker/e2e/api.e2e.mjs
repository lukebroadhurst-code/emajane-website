/* The content API checks (test.mjs), run against the same Worker as the browser tests.
   They leave test data behind, so this suite always runs last. */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REAL, group } from './lib.mjs';

const WORKER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function run(ctx) {
  group('The content API');
  const r = spawnSync('node', ['test.mjs'], { cwd: WORKER, env: { ...process.env, BASE: REAL }, encoding: 'utf8' });
  const lines = (r.stdout || '').split('\n');
  for (const l of lines) {
    if (l.startsWith('  ok  ')) { ctx.results.push({ label: 'api: ' + l.slice(6), ok: true }); }
    else if (l.startsWith('FAIL  ')) { ctx.results.push({ label: 'api: ' + l.slice(6), ok: false }); console.log(l); }
  }
  const ok = lines.filter((l) => l.startsWith('  ok  ')).length;
  console.log(`  ${ok} checks held`);
  if (r.status !== 0 && !lines.some((l) => l.startsWith('FAIL  '))) { ctx.results.push({ label: 'api: the checks did not finish', ok: false }); console.log('FAIL  the API checks did not finish\n' + (r.stderr || '').slice(0, 600)); }
}
