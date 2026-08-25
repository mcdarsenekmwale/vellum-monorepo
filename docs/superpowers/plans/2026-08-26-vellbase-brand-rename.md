# Vellum → Vellbase Brand Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename every user-facing / code-level / package-level reference of `Vellum/vellum` → `Vellbase/vellbase` across the whole monorepo (admin-dashboard, web-app, mobile-app, packages, scripts, tests, CI, deploy configs, docs) while preserving the safety-net exclusions so no build or runtime break happens in CI, deployed Prisma Compute, GitHub secrets, DB schemas, native mobile bundle IDs, or test fixtures.

**Architecture:** Atomic 4-phase rename. Phase 1 updates npm package identity (`name` + `description` + `dependencies` + imports) so workspace resolution is consistent atomically. Phase 2 rewrites display brand strings, page titles, copy, script filenames and references, GitHub URLs, workflow descriptions. Phase 3 clean-reinstalls workspace so symlinks re-key correctly on the new names. Phase 4 smoke-tests the 4 primary builds/typechecks. Excluded-from-rename list is enumerated in each task's explicit skip-globs so each replace is bounded and safe.

**Tech Stack:** Node.js 20+, npm workspaces, NestJS/TypeScript (api), Vite/React 19 (admin, web), Expo SDK 54 (mobile), GitHub Actions (CI), Prisma ORM, Python (QA scripts).

---

## File structure & rename map

### Workspace package.json names (root + 10 packages)
These files' `name` field must change, then ALL consumers that import or depend on them must update in the same commit:
1. `/package.json` → `vellum-monorepo` → `vellbase-monorepo`
2. `/packages/api/package.json` → `@vellum/api` → `@vellbase/api`
3. `/packages/api-client/package.json` → `@vellum/api-client` → `@vellbase/api-client`
4. `/packages/auth/package.json` → `@vellum/auth` → `@vellbase/auth`
5. `/packages/react-hooks/package.json` → `@vellum/react-hooks` → `@vellbase/react-hooks`
6. `/packages/social-store/package.json` → `@vellum/social-store` → `@vellbase/social-store`
7. `/packages/shared-i18n/package.json` → `@vellum/shared-i18n` → `@vellbase/shared-i18n`
8. `/packages/utils/package.json` → `@vellum/utils` → `@vellbase/utils`
9. `/apps/admin-dashboard/package.json` → `@vellum/admin-dashboard` → `@vellbase/admin-dashboard`
10. `/apps/web-app/package.json` → `@vellum/web-app` → `@vellbase/web-app`
11. `/apps/mobile-app/package.json` → `@vellum/mobile-app` → `@vellbase/mobile-app`

### Source files with TS/JS imports to rewrite (same pattern)
Any `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs` that contains `from "@vellum/` → `from "@vellbase/`
Excluded globs:
- `**/node_modules/**`
- `**/dist/**`
- `**/.next/**`
- `**/.turbo/**`
- `**/.output/**`
- `**/coverage/**`
- `**/packages/api/dist/swagger-ui/**`
- `**/test-output/**` (JSON QA reports — exclude in ALL tasks, below)

### Display brand strings (app copy, page titles, HTML <title>)
- `apps/admin-dashboard/**/*.{ts,tsx,html,css,json,md}` — `Vellum` → `Vellbase`, `vellum` → `vellbase`, but **do not touch IDs / UUIDs / signed tokens** (all clearly not brand text).
- `apps/web-app/**/*.{ts,tsx,html,css,json,md}` — same pattern.
- `apps/mobile-app/**/*.{ts,tsx,tsx,json,md,plist,storyboard,swift,m,h}` — same pattern, **EXCEPT keep native `ios.bundleIdentifier` / `android.package` values unchanged** (already registered with stores).

### Script & workflow references + script file rename
- Rename `/packages/api/scripts/deploy-vellbase.mjs` → `/packages/api/scripts/deploy-vellbase.mjs`
- Then find all references to `deploy-vellbase.mjs` (shell scripts, YAML, docstrings) → `deploy-vellbase.mjs`
- All GitHub Actions `.yml` / workflow description strings, CODEOWNERS targets, shell script banners

