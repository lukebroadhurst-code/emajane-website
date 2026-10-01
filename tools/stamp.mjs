/* Gives every file of a release its own web address, so a browser can never mix new and old files.

   GitHub Pages lets browsers keep a file for ten minutes. Right after a release, a visitor who loaded the admin a
   few minutes ago could be given the new app.js but keep the old ui.js, and the admin breaks until the old copy expires.

   In the source, every file the pages load ends in ?v=dev. This script swaps "dev" for the release id in a copy of the
   site, before it is published. The pages workflow runs it. Nothing in the repository is changed.

   Usage:  node tools/stamp.mjs <release id> [folder]        (the folder defaults to ./site)                            */
import fs from 'node:fs';
import path from 'node:path';

const id = process.argv[2];
const root = path.resolve(process.argv[3] || 'site');
if (!/^[A-Za-z0-9]{4,40}$/.test(id || '')) { console.error('Give a release id of letters and numbers, for example the first 8 characters of the commit.'); process.exit(1); }
if (!fs.existsSync(root)) { console.error('No such folder: ' + root); process.exit(1); }

let files = 0, changes = 0;
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    const stat = fs.statSync(file);
    if (stat.isDirectory()) { if (name !== 'node_modules') walk(file); continue; }
    if (!/\.(html|js|css)$/.test(name)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const n = text.split('?v=dev').length - 1;
    if (!n) continue;
    fs.writeFileSync(file, text.replaceAll('?v=dev', '?v=' + id));
    files++; changes += n;
  }
}
walk(root);
console.log(`Stamped ${changes} references in ${files} files with ${id}.`);
