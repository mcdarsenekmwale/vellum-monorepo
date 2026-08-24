#!/usr/bin/env npx ts-node
/**
 * Injects missing keys (present in EN but absent in target lang) as
 * __TODO_<LANG>_<KEY> markers so i18n-missing-translate.ts can translate them.
 *
 * Usage: npx ts-node scripts/i18n-add-missing-todos.ts [--apply]
 */
import * as fs from "fs";
import * as path from "path";

const ROOT = process.cwd();
const SHARED_DIR = path.resolve(ROOT, "packages/shared-i18n/dictionaries");
const ALL_LANGS = ["fr","es","de","it","pt","nl","sv","da","fi","no","pl","cs","hu","ro","bg","uk","el","ar","he","fa","tr","hi","id","ms","th","zh","ja","ko","vi","ru"];
const APPLY = process.argv.includes("--apply");

type Dict = Record<string, Record<string, string>>;

function loadDict(lang: string): Dict {
  const file = path.join(SHARED_DIR, `base.${lang}.ts`);
  const src = fs.readFileSync(file, "utf-8");
  const match = src.match(/(?:export\s+)?const\s+\w+\s*:\s*NamespaceDict\s*=\s*(\{[\s\S]*\});/);
  if (!match) throw new Error(`Could not parse ${file}`);
  return eval(`(${match[1]})`);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Locate the last closing brace of a namespace block. We search for the pattern:
 *   namespace: {
 *     ... keys ...
 *   },  <-- this is the end of the block
 */
function findNamespaceBlockEnd(src: string, ns: string): { blockEnd: number; lastKeyEnd: number } | null {
  // Find namespace header
  const header = src.search(new RegExp(`(^|\\n)  ${escapeRegex(ns)}:\\s*\\{`));
  if (header === -1) return null;
  const openBrace = src.indexOf("{", header);
  if (openBrace === -1) return null;

  let depth = 1;
  let i = openBrace + 1;
  let lastKeyPos = -1; // position just after the last value's comma

  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === '"') {
      // Skip a double-quoted string literal (honouring \" escapes)
      i++;
      while (i < src.length) {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === '"') { i++; break; }
        i++;
      }
    } else if (ch === "{") {
      depth++; i++;
    } else if (ch === "}") {
      depth--; i++;
    } else {
      i++;
    }
    // Track the position just after each comma inside the namespace
    if (depth === 1 && ch === ",") {
      lastKeyPos = i;
    }
  }
  if (depth !== 0) return null;
  return { blockEnd: i, lastKeyEnd: lastKeyPos === -1 ? openBrace + 1 : lastKeyPos };
}

/**
 * Append missing keys into the namespace block just before the closing "}".
 */
function appendMissingKeys(
  src: string,
  ns: string,
  missingKeys: string[],
  enDict: Dict,
  langCode: string
): { newSrc: string; count: number } {
  const info = findNamespaceBlockEnd(src, ns);
  if (!info || missingKeys.length === 0) return { newSrc: src, count: 0 };

  const todoValue = (key: string) => `__TODO_${langCode.toUpperCase()}_${key}`;
  const lines = missingKeys.map(k => `    ${k}: "${todoValue(k)}",`).join("\n");
  const insertStr = "\n" + lines + "\n";

  const insertAt = info.blockEnd - 1; // just before "}"
  const newSrc = src.slice(0, insertAt) + insertStr + src.slice(insertAt);
  return { newSrc, count: missingKeys.length };
}

function main() {
  const enDict = loadDict("en");
  let totalAdded = 0;
  const report: Record<string, Record<string, number>> = {};

  for (const lang of ALL_LANGS) {
    const file = path.join(SHARED_DIR, `base.${lang}.ts`);
    let src = fs.readFileSync(file, "utf-8");
    const targetDict = loadDict(lang);
    report[lang] = {};
    let langAdded = 0;

    for (const ns of Object.keys(enDict)) {
      const enKeys = Object.keys(enDict[ns] || {});
      const targetKeys = new Set(Object.keys(targetDict[ns] || {}));
      const missing = enKeys.filter(k => !targetKeys.has(k));
      if (missing.length === 0) continue;

      report[lang][ns] = missing.length;
      const { newSrc, count } = appendMissingKeys(src, ns, missing, enDict, lang);
      src = newSrc;
      langAdded += count;
      totalAdded += count;
    }

    if (APPLY && langAdded > 0) {
      fs.writeFileSync(file, src);
      console.log(`✅ ${lang.toUpperCase()}: added ${langAdded} TODO markers`);
    } else if (langAdded > 0) {
      const breakdown = Object.entries(report[lang]).map(([ns, n]) => `${ns}:${n}`).join(", ");
      console.log(`📋 ${lang.toUpperCase()}: would add ${langAdded} TODO markers (${breakdown})`);
    }
  }

  if (APPLY) {
    console.log(`\n✅ Done. Added ${totalAdded} TODO markers across ${ALL_LANGS.length} languages.`);
    console.log(`   Now run: npx ts-node scripts/i18n-missing-translate.ts --apply`);
  } else {
    console.log(`\n📋 Dry run. ${totalAdded} TODO markers would be added. Use --apply to write changes.`);
  }
}

try {
  main();
} catch (e: any) {
  console.error(e);
  process.exit(1);
}