### GitHub URLs in code / workflows
- `https://github.com/mcdarsenekmwale/vellum-monorepo` → `https://github.com/mcdarsenekmwale/vellbase-monorepo`
- `https://github.com/mcdarsenekmwale/vellum-api` → `https://github.com/mcdarsenekmwale/vellbase-api`

### Excluded-from-rename (every task MUST honor these)
1. Environment variable **NAMES** — strings that are env keys: `DATABASE_URL`, `JWT_SECRET`, `PRISMA_TOKEN`, `REDIS_URL`, GitHub Actions secret names. Only their VALUES may be replaced if the value itself contains `vellum` / `Vellum` as brand text.
2. Database / Prisma schema identifiers — `schema.prisma`, `_deprecated_migrations/**/*.sql`, `prisma/migrations/**/*.sql` are skipped (no column / table / schema renames).
3. Files under `apps/mobile-app/tests/test-output/**/*.json` + any checksum / screenshot bytes.
4. UUIDs / JWT payloads / cookie names / API keys — anything signed or looked up by value that isn't brand copy.
5. External 3rd-party URLs — only YOUR own domain / repo URLs get renamed.
6. Published git history / force push — one big rename commit, no amend.

---

## Task 1: npm / workspace package identity (atomic)

**Files:**
- Modify: `/package.json` (`name`, `description`, `scripts` internal banner strings)
- Modify: `/packages/api/package.json` (`name`, `description`, dependencies `@vellum/*` → `@vellbase/*`)
- Modify: `/packages/api-client/package.json` (same)
- Modify: `/packages/auth/package.json` (same)
- Modify: `/packages/react-hooks/package.json` (same)
- Modify: `/packages/social-store/package.json` (same)
- Modify: `/packages/shared-i18n/package.json` (same)
- Modify: `/packages/utils/package.json` (same)
- Modify: `/apps/admin-dashboard/package.json` (same, `@vellum/admin-dashboard` → `@vellbase/admin-dashboard`)
- Modify: `/apps/web-app/package.json` (same, all `@vellum/*` deps → `@vellbase/*`)
- Modify: `/apps/mobile-app/package.json` (same, all `@vellum/*` deps → `@vellbase/*`)

- [ ] **Step 1: Rewrite each package.json `name` field exactly per table above**

For each file run the two regexes below. Don't rely on global sed — each package.json has a context (deps block). Use the two helpers:

```bash
# 1a. name/description block — for ALL 11 package.jsons:
#   "name": "@vellum/xxx"     -> "@vellbase/xxx"
#   "name": "vellum-monorepo" -> "vellbase-monorepo"
#   description strings containing Vellum or vellum -> Vellbase or vellbase
sed -i '' -E 's/"name": "@vellum\//"name": "@vellbase\//g' FILE
sed -i '' -E 's/"name": "vellum-monorepo"/"name": "vellbase-monorepo"/g' /Users/mcdarsenemwale/projects/dev/ai_article_worskspace/package.json
# Then description field line-only replace for each file:
sed -i '' -E 's/Vellum/Vellbase/g; s/vellum/vellbase/g' FILE   # only for "description":"..." lines, not whole file!
```

BETTER: use `node -e` JSON-in-place so we don't corrupt non-name fields. Run this once — it updates `name`, `description`, and walks `dependencies` / `devDependencies` / `optionalDependencies` / `peerDependencies`:

