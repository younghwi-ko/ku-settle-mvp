import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("app/i18n/locales");
const targets = ["uz", "vi", "mn", "ms"];
const batchSize = 18;

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));

function flatten(value, prefix = "", output = {}) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => flatten(child, prefix ? `${prefix}.${index}` : String(index), output));
    return output;
  }
  for (const [key, child] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) flatten(child, next, output);
    else output[next] = child;
  }
  return output;
}

function setPath(target, dottedPath, value) {
  const parts = dottedPath.split(".");
  let cursor = target;
  for (const [index, part] of parts.slice(0, -1).entries()) {
    const nextPart = parts[index + 1];
    cursor = cursor[part] ??= /^\d+$/.test(nextPart) ? [] : {};
  }
  cursor[parts.at(-1)] = value;
}

function normalizeShape(source, target) {
  if (Array.isArray(source)) {
    const output = Array.isArray(target) ? target : [];
    return source.map((child, index) => normalizeShape(child, output[index]));
  }
  if (source && typeof source === "object") {
    const output = target && typeof target === "object" && !Array.isArray(target) ? target : {};
    for (const [key, child] of Object.entries(source)) {
      if (key in output) output[key] = normalizeShape(child, output[key]);
    }
    return output;
  }
  return target;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
const cleanMarker = (value) => value.replace(/^\[\[\d+\]\]\]\s*/, "").trim();

async function translateBatch(locale, entries, attempt = 0) {
  const source = entries.map(([, text], index) => `[[[${index}]]] ${text}`).join("\n");
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.search = new URLSearchParams({ client: "gtx", sl: "en", tl: locale, dt: "t", q: source }).toString();
  const response = await fetch(url, { headers: { "user-agent": "KU-Settle-i18n-maintenance/1.0" } });
  if (!response.ok) {
    if (attempt < 4) {
      await sleep(800 * 2 ** attempt);
      return translateBatch(locale, entries, attempt + 1);
    }
    throw new Error(`${locale} translation failed: ${response.status}`);
  }
  const body = await response.json();
  const translated = body[0].map((segment) => segment[0]).join("");
  const matches = [...translated.matchAll(/\[\[\[(\d+)\]\]\]\s*([\s\S]*?)(?=\n?\[\[\[\d+\]\]\]|$)/g)];
  if (matches.length !== entries.length) {
    if (entries.length === 1) return [cleanMarker(translated.replace(/^\[\[\[0\]\]\]\s*/, ""))];
    const midpoint = Math.ceil(entries.length / 2);
    return [
      ...(await translateBatch(locale, entries.slice(0, midpoint))),
      ...(await translateBatch(locale, entries.slice(midpoint))),
    ];
  }
  return matches
    .sort((left, right) => Number(left[1]) - Number(right[1]))
    .map((match) => cleanMarker(match[2]));
}

const english = await readJson(path.join(root, "en.json"));
const englishLeaves = flatten(english);

for (const locale of targets) {
  const file = path.join(root, `${locale}.json`);
  const output = normalizeShape(english, await readJson(file));
  const existing = flatten(output);
  const missing = Object.entries(englishLeaves).filter(([key]) => typeof existing[key] !== "string" || existing[key].trim() === "");

  for (let offset = 0; offset < missing.length; offset += batchSize) {
    const batch = missing.slice(offset, offset + batchSize);
    const translated = await translateBatch(locale, batch);
    batch.forEach(([key], index) => setPath(output, key, translated[index]));
    process.stdout.write(`${locale}: ${Math.min(offset + batch.length, missing.length)}/${missing.length}\r`);
    await sleep(120);
  }

  await writeFile(file, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  process.stdout.write(`${locale}: completed ${missing.length} missing strings\n`);
}
