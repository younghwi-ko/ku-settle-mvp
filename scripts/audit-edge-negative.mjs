import { readFileSync } from "node:fs";

function loadLocalEnvironment() {
  const values = {};
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return values;
}

const env = loadLocalEnvironment();
const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!baseUrl || !publishableKey) throw new Error("Public Supabase environment is not configured.");

const endpoint = `${baseUrl}/functions/v1/delete-account`;
const cases = [
  { name: "missing authorization", headers: { apikey: publishableKey }, body: {} },
  { name: "invalid JWT", headers: { apikey: publishableKey, Authorization: "Bearer invalid.test.token" }, body: {} },
  { name: "body user_id injection without session", headers: { apikey: publishableKey }, body: { user_id: "33333333-3333-4333-8333-333333333333" } }
];

let unexpected = false;
for (const item of cases) {
  const response = await fetch(endpoint, { method: "POST", headers: { ...item.headers, "Content-Type": "application/json" }, body: JSON.stringify(item.body) });
  let result = {};
  try { result = await response.json(); } catch { result = {}; }
  const message = typeof result?.message === "string" ? result.message.slice(0, 240) : typeof result?.error === "string" ? result.error.slice(0, 240) : "";
  console.log(JSON.stringify({ name: item.name, status: response.status, code: result?.code ?? null, message }));
  if (response.status < 400) unexpected = true;
}

if (unexpected) throw new Error("At least one unauthenticated delete-account request was not rejected.");
console.log(JSON.stringify({ result: "pass", checked: cases.length }));
