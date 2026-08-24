#!/usr/bin/env npx ts-node
/**
 * Verifies all language dictionaries have every key from EN base.
 * Reports missing keys and TODO markers.
 *
 * Loads each base.<lang>.ts file directly via fs. The shared-i18n package is
 * declared as ESM ("type": "module"), so static TS imports of the dict files
 * would require explicit .ts extensions and edits to auto-generated files —
 * parsing the source objects directly avoids that and keeps the check portable.
 */
import * as fs from "fs";
import * as path from "path";

// These scripts are invoked via `npx ts-node scripts/<script>.ts` from the
// monorepo root, so process.cwd() is the repo root. Using it (rather than
// __dirname / import.meta.url) keeps the script portable across the CJS and
// ESM modes that different Node / ts-node versions pick.
const ROOT = process.cwd();
const SHARED_DIR = path.resolve(ROOT, "packages/shared-i18n/dictionaries");
const ALL_LANGS = ["fr","es","de","it","pt","nl","sv","da","fi","no","pl","cs","hu","ro","bg","uk","el","ar","he","fa","tr","hi","id","ms","th","zh","ja","ko","vi","ru"];

type Dict = Record<string, Record<string, string>>;

// Load a dict file and extract the object literal it exports.
function loadDict(lang: string): Dict {
  const file = path.join(SHARED_DIR, `base.${lang}.ts`);
  const src = fs.readFileSync(file, "utf-8");
  const match = src.match(/(?:export\s+)?const\s+\w+\s*:\s*NamespaceDict\s*=\s*(\{[\s\S]*\});/);
  if (!match) throw new Error(`Could not parse ${file}`);
  // eslint-disable-next-line no-eval
  return eval(`(${match[1]})`);
}

const EN_DICT: Dict = loadDict("en");

const DICTS: Record<string, Dict> = {};
for (const lang of ALL_LANGS) DICTS[lang] = loadDict(lang);

let errors = 0;
let todos = 0;

for (const [lang, dict] of Object.entries(DICTS)) {
  for (const ns of Object.keys(EN_DICT)) {
    const enKeys = Object.keys(EN_DICT[ns] || {});
    const langKeys = Object.keys(dict[ns] || {});
    const missing = enKeys.filter(k => !langKeys.includes(k));
    const extra = langKeys.filter(k => !enKeys.includes(k));
    const nsTodos = langKeys.filter(k => (dict[ns]?.[k] || "").startsWith("__TODO_"));

    if (missing.length > 0) {
      console.error(`❌ ${lang}.${ns}: missing ${missing.length} keys: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}`);
      errors += missing.length;
    }
    if (extra.length > 0) {
      console.warn(`⚠️  ${lang}.${ns}: ${extra.length} extra keys not in EN`);
    }
    if (nsTodos.length > 0) {
      todos += nsTodos.length;
    }
  }
}

if (errors > 0) {
  console.error(`\n❌ ${errors} missing keys found.`);
  process.exit(1);
} else {
  console.log(`✅ All 31 languages have all EN keys.`);
  if (todos > 0) {
    console.log(`⏳ ${todos} TODO markers remain (EN fallback used at runtime).`);
    console.log(`   Run: npx ts-node scripts/i18n-missing-translate.ts --apply to fill them.`);
  }
  process.exit(0);
}