```javascript
// Place at root and run: node scripts/rename-packages.cjs
const fs = require('fs');
const path = require('path');
const ROOT = '/Users/mcdarsenemwale/projects/dev/ai_article_worskspace';
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
  return str.replace(/@vellum\//g, '@vellbase/')
    .replace(/vellum-monorepo/g, 'vellbase-monorepo')
    .replace(/Vellum/g, 'Vellbase')
    .replace(/vellum/g, 'vellbase');
}
for (const rel of FILES) {
  const abs = path.join(ROOT, rel);
  const p = JSON.parse(fs.readFileSync(abs, 'utf8'));
  if (p.name) p.name = rename(p.name);
  if (p.description) p.description = rename(p.description);
  for (const dep of ['dependencies','devDependencies','optionalDependencies','peerDependencies']) {
    if (!p[dep]) continue;
    const next = {};
    for (const k of Object.keys(p[dep])) {
      next[rename(k)] = p[dep][k];
    }
    p[dep] = next;
  }
  fs.writeFileSync(abs, JSON.stringify(p, null, 2) + '\n');
  console.log('OK', rel, '=>', p.name);
}
```

Run: `cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace && node scripts/rename-packages.cjs`
Expected: 11 lines printed `OK <path> => <new name>`

- [ ] **Step 2: Verify all `@vellum/` references are gone from the 11 package.jsons**

Run:
```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace && \
grep -E "@vellum/|vellum-monorepo" package.json packages/*/package.json apps/*/package.json || echo "OK - clean"
```
Expected: print `OK - clean` (no matches).

- [ ] **Step 3: Rewrite all TS/JS import statements so `@vellum/<x>` → `@vellbase/<x>` everywhere (except excludes)**

Run:
```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace && \
node -e "
const fs=require('fs'), path=require('path');
const EXCLUDE = new Set(['node_modules','dist','.next','.turbo','.output','coverage','swagger-ui','test-output','_deprecated_migrations']);
const EXTS = new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs']);
let count=0, files=0;
function walk(d){ try { for (const e of fs.readdirSync(d,{withFileTypes:true})) { if (EXCLUDE.has(e.name)) continue; const p=path.join(d,e.name); if (e.isDirectory()) walk(p); else if (e.isFile() && EXTS.has(path.extname(e.name))) { let s=fs.readFileSync(p,'utf8'); const s2=s.replace(/@vellum\\//g,'@vellbase/'); if (s!==s2) { fs.writeFileSync(p,s2); files++; count += (s.match(/@vellum\\//g)||[]).length; } } } } catch(e){} }
walk(process.cwd());
console.log('Rewrote',count,'occurrences in',files,'files');
"
```
Expected: rewrites ~dozens of imports.

- [ ] **Step 4: Verify no stray `@vellum/` imports remain in source code**
Run:
```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace && \
(grep -rn --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs' --include='*.cjs' \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next --exclude-dir=.turbo --exclude-dir=.output --exclude-dir=coverage \
  --exclude-dir=swagger-ui --exclude-dir=test-output --exclude-dir=_deprecated_migrations \
  '@vellum/' . || echo "OK - clean")
```
Expected: `OK - clean`

- [ ] **Step 5: Stage + commit (package identity + import paths rename only)**
```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace && git add -A && \
git diff --cached --stat | tail -5 && \
git commit -m "chore!: rename npm packages @vellum/* -> @vellbase/* + vellum-monorepo -> vellbase-monorepo

Strategy 2 Phase 1: Atomic package identity + import-path rename so npm
workspace symlinks + module resolution stays consistent across all 11
package.json names + all source imports updated together. No display
brand strings rewritten yet (comes in Phase 2)."
```

---

## Task 2: Display brand strings — admin dashboard + web app + mobile app (copy, titles, HTML)

**Files:**
- Modify: Everything under `apps/admin-dashboard/`, `apps/web-app/`, `apps/mobile-app/` with Vellum/vellum occurrences (154 + 77 + 116 occurrences)
- Modify (explicitly): `/apps/admin-dashboard/index.html`, `/apps/web-app/index.html`, `/apps/mobile-app/app.json`
- Skip (no exceptions):
  - All node_modules/dist/.next/.turbo/.output/coverage dirs
  - All `apps/mobile-app/tests/test-output/**` (JSON reports, checksums, screenshots)
  - `ios.bundleIdentifier` and `android.package` inside `app.json` (store-registered identifiers)

- [ ] **Step 1: Dry-run inventory**

