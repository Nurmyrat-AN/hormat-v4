import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const production = process.argv.includes('--production');
const target = path.join(root, production ? 'dist' : 'src');
if (production) {
  await cp(path.join(root, 'src/views'), path.join(target, 'views'), { recursive: true });
  await cp(path.join(root, 'src/public'), path.join(target, 'public'), { recursive: true });
  await cp(path.join(root, 'src/database/migrations'), path.join(target, 'database/migrations'), { recursive: true });
}
const vendor = path.join(target, 'public/vendor');
await rm(vendor, { recursive: true, force: true });
await mkdir(vendor, { recursive: true });
for (const [source, destination] of [
  ['bootstrap/dist/css/bootstrap.min.css', 'bootstrap.min.css'],
  ['bootstrap/dist/css/bootstrap.min.css.map', 'bootstrap.min.css.map'],
  ['bootstrap/dist/js/bootstrap.bundle.min.js', 'bootstrap.bundle.min.js'],
  ['bootstrap/dist/js/bootstrap.bundle.min.js.map', 'bootstrap.bundle.min.js.map'],
  ['jquery/dist/jquery.min.js', 'jquery.min.js'],
]) {
  await cp(path.join(root, 'node_modules', source), path.join(vendor, destination));
}
