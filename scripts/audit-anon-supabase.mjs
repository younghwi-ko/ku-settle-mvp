import { readFileSync } from "node:fs";

function loadLocalEnvironment() {
  const values = {};
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    values[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return values;
}

const env = loadLocalEnvironment();
const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!baseUrl || !publishableKey) throw new Error("Public Supabase environment is not configured.");

const fakeUser = "11111111-1111-4111-8111-111111111111";
const fakeItem = "22222222-2222-4222-8222-222222222222";
const commonHeaders = { apikey: publishableKey, Authorization: `Bearer ${publishableKey}`, "Content-Type": "application/json", Prefer: "return=representation" };
const requests = [
  ["profiles select", "profiles?select=user_id", "GET"],
  ["profiles insert", "profiles", "POST", { user_id: fakeUser, display_name: "Anonymous" }],
  ["profiles update", `profiles?user_id=eq.${fakeUser}`, "PATCH", { display_name: "Anonymous" }],
  ["progress select", "lifecycle_progress?select=user_id,task_id", "GET"],
  ["progress insert", "lifecycle_progress", "POST", { user_id: fakeUser, task_id: "arc", completed: true }],
  ["progress update", `lifecycle_progress?user_id=eq.${fakeUser}&task_id=eq.arc`, "PATCH", { completed: false }],
  ["progress delete", `lifecycle_progress?user_id=eq.${fakeUser}&task_id=eq.arc`, "DELETE"],
  ["marketplace select", "marketplace_items?select=id,seller_id", "GET"],
  ["marketplace seller spoof", "marketplace_items", "POST", { seller_id: fakeUser, seller_display_name: "Anonymous", item_name: "Blocked item", price_krw: 1000, category: "home", condition: "good", pickup_location: "Blocked", availability: "available" }],
  ["marketplace update", `marketplace_items?id=eq.${fakeItem}`, "PATCH", { status: "sold" }],
  ["marketplace delete", `marketplace_items?id=eq.${fakeItem}`, "DELETE"]
];

let unexpected = false;
for (const [name, path, method, body] of requests) {
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, { method, headers: commonHeaders, body: body ? JSON.stringify(body) : undefined });
  let error = {};
  try { error = await response.json(); } catch { error = {}; }
  const message = typeof error?.message === "string" ? error.message.slice(0, 240) : "";
  console.log(JSON.stringify({ name, status: response.status, code: error?.code ?? null, message }));
  if (response.status < 400) unexpected = true;
}

if (unexpected) throw new Error("At least one anonymous request was not rejected.");
console.log(JSON.stringify({ result: "pass", checked: requests.length }));