Before replacing, produce a list so we can sanity check:
```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace && \
node -e "
const fs=require('fs'),path=require('path');
const ROOTS=['apps/admin-dashboard','apps/web-app','apps/mobile-app'];
const EXCLUDE=new Set(['node_modules','dist','.next','.turbo','.output','coverage','test-output']);
const SAFE_EXTS=new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs','.html','.css','.json','.md','.plist','.storyboard','.swift','.m','.h']);
let hits=0;
for (const R of ROOTS) {
  function walk(d){ for (const e of fs.readdirSync(d,{withFileTypes:true})) { if (EXCLUDE.has(e.name)) continue; const p=path.join(d,e.name); if (e.isDirectory()) walk(p); else if (SAFE_EXTS.has(path.extname(e.name)) || e.name==='app.json' || e.name==='Info.plist') { const s=fs.readFileSync(p,'utf8'); if (/vellum|Vellum|VELLUM/.test(s)) { const lines=s.split(/\\n/); lines.forEach((l,i)=>{ if (/vellum|Vellum|VELLUM/.test(l)) { console.log(p+':'+(i+1)+': '+l.slice(0,200)); hits++; } }); } } } }
  walk(path.join(process.cwd(),R));
}
console.log('\\nTotal lines:', hits);
" > /tmp/brand-rename-inventory.txt 2>&1
wc -l /tmp/brand-rename-inventory.txt
```
Expected: matches approx 154+77+116 = 347 lines. Skim it for no UUID/JWT strings before proceeding.

- [ ] **Step 2: Do the 3-case replace + protective skips (Vellum→Vellbase; vellum→vellbase; VELLUM→VELLBASE), but NEVER touch `ios.bundleIdentifier` / `android.package` in app.json**

Use a two-pass approach: generic replace for all apps' files, then post-restore for excluded fields.

```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace
node -e "
const fs=require('fs'),path=require('path');
const ROOTS=['apps/admin-dashboard','apps/web-app','apps/mobile-app'];
const EXCLUDE=new Set(['node_modules','dist','.next','.turbo','.output','coverage','test-output']);
const SAFE_EXTS=new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs','.html','.css','.json','.md','.plist','.storyboard','.swift','.m','.h']);
let files=0, changes=0;
function ren(s){ return s.replace(/Vellum/g,'Vellbase').replace(/vellum/g,'vellbase').replace(/VELLUM/g,'VELLBASE'); }
for (const R of ROOTS) {
  function walk(d){ for (const e of fs.readdirSync(d,{withFileTypes:true})) { if (EXCLUDE.has(e.name)) continue; const p=path.join(d,e.name); if (e.isDirectory()) walk(p); else if (SAFE_EXTS.has(path.extname(e.name)) || e.name==='app.json' || e.name==='Info.plist') { const s=fs.readFileSync(p,'utf8'); const s2=ren(s); if (s!==s2) { const m=s.match(/vellum|Vellum|VELLUM/g)||[]; changes+=m.length; files++; fs.writeFileSync(p,s2); } } } }
  walk(path.join(process.cwd(),R));
}
// === Post-restore: protect ios.bundleIdentifier and android.package in app.json ===
const p=path.join(process.cwd(),'apps','mobile-app','app.json');
if (fs.existsSync(p)) {
  const original=fs.readFileSync(p,'utf8');
  const appJSON=JSON.parse(original);
  // restore old values by re-applying vellbase->vellum only inside bundleId + package
  const restore = (v) => (typeof v === 'string') ? v.replace(/vellbase/g,'vellum').replace(/Vellbase/g,'Vellum') : v;
  if (appJSON.ios?.bundleIdentifier) { appJSON.ios.bundleIdentifier = restore(appJSON.ios.bundleIdentifier); }
  if (appJSON.android?.package) { appJSON.android.package = restore(appJSON.android.package); }
  fs.writeFileSync(p, JSON.stringify(appJSON,null,2)+'\n');
}
console.log('Changed', changes, 'occurrences in', files, 'files');
"
```
Expected: ~300+ changes.

