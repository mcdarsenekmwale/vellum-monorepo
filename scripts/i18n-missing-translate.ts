#!/usr/bin/env npx ts-node
/**
 * AI Translation CLI — finds __TODO_ markers and translates them.
 * Usage: npx ts-node scripts/i18n-missing-translate.ts [--apply] [--lang=es,de] [--provider=deepseek|openai|mock]
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
const PROVIDER = process.env.TRANSLATE_PROVIDER || "mock";
const APPLY = process.argv.includes("--apply");
const LANG_FILTER = process.argv.find(a => a.startsWith("--lang="))?.split("=")[1]?.split(",");
const TARGET_LANGS = LANG_FILTER ? ALL_LANGS.filter(l => LANG_FILTER.includes(l)) : ALL_LANGS;

const LANG_NAMES: Record<string, string> = {
  fr: "French", es: "Spanish", de: "German", it: "Italian", pt: "Portuguese",
  nl: "Dutch", sv: "Swedish", da: "Danish", fi: "Finnish", no: "Norwegian",
  pl: "Polish", cs: "Czech", hu: "Hungarian", ro: "Romanian", bg: "Bulgarian",
  uk: "Ukrainian", el: "Greek", ar: "Arabic", he: "Hebrew", fa: "Persian",
  tr: "Turkish", hi: "Hindi", id: "Indonesian", ms: "Malay", th: "Thai",
  zh: "Chinese (Simplified)", ja: "Japanese", ko: "Korean", vi: "Vietnamese", ru: "Russian",
};

// Escape a string for safe interpolation into a RegExp.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Load a dict file and extract the object literal it exports.
function loadDict(lang: string): Record<string, Record<string, string>> {
  const file = path.join(SHARED_DIR, `base.${lang}.ts`);
  const src = fs.readFileSync(file, "utf-8");
  const match = src.match(/(?:export\s+)?const\s+\w+\s*:\s*NamespaceDict\s*=\s*(\{[\s\S]*\});/);
  if (!match) throw new Error(`Could not parse ${file}`);
  // eslint-disable-next-line no-eval
  return eval(`(${match[1]})`);
}

// Find keys with __TODO_ markers
function findTodos(en: any, target: any, lang: string): Array<{ns: string; key: string; enValue: string}> {
  const todos: Array<{ns: string; key: string; enValue: string}> = [];
  for (const ns of Object.keys(en)) {
    for (const key of Object.keys(en[ns])) {
      const val = target[ns]?.[key];
      if (!val || val.startsWith("__TODO_")) {
        todos.push({ ns, key, enValue: en[ns][key] });
      }
    }
  }
  return todos;
}

// Call AI API. `ns` is the single namespace every item in `batch` belongs to —
// batching never mixes namespaces, so a key name that legitimately repeats
// across namespaces (e.g. "title" in discover vs compose) stays unambiguous.
async function translateBatch(lang: string, ns: string, batch: Array<{ns: string; key: string; enValue: string}>, siblings: Array<{key: string; en: string; translated: string}>): Promise<Record<string, string>> {
  if (PROVIDER === "mock") {
    // Mock: just use the EN value as the translation
    const result: Record<string, string> = {};
    for (const item of batch) result[item.key] = item.enValue;
    return result;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn(`No API key for ${PROVIDER}. Using EN fallback.`);
    const result: Record<string, string> = {};
    for (const item of batch) result[item.key] = item.enValue;
    return result;
  }

  const siblingCtx = siblings.slice(0, 3).map(s => `  ${s.key}: "${s.en}" → "${s.translated}"`).join("\n");
  const items = batch.map(i => `  "${i.key}": "${i.enValue}"`).join(",\n");

  const prompt = `You are translating UI strings for Vellum, an article-reading social app.
Target language: ${LANG_NAMES[lang] || lang} (code: ${lang})
Namespace: ${ns}
Respond ONLY with valid JSON: {"key1": "translation1", ...}
Preserve {{var}} placeholders literally — do NOT translate them.

Context (same namespace, already translated for tone):
${siblingCtx}

Translate these English strings:
{
${items}
}`;

  const url = PROVIDER === "deepseek" ? "https://api.deepseek.com/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: PROVIDER === "deepseek" ? "deepseek-chat" : "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });
    if (!resp.ok) throw new Error(`API returned ${resp.status}`);
    const data = await resp.json() as any;
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error(`Translation failed for ${lang}.${ns}: ${e}`);
    const result: Record<string, string> = {};
    for (const item of batch) result[item.key] = item.enValue;
    return result;
  }
}

// Locate the [openBrace, closeBrace+1) range of a namespace block (e.g.
// `  discover: { ... }`) in the dict source. Returns null if not found.
function findNamespaceBlock(src: string, ns: string): [number, number] | null {
  const header = src.search(new RegExp(`(^|\\n)  ${escapeRegex(ns)}:\\s*\\{`));
  if (header === -1) return null;
  const openBrace = src.indexOf("{", header);
  if (openBrace === -1) return null;
  let depth = 1;
  let i = openBrace + 1;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === '"') {
      // skip a double-quoted string literal (honouring \" escapes)
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
  }
  if (depth !== 0) return null;
  return [openBrace, i]; // i is the position just after the closing "}"
}

// Write translations back to the dict file. Replacements are scoped to each
// namespace block so that a key name repeated across namespaces (e.g. "title")
// gets the value that belongs to THAT namespace.
function applyTranslations(lang: string, translations: Record<string, Record<string, string>>) {
  const file = path.join(SHARED_DIR, `base.${lang}.ts`);
  let src = fs.readFileSync(file, "utf-8");
  let replaced = 0;
  for (const ns of Object.keys(translations)) {
    const range = findNamespaceBlock(src, ns);
    if (!range) continue;
    const [start, end] = range;
    let block = src.slice(start, end);
    let blockReplaced = 0;
    for (const key of Object.keys(translations[ns])) {
      const newVal = translations[ns][key].replace(/"/g, '\\"');
      const todoRegex = new RegExp(`(${escapeRegex(key)}:\\s*)"__TODO_${lang.toUpperCase()}_${escapeRegex(key)}"`, "g");
      const matches = block.match(todoRegex);
      if (matches) {
        block = block.replace(todoRegex, `$1"${newVal}"`);
        blockReplaced += matches.length;
      }
    }
    if (blockReplaced > 0) {
      src = src.slice(0, start) + block + src.slice(end);
      replaced += blockReplaced;
    }
  }
  fs.writeFileSync(file, src);
  return replaced;
}

async function main() {
  const en = loadDict("en");
  const report: any = { provider: PROVIDER, apply: APPLY, languages: {} };
  let totalMissing = 0;
  let totalTranslated = 0;

  for (const lang of TARGET_LANGS) {
    const target = loadDict(lang);
    const todos = findTodos(en, target, lang);
    if (todos.length === 0) {
      report.languages[lang] = { missing: 0, translated: 0 };
      continue;
    }
    totalMissing += todos.length;

    // Build sibling context (already-translated entries from the same dict)
    const siblings: Array<{key: string; en: string; translated: string}> = [];
    for (const ns of Object.keys(target)) {
      for (const k of Object.keys(target[ns])) {
        const v = target[ns][k];
        if (v && !v.startsWith("__TODO_")) {
          siblings.push({ key: k, en: en[ns]?.[k] || k, translated: v });
          if (siblings.length >= 3) break;
        }
      }
      if (siblings.length >= 3) break;
    }

    // Group todos by namespace. Batches never mix namespaces so a key name
    // that repeats across namespaces keeps its per-namespace EN value.
    const todosByNs: Record<string, typeof todos> = {};
    for (const t of todos) {
      if (!todosByNs[t.ns]) todosByNs[t.ns] = [];
      todosByNs[t.ns].push(t);
    }

    const allTranslations: Record<string, Record<string, string>> = {};
    for (const ns of Object.keys(todosByNs)) {
      const nsTodos = todosByNs[ns];
      allTranslations[ns] = {};
      for (let i = 0; i < nsTodos.length; i += 20) {
        const batch = nsTodos.slice(i, i + 20);
        const result = await translateBatch(lang, ns, batch, siblings);
        for (const key of Object.keys(result)) {
          allTranslations[ns][key] = result[key];
          if (!result[key].startsWith("__TODO_")) totalTranslated++;
        }
      }
    }

    report.languages[lang] = { missing: todos.length, translated: todos.length };

    if (APPLY) {
      const replaced = applyTranslations(lang, allTranslations);
      console.log(`  ${lang}: replaced ${replaced} TODO markers`);
    }

    if (!APPLY) {
      console.log(`\n── ${lang.toUpperCase()} (${todos.length} TODO markers) ──`);
      for (const ns of Object.keys(todosByNs)) {
        const nsTodos = todosByNs[ns];
        for (let i = 0; i < nsTodos.length; i += 20) {
          const batch = nsTodos.slice(i, i + 20);
          const result = await translateBatch(lang, ns, batch, siblings);
          for (const item of batch) {
            const val = result[item.key] || item.enValue;
            console.log(`  ${item.ns}.${item.key}: "${item.enValue}" → "${val}"`);
          }
        }
      }
    }
  }

  const reportDir = path.resolve(ROOT, "apps/mobile-app/tests/test-output");
  if (fs.existsSync(reportDir)) {
    fs.writeFileSync(path.join(reportDir, "missing-translations-report.json"), JSON.stringify(report, null, 2));
  }

  console.log(`\n${APPLY ? "✅" : "📋 Dry run."} ${totalTranslated}/${totalMissing} translations ${APPLY ? "applied" : "previewed"}.`);
  console.log(`Provider: ${PROVIDER}`);
}

main().catch(e => { console.error(e); process.exit(1); });
