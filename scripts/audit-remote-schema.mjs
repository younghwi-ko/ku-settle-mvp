import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const projectRef = process.env.SUPABASE_PROJECT_REF ?? "exdyfbqhsnreridjbfgo";
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error("Set SUPABASE_ACCESS_TOKEN only in the current local shell before running this read-only audit.");

const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query/read-only`;
const queries = {
  migrations: "select version, name from supabase_migrations.schema_migrations order by version",
  tables: "select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('profiles','lifecycle_progress','marketplace_items') and c.relkind='r' order by c.relname",
  columns: "select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name in ('profiles','lifecycle_progress','marketplace_items') order by table_name, ordinal_position",
  constraints: "select c.conname, n.nspname as schema_name, r.relname as table_name, c.contype, pg_catalog.pg_get_constraintdef(c.oid, true) as definition from pg_catalog.pg_constraint c join pg_catalog.pg_class r on r.oid=c.conrelid join pg_catalog.pg_namespace n on n.oid=r.relnamespace where n.nspname='public' and r.relname in ('profiles','lifecycle_progress','marketplace_items') order by r.relname,c.conname",
  triggers: "select n.nspname as schema_name, c.relname as table_name, t.tgname, pg_catalog.pg_get_triggerdef(t.oid, true) as definition from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and ((n.nspname='public' and c.relname in ('profiles','lifecycle_progress','marketplace_items')) or (n.nspname='auth' and c.relname='users')) order by n.nspname,c.relname,t.tgname",
  functions: "select n.nspname as schema_name, p.proname, pg_catalog.pg_get_functiondef(p.oid) as definition from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('set_updated_at','set_progress_completed_at','prevent_owner_change','handle_new_user','before_user_created','is_active_auth_user') order by p.proname",
  policies: "select schemaname, tablename, policyname, roles, cmd, qual, with_check from pg_catalog.pg_policies where schemaname='public' and tablename in ('profiles','lifecycle_progress','marketplace_items') order by tablename,policyname",
  grants: "select n.nspname as schema_name,c.relname as table_name,coalesce(pg_catalog.pg_get_userbyid(a.grantee),'PUBLIC') as grantee,a.privilege_type from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where n.nspname='public' and c.relname in ('profiles','lifecycle_progress','marketplace_items') order by c.relname,grantee,a.privilege_type"
};

async function runReadOnly(query) {
  const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
  if (!response.ok) throw new Error(`Read-only Management API request failed with status ${response.status}.`);
  return response.json();
}

const remote = {};
for (const [name, query] of Object.entries(queries)) remote[name] = await runReadOnly(query);

const rows = (value) => Array.isArray(value) ? value : Array.isArray(value?.result) ? value.result : [];
const tableRows = rows(remote.tables);
const constraintRows = rows(remote.constraints);
const triggerRows = rows(remote.triggers);
const policyRows = rows(remote.policies);
const grantRows = rows(remote.grants);
const migrationRows = rows(remote.migrations);
const expectedPolicies = ["profiles_select_own","profiles_update_own","progress_select_own","progress_insert_own","progress_update_own","progress_delete_own","marketplace_select_visible","marketplace_insert_own","marketplace_update_own","marketplace_delete_own"];
const checks = {
  migrationApplied: migrationRows.some((row) => String(row.version) === "202608280001"),
  tablesPresent: ["profiles","lifecycle_progress","marketplace_items"].every((name) => tableRows.some((row) => row.table_name === name)),
  rlsEnabled: tableRows.length === 3 && tableRows.every((row) => row.rls_enabled === true),
  cascadeForeignKeys: constraintRows.filter((row) => row.contype === "f" && /auth\.users/i.test(row.definition)).length === 3 && constraintRows.filter((row) => row.contype === "f").every((row) => /ON DELETE CASCADE/i.test(row.definition)),
  profileCreationTrigger: triggerRows.some((row) => row.table_name === "users" && row.tgname === "on_auth_user_created"),
  updatedAtTriggers: ["profiles_updated_at","lifecycle_progress_updated_at","marketplace_items_updated_at"].every((name) => triggerRows.some((row) => row.tgname === name)),
  policiesPresent: expectedPolicies.every((name) => policyRows.some((row) => row.policyname === name)),
  policiesAuthenticated: policyRows.length === expectedPolicies.length && policyRows.every((row) => Array.isArray(row.roles) ? row.roles.includes("authenticated") : String(row.roles).includes("authenticated")),
  anonHasNoTableGrant: !grantRows.some((row) => row.grantee === "anon")
};

const migration = readFileSync("supabase/migrations/202608280001_initial_service.sql", "utf8");
const report = { projectRef, generatedAt: new Date().toISOString(), localMigrationSha256: createHash("sha256").update(migration).digest("hex"), checks, remote };
mkdirSync("work", { recursive: true });
writeFileSync("work/remote-schema-audit.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ projectRef, checks, report: "work/remote-schema-audit.json" }, null, 2));
if (Object.values(checks).some((value) => !value)) process.exitCode = 1;