- [ ] **Step 3: Sanity-check — protected fields still retain old bundle IDs**
```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/mobile-app && \
node -e "const j=require('./app.json'); console.log('bundleIdentifier:', j.ios?.bundleIdentifier); console.log('android.package:', j.android?.package);"
```
Expected: strings unchanged from before. If output contains `vellbase` here, stop and restore; Task 2 failed.

- [ ] **Step 4: Sanity-check — HTML titles + brand display strings now correctly say Vellbase**

Spot-check 3 important touch points:
```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace && \
echo "Admin index.html <title>:" && grep -n '<title>' apps/admin-dashboard/index.html && \
echo "Web index.html <title>:" && grep -n '<title>' apps/web-app/index.html && \
echo "Mobile app.json name/slug:" && node -e "const j=require('./apps/mobile-app/app.json'); console.log('name:', j.name, 'slug:', j.slug);"
```
Expected: all three outputs say "Vellbase / vellbase".

- [ ] **Step 5: Stage + commit (brand strings rename for apps only)**
```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace && \
git add apps/admin-dashboard apps/web-app apps/mobile-app && \
git commit -m "chore: rename visible app brand Vellum -> Vellbase (admin, web, mobile)

Strategy 2 Phase 2 display brand rename. Protected fields:
ios.bundleIdentifier + android.package remain unchanged. QA JSON test
reports under tests/test-output/ excluded (byte checksums critical)."
```

---

## Task 3: Packages + scripts + CI/deploy + docs brand rename, and script file rename (deploy-vellbase.mjs → deploy-vellbase.mjs)

**Files:**
- Rename: `/packages/api/scripts/deploy-vellbase.mjs` → `/packages/api/scripts/deploy-vellbase.mjs`
- Modify: every script / doc / workflow under `packages/api/scripts/**`, `.github/**`, `scripts/**`, `tests/**`, `README.md`, `CODE_WIKI.md`, `TESTING_REPORT.md`, `packages/api/*.yml`, `packages/api/*.json`, `prisma.compute.json`, `packages/api/.github/**`, etc. (379-347 ≈ 32 remaining occurrences)
- Skip:
  - DB schema / Prisma migrations (`**/prisma/migrations/**/*.sql`, `**/_deprecated_migrations/**`)
  - `prisma/schema.prisma` datasource provider name or schema names — no change
  - env var **names** (replace env var values only if they contain `vellum` or `Vellum` as a brand/domain)
  - Test output / screenshots / checksums under `**/test-output/`
  - Any 3rd-party URLs — only YOUR repos (github.com/mcdarsenekmwale/...) + Your custom domain URLs get replaced.

- [ ] **Step 1: Rename the deploy script file + update internal banner strings (it references 'vellum' inside)**
```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace && \
git mv packages/api/scripts/deploy-vellbase.mjs packages/api/scripts/deploy-vellbase.mjs
```

- [ ] **Step 2: Replace `vellum|Vellum|VELLUM` in remaining packages + CI/tests/scripts/docs/prisma config + workflows**
Use the same replacement helper with explicit include/exclude.

