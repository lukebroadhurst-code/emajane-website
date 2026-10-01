/* Runs the browser tests.   npm run e2e            (everything)
                             npm run e2e -- practice (only the suites whose name contains "practice")  */
import { setup } from './lib.mjs';

const suites = { practice: './practice.e2e.mjs', real: './real.e2e.mjs', ease: './ease.e2e.mjs', api: './api.e2e.mjs' };   // api is last: it leaves test data behind
const wanted = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const names = Object.keys(suites).filter((n) => !wanted.length || wanted.some((w) => n.includes(w)));

const ctx = await setup();
let crashed = false;
try {
  for (const n of names) {
    let mod;
    try { mod = await import(suites[n]); } catch (e) { if (e.code === 'ERR_MODULE_NOT_FOUND' && String(e.message).includes(suites[n].slice(2))) { console.log(`\n(skipping ${n}: not written yet)`); continue; } throw e; }
    await mod.run(ctx);
  }
} catch (e) { crashed = true; console.error('\nThe test run crashed:', e); }
await ctx.close();
const failed = ctx.results.filter((r) => !r.ok);
console.log(`\n${ctx.results.length - failed.length} passed, ${failed.length} failed${crashed ? ', and the run crashed' : ''}`);
process.exit(failed.length || crashed ? 1 : 0);
