import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import i18next from "i18next";
import { joinOptionalLabel } from "../app/i18n/formatters.ts";
import { detectLocale, supportedLocales } from "../app/i18n/types.ts";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const expectedNamespaces = ["common", "navigation", "home", "onboarding", "marketplace", "localGuide", "verification", "profile", "admin", "reset", "validation", "errors", "accessibility"];

function deepMerge(base, override) {
  const output = { ...base };
  for (const [key, value] of Object.entries(override ?? {})) {
    output[key] = value && typeof value === "object" && !Array.isArray(value) && base?.[key] && typeof base[key] === "object" && !Array.isArray(base[key])
      ? deepMerge(base[key], value)
      : value;
  }
  return output;
}

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
const interpolationVariables = (value) => [...String(value).matchAll(/{{\s*([\w.-]+)\s*}}/g)].map((match) => match[1]).sort();

const locales = Object.fromEntries(await Promise.all(supportedLocales.map(async (locale) => {
  const source = await readFile(`${projectRoot}app/i18n/locales/${locale}.json`, "utf8");
  return [locale, JSON.parse(source)];
})));

for (const locale of supportedLocales) assert.ok(Object.keys(locales[locale]).every((key) => expectedNamespaces.includes(key)), `${locale}: unknown namespace`);

const reference = flatten(locales.en);
for (const locale of supportedLocales) {
  const candidate = flatten(deepMerge(locales.en, locales[locale]));
  assert.deepEqual([...candidate.keys()].sort(), [...reference.keys()].sort(), `${locale}: translation keys do not match English`);
  for (const [key, value] of candidate) {
    assert.equal(typeof value, "string", `${locale}:${key} must be a string`);
    assert.ok(value.trim().length > 0, `${locale}:${key} is empty`);
    assert.ok(!/^\w+(?:[:.]\w+){1,}$/.test(value), `${locale}:${key} looks like an exposed translation key`);
    assert.deepEqual(interpolationVariables(value), interpolationVariables(reference.get(key)), `${locale}:${key} interpolation variables differ from English`);
    if (["uz", "vi", "mn", "ms"].includes(locale)) assert.ok(!/[가-힣]/.test(value), `${locale}:${key} unexpectedly exposes Korean text`);
  }
}

const sourceFiles = await Promise.all(["app/data.ts", "app/page.tsx"].map((path) => readFile(`${projectRoot}${path}`, "utf8")));
const referencedKeys = new Set(sourceFiles.flatMap((source) => [...source.matchAll(/["'`]((?:common|navigation|home|onboarding|marketplace|localGuide|verification|profile|reset|validation|errors|accessibility):[A-Za-z0-9_.-]+)["'`]/g)].map((match) => match[1])));
for (const key of referencedKeys) {
  const path = key.replace(":", ".");
  assert.ok(reference.has(path) || reference.has(`${path}_one`) || reference.has(`${path}_other`), `Referenced key is missing: ${key}`);
}

assert.equal(detectLocale("ja", "ko", ["en-US"]), "ja", "URL locale must take priority");
assert.equal(detectLocale("invalid", "ko", ["ja-JP"]), "ko", "invalid URL locale must fall back to storage");
assert.equal(detectLocale("invalid", "invalid", ["ja-JP"]), "ja", "invalid URL and storage locales must fall back to the browser");
assert.equal(detectLocale(null, "ko", ["ja-JP"]), "ko", "existing KO storage value must migrate safely");
assert.equal(detectLocale(null, "en", ["ko-KR"]), "en", "existing EN storage value must migrate safely");
assert.equal(detectLocale(null, null, ["ja-JP"]), "ja", "Japanese browser detection failed");
assert.equal(detectLocale(null, null, ["zh-Hans-CN"]), "zh-CN", "Simplified Chinese browser detection failed");
assert.equal(detectLocale(null, null, ["uz-Latn-UZ"]), "uz", "Uzbek browser detection failed");
assert.equal(detectLocale(null, null, ["vi-VN"]), "vi", "Vietnamese browser detection failed");
assert.equal(detectLocale(null, null, ["mn-MN"]), "mn", "Mongolian browser detection failed");
assert.equal(detectLocale(null, null, ["ms-MY"]), "ms", "Malay browser detection failed");
assert.equal(detectLocale(null, null, ["zh-TW"]), "en", "Traditional Chinese must currently fall back to English");
assert.equal(detectLocale(null, null, ["fr-FR"]), "en", "unsupported language must fall back to English");
assert.ok(!JSON.stringify(locales["zh-CN"]).includes("外国人登陆证"), "Simplified Chinese ARC terminology still contains 外国人登陆证");
assert.ok(JSON.stringify(locales["zh-CN"]).includes("外国人登录证（ARC）"), "Simplified Chinese ARC terminology is missing 外国人登录证（ARC）");
assert.equal(joinOptionalLabel("English available", "Call ahead"), "English available · Call ahead", "non-empty optional guidance must include a separator");
assert.equal(joinOptionalLabel("English available", ""), "English available", "empty optional guidance must not include a separator");
assert.equal(joinOptionalLabel("English available", "   "), "English available", "whitespace-only optional guidance must not include a separator");
assert.equal(joinOptionalLabel("English available", null), "English available", "null optional guidance must not include a separator");
assert.equal(joinOptionalLabel("English available", undefined), "English available", "undefined optional guidance must not include a separator");

const fallbackResources = Object.fromEntries(supportedLocales.map((locale) => [locale, { common: structuredClone(deepMerge(locales.en.common, locales[locale].common ?? {})) }]));
delete fallbackResources.ja.common.cancel;
const fallbackInstance = i18next.createInstance();
await fallbackInstance.init({ resources: fallbackResources, lng: "ja", fallbackLng: "en", ns: ["common"], defaultNS: "common", initAsync: false });
assert.equal(fallbackInstance.t("cancel"), locales.en.common.cancel, "production fallback must display English instead of a key");

console.log(`i18n validation passed: ${supportedLocales.length} locales, ${expectedNamespaces.length} namespaces, ${reference.size} leaf keys`);