```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace
node -e "
const fs=require('fs'),path=require('path');
const ROOTS=['packages','.github','scripts','tests','.','packages/api/.github'];
const EXCLUDE=new Set([
  'node_modules','dist','.next','.turbo','.output','coverage','test-output',
  'swagger-ui','_deprecated_migrations','migrations','prisma'  // 'prisma' skips prisma/schema.prisma & migrations (we don't rename schema)
]);
const SAFE_EXTS=new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.md','.yml','.yaml','.py','.ini','.plist','.env.example','.dockerfile','Dockerfile','docker-compose.yml','.compute.json','.toml','.envrc']);
let files=0, changes=0;
function ren(s){ return s.replace(/Vellum/g,'Vellbase').replace(/vellum/g,'vellbase').replace(/VELLUM/g,'VELLBASE'); }
for (const R of ROOTS) {
  const absR = R === '.' ? process.cwd() : path.join(process.cwd(), R);
  if (!fs.existsSync(absR)) continue;
  function walk(d){ for (const e of fs.readdirSync(d,{withFileTypes:true})) {
    // extra safety: skip 'apps' in '.' root because we already did apps in Task 2
    if (R === '.' && e.name === 'apps') continue;
    if (EXCLUDE.has(e.name)) continue;
    const p=path.join(d,e.name);
    if (e.isDirectory()) walk(p);
    else if (e.isFile() && (SAFE_EXTS.has(path.extname(e.name)) || SAFE_EXTS.has(e.name))) {
      // Skip: prisma/schema.prisma OR prisma/migrations/*.sql explicitly
      if (/(^|\\/)prisma(\\/|$)/.test(p) && (/schema\.prisma$/.test(p) || /\.sql$/.test(p))) continue;
      // Skip env files: only replace VALUES, not NAMES. Simple heuristic: for .env files, don't rename LEFT side of =
      const isEnv = /(\.env(\.|$)|\.envrc)/.test(e.name);
      let s = fs.readFileSync(p,'utf8');
      let s2 = s;
      if (isEnv) {
        s2 = s.split(/\\n/).map(line => {
          const idx = line.indexOf('=');
          if (idx === -1) return line;
          return line.slice(0, idx+1) + ren(line.slice(idx+1));
        }).join('\\n');
      } else {
        s2 = ren(s);
      }
      if (s !== s2) {
        const m = s.match(/vellum|Vellum|VELLUM/g) || [];
        changes += m.length;
        files++;
        fs.writeFileSync(p, s2);
      }
    }
  }}
  walk(absR);
}
console.log('Changed', changes, 'occurrences in', files, 'files');
"
```
Expected: changes ~50–150.

- [ ] **Step 3: Now update references to `deploy-vellbase.mjs` → `deploy-vellbase.mjs` (some callers may have been missed if the string was split or escaped)**
Run:
```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace && \
(grep -rn 'deploy-vellum\.mjs' --include='*' --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next --exclude-dir=.turbo --exclude-dir=.output --exclude-dir=coverage --exclude-dir=test-output . || echo "OK - clean")
```
Expected: `OK - clean`. If not, fix references.

- [ ] **Step 4: Verify exclusion invariants are intact**
Run:
```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace && \
echo "A) prisma files (should be ZERO brand replacements in schema/migrations):" && \
(grep -rn 'vellbase\|Vellbase' packages/api/prisma/ packages/api/_deprecated_migrations/ packages/api/src/**/prisma 2>/dev/null || echo "OK prisma clean") && \
echo "B) mobile-app test-output JSONs (should be ZERO vellbase):" && \
(grep -rn 'vellbase\|Vellbase' apps/mobile-app/tests/test-output/ 2>/dev/null || echo "OK test-output clean") && \
echo "C) env var names (should still say DATABASE_URL, JWT_SECRET etc - no prefix rename. printing left side of = only):" && \
find . -maxdepth 4 -type f \( -name '.env*' -o -name '.envrc' \) -not -path '*/node_modules/*' -not -path '*/.next/*' | head -5 | xargs -I{} sh -c 'echo "-- {}"; grep -Eo "^[A-Z_][A-Z0-9_]*=" {} || true'
```
Expected: (A) OK prisma clean, (B) OK test-output clean, (C) env var NAMES unchanged (still `DATABASE_URL` etc — no `Vellbase` in NAMES).

- [ ] **Step 5: Stage + commit**
```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace && \
git add -A && \
git commit -m "chore: rename packages/CI/scripts/docs/deploy Vellum -> Vellbase

Strategy 2 Phase 3. Renames deploy-vellbase.mjs -> deploy-vellbase.mjs,
updates GitHub URLs, workflow descriptions, prisma.compute.json
project references, and remaining non-app copy. Excludes Prisma schema/
migrations, env var NAMES, test output QA JSONs, and 3rd-party URLs."
```

---

## Task 4: Clean-reinstall workspace symlinks + verify all 4 smoke builds

