import { readFile, writeFile } from "node:fs/promises";

const phrases = JSON.parse(await readFile("scripts/legacy-copy-source.json", "utf8"));
const locales = ["ko", "ja", "zh-CN", "uz", "vi", "mn", "ms"];
const targetCodes = { ko: "ko", ja: "ja", "zh-CN": "zh-CN", uz: "uz", vi: "vi", mn: "mn", ms: "ms" };
const batchSize = 16;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const cleanMarker = (value) => value.replace(/^\[\[\d+\]\]\]\s*/, "").trim();

async function translateBatch(locale, values, attempt = 0) {
  const source = values.map((value, index) => `[[[${index}]]] ${value}`).join("\n");
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.search = new URLSearchParams({ client: "gtx", sl: "en", tl: targetCodes[locale], dt: "t", q: source }).toString();
  const response = await fetch(url, { headers: { "user-agent": "KU-Settle-i18n-maintenance/1.0" } });
  if (!response.ok) {
    if (attempt < 4) { await sleep(700 * 2 ** attempt); return translateBatch(locale, values, attempt + 1); }
    throw new Error(`${locale}: ${response.status}`);
  }
  const body = await response.json();
  const translated = body[0].map((segment) => segment[0]).join("");
  const matches = [...translated.matchAll(/\[\[\[(\d+)\]\]\]\s*([\s\S]*?)(?=\n?\[\[\[\d+\]\]\]|$)/g)];
  if (matches.length !== values.length) {
    if (values.length === 1) return [cleanMarker(translated.replace(/^\[\[\[0\]\]\]\s*/, ""))];
    const midpoint = Math.ceil(values.length / 2);
    return [...await translateBatch(locale, values.slice(0, midpoint)), ...await translateBatch(locale, values.slice(midpoint))];
  }
  return matches.sort((a, b) => Number(a[1]) - Number(b[1])).map((match) => cleanMarker(match[2]));
}

let existing = {};
try { existing = JSON.parse(await readFile("app/i18n/legacy-copy.json", "utf8")); } catch { /* first run */ }
const output = Object.fromEntries(phrases.map((phrase) => [phrase, { ...(existing[phrase] ?? {}), en: phrase }]));
for (const locale of locales) {
  const missing = phrases.filter((phrase) => !output[phrase][locale]);
  for (let offset = 0; offset < missing.length; offset += batchSize) {
    const batch = missing.slice(offset, offset + batchSize);
    const translated = await translateBatch(locale, batch);
    batch.forEach((phrase, index) => { output[phrase][locale] = translated[index]?.trim() || phrase; });
    process.stdout.write(`${locale}: ${Math.min(offset + batch.length, missing.length)}/${missing.length}\r`);
    await sleep(100);
  }
  process.stdout.write(`${locale}: complete\n`);
}
await writeFile("app/i18n/legacy-copy.json", `${JSON.stringify(output, null, 2)}\n`, "utf8");
