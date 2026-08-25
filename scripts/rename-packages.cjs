const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();
const FILES = [
  'package.json',
  'packages/api/package.json',
  'packages/api-client/package.json',
  'packages/auth/package.json',
  'packages/react-hooks/package.json',
  'packages/social-store/package.json',
  'packages/shared-i18n/package.json',
  'packages/utils/package.json',
  'apps/admin-dashboard/package.json',
  'apps/web-app/package.json',
  'apps/mobile-app/package.json',
];
function rename(str) {
  if (!str) return str;
  return String(str)
    .replace(/@vellbase\//g, '@vellbase/')
    .replace(/vellbase-monorepo/g, 'vellbase-monorepo')
    .replace(/Vellbase/g, 'Vellbase')
    .replace(/vellbase/g, 'vellbase');
}
for (const rel of FILES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { console.log('SKIP (missing)', rel); continue; }
  const p = JSON.parse(fs.readFileSync(abs, 'utf8'));
  if (typeof p.name === 'string') p.name = rename(p.name);
  if (typeof p.description === 'string') p.description = rename(p.description);
  for (const dep of ['dependencies','devDependencies','optionalDependencies','peerDependencies']) {
    if (!p[dep] || typeof p[dep] !== 'object') continue;
    const next = {};
    for (const k of Object.keys(p[dep])) {
      next[rename(k)] = p[dep][k];
    }
    p[dep] = next;
  }
  fs.writeFileSync(abs, JSON.stringify(p, null, 2) + '\n');
  console.log('OK', rel, '=>', p.name);
}