**Files:**
- None new / modify — only delete node_modules and package-lock.json + regenerate them.

- [ ] **Step 1: Wipe old workspace resolution**
```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace && \
rm -rf node_modules/.package-lock.json node_modules/@vellum node_modules/@vellbase node_modules package-lock.json || true && \
for d in packages/* apps/*; do rm -rf "$d/node_modules" "$d/.next" "$d/.turbo" "$d/.output" "$d/dist" || true; done && \
echo "wiped OK"
```

- [ ] **Step 2: `npm install` at root — regenerate package-lock.json + workspace symlinks**
Run:
```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace && npm install --no-audit --no-fund 2>&1 | tail -10
echo "exit=$?"
```
Expected: exit=0, no `E404` or `Could not resolve from @vellbase/...`.

- [ ] **Step 3: Smoke build 1 — `@vellbase/api` Nest build + TSC**
```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api && \
(NODE_OPTIONS='--max-old-space-size=6144' npx tsc -b --pretty false 2>&1 | tail -10) && \
echo "tsc exit=$?" && \
(npm run build 2>&1 | tail -5) && echo "build exit=$?"
```
Expected: tsc exit=0, build exit=0. Fail here means: a missing import or a missed `@vellum→@vellbase`; fix and re-run.

- [ ] **Step 4: Smoke build 2 — `@vellbase/admin-dashboard` Vite build**
```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/admin-dashboard && \
(npm run build 2>&1 | tail -10) && echo "admin build exit=$?"
```
Expected: exit=0. Failures = missed package rename import in TS imports under `apps/admin-dashboard`.

- [ ] **Step 5: Smoke build 3 — `@vellbase/web-app` Vite build**
```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/web-app && \
(npm run build 2>&1 | tail -10) && echo "web build exit=$?"
```
Expected: exit=0.

- [ ] **Step 6: Smoke build 4 — `@vellbase/mobile-app` Expo TS typecheck**
```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace/apps/mobile-app && \
(npm run typecheck 2>&1 | tail -20) && echo "mobile typecheck exit=$?"
```
Expected: exit=0. Failures = missed imports or rename inside Expo/TS files.

- [ ] **Step 7: (Optional) Lint pass — but don't block the rename on style issues**
```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace && \
(npm run lint --workspaces --if-present 2>&1 | tail -20) || echo "lint exit=$? (non-fatal for rename)"
```

- [ ] **Step 8: Fast runtime smoke — start API, ping /api/health, stop**
```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api && \
(pkill -f 'packages/api/dist/src/main' 2>/dev/null; sleep 2; \
 (NODE_OPTIONS='--max-old-space-size=4096' npm run start:dev > /tmp/nest-after-rename.log 2>&1 &) ; sleep 14; \
 curl -s -o /tmp/health.json -w "HTTP %{http_code}\\n" http://localhost:3001/api/health; echo ""; \
 cat /tmp/health.json; \
 pkill -f 'packages/api/dist/src/main' 2>/dev/null || true)
```
Expected: HTTP 200 + `{"status":"ok"...}`. No start errors (no broken module imports in Nest bootstrap).

- [ ] **Step 9: Commit the regenerated package-lock.json and workspace builds green confirmation.**
```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace && \
git add -A package-lock.json && \
git commit -m "chore: regenerate package-lock + workspace symlinks for @vellbase/*

Smoke tests pass:
  tsc -b packages/api   (exit 0)
  npm run build:api     (exit 0)
  npm run build:admin   (exit 0)
  npm run build:web     (exit 0)
  npm run typecheck:mobile (exit 0)
  GET /api/health       (HTTP 200)"
```

---

## Task 5: Push to both remotes (vellbase-monorepo + vellbase-api standalone)

**Context note:** Spec says URLs in code updated to vellbase-monorepo / vellbase-api, but actual GitHub repos may or may not yet exist under new names. If GitHub remote still named `origin = https://…/vellum-monorepo.git` (git remote URL), keep that for push; we rename URLs only *in code/configs*. For the vellbase-api standalone mirror, we sync as usual using a fresh temp clone of the STANDALONE REPO URL that actually works (whatever currently returns 200 clone).

