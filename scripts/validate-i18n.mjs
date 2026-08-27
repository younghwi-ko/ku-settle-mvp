import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import i18next from "i18next";
import { detectLocale, supportedLocales } from "../app/i18n/types.ts";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const expectedNamespaces = ["common", "navigation", "home", "onboarding", "marketplace", "localGuide", "verification", "profile", "reset", "validation", "errors", "accessibility"];

function flatten(value, prefix = "", output = new Map()) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => flatten(entry, `${prefix}.${index}`, output));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) => flatten(entry, prefix ? `${prefix}.${key}` : key, output));
  } else {
    output.set(prefix, value);
  }
  return output;
}

const locales = Object.fromEntries(await Promise.all(supportedLocales.map(async (locale) => {
  const source = await readFile(`${projectRoot}app/i18n/locales/${locale}.json`, "utf8");
  return [locale, JSON.parse(source)];
})));

for (const locale of supportedLocales) {
  assert.deepEqual(Object.keys(locales[locale]), expectedNamespaces, `${locale}: namespace order or names differ`);
}

const reference = flatten(locales.en);
for (const locale of supportedLocales) {
  const candidate = flatten(locales[locale]);
  assert.deepEqual([...candidate.keys()], [...reference.keys()], `${locale}: translation keys do not match English`);
  for (const [key, value] of candidate) {
    assert.equal(typeof value, "string", `${locale}:${key} must be a string`);
    assert.ok(value.trim().length > 0, `${locale}:${key} is empty`);
    assert.ok(!/^\w+(?:[:.]\w+){1,}$/.test(value), `${locale}:${key} looks like an exposed translation key`);
  }
}

const sourceFiles = await Promise.all(["app/data.ts", "app/page.tsx"].map((path) => readFile(`${projectRoot}${path}`, "utf8")));
const referencedKeys = new Set(sourceFiles.flatMap((source) => [...source.matchAll(/["'`]((?:common|navigation|home|onboarding|marketplace|localGuide|verification|profile|reset|validation|errors|accessibility):[A-Za-z0-9_.-]+)["'`]/g)].map((match) => match[1])));
for (const key of referencedKeys) {
  const path = key.replace(":", ".");
  assert.ok(reference.has(path) || reference.has(`${path}_one`) || reference.has(`${path}_other`), `Referenced key is missing: ${key}`);
}

assert.equal(detectLocale("ja", "ko", ["en-US"]), "ja", "URL locale must take priority");
assert.equal(detectLocale(null, "ko", ["ja-JP"]), "ko", "existing KO storage value must migrate safely");
assert.equal(detectLocale(null, "en", ["ko-KR"]), "en", "existing EN storage value must migrate safely");
assert.equal(detectLocale(null, null, ["ja-JP"]), "ja", "Japanese browser detection failed");
assert.equal(detectLocale(null, null, ["zh-Hans-CN"]), "zh-CN", "Simplified Chinese browser detection failed");
assert.equal(detectLocale(null, null, ["zh-TW"]), "en", "Traditional Chinese must currently fall back to English");
assert.equal(detectLocale(null, null, ["fr-FR"]), "en", "unsupported language must fall back to English");

const fallbackResources = Object.fromEntries(supportedLocales.map((locale) => [locale, { common: structuredClone(locales[locale].common) }]));
delete fallbackResources.ja.common.cancel;
const fallbackInstance = i18next.createInstance();
await fallbackInstance.init({ resources: fallbackResources, lng: "ja", fallbackLng: "en", ns: ["common"], defaultNS: "common", initAsync: false });
assert.equal(fallbackInstance.t("cancel"), locales.en.common.cancel, "production fallback must display English instead of a key");

console.log(`i18n validation passed: ${supportedLocales.length} locales, ${expectedNamespaces.length} namespaces, ${reference.size} leaf keys`);