- [ ] **Step 1: Push monorepo to current origin**
```bash
cd /Users/mcdarsenemwale/projects/dev/ai_article_worskspace && \
git status --short && echo "---" && git push origin 2>&1 | tail -5
echo "push monorepo exit=$?"
```
Expected: push exit=0.

- [ ] **Step 2: Sync packages/api → standalone vellbase-api (mirror repo). First, try new remote name; fall back to old URL if it 404s:**
```bash
NEW_URL="https://github.com/mcdarsenekmwale/vellbase-api.git"
OLD_URL="https://github.com/mcdarsenekmwale/vellum-api.git"
SYNC_SRC="/Users/mcdarsenemwale/projects/dev/ai_article_worskspace/packages/api"
TMP=$(mktemp -d /tmp/vellbase-api-sync-XXXXXX)
cd "$TMP" && \
( git clone --depth 1 --branch main "$NEW_URL" sync-target 2>/dev/null && echo "USED NEW $NEW_URL" ) || \
( rm -rf sync-target ; git clone --depth 1 --branch main "$OLD_URL" sync-target && echo "USED OLD $OLD_URL — still works" )
cd sync-target && \
rsync -a --delete \
  --exclude='node_modules' --exclude='dist' --exclude='.env*' --exclude='coverage' --exclude='.turbo' \
  "$SYNC_SRC/src" "$SYNC_SRC/prisma" "$SYNC_SRC/scripts" "$SYNC_SRC/docs" "$SYNC_SRC/package.json" \
  "$SYNC_SRC/tsconfig.json" "$SYNC_SRC/tsconfig.spec.json" "$SYNC_SRC/Dockerfile" "$SYNC_SRC/docker-compose.yml" \
  "$SYNC_SRC/docker-entrypoint.sh" "$SYNC_SRC/bunfig.toml" "$SYNC_SRC/test-server.js" . 2>&1 | tail -3
rsync -a "$SYNC_SRC/.github" . 2>&1 | tail -2
# Ensure standalone package name matches @vellbase/api (already written by Task 1 helper so rsync copies new package.json already)
git add -A && git status --short | head -20
git commit -m "chore!: rename package + brand Vellum -> Vellbase (standalone API)

Same changes as monorepo sync: @vellbase/api name, imports, display
copy, deploy script name updated to deploy-vellbase.mjs, Prisma
compute + github URLs/descriptions updated. Protected Prisma schema,
migrations, and env var NAMES unchanged." 2>&1 | tail -3
git push origin main 2>&1 | tail -5
echo "vellbase-api push exit=$?"
```

Expected: commit pushed to whichever URL works (new or fallback).

- [ ] **Step 3: Print post-rename sanity URLs (optional)**
After Prisma Compute redeploys (~4 min), run:
```bash
node -e "
const BASE='https://cmrxaaqf14uh403f7xj4wceyp.ewr.prisma.build';
(async()=>{ const r=await fetch(BASE+'/api/health'); console.log('PROD health:', r.status, JSON.stringify(await r.json()).slice(0,120));})();
"
```

---

## Plan self-review (ran by author)
1. Spec coverage:
   - [x] Package identity rename + all consumers import rename (Task 1)
   - [x] Visible app brand rename in admin/web/mobile (Task 2)
   - [x] Packages/CI/scripts/docs/deploy rename + `deploy-vellbase.mjs` → `deploy-vellbase.mjs` (Task 3)
   - [x] Excluded-from-rename all enforced (every task lists explicit skip-globs)
   - [x] Clean reinstall + 4 smoke builds + `/api/health` runtime smoke (Task 4)
   - [x] Push monorepo + standalone vellbase-api (Task 5)
2. No placeholders — each Step shows the exact command to run.
3. Type consistency: `@vellbase/` prefix used identically in package.json names, `dependencies`, and `import` path strings.
