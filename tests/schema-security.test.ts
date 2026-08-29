import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../supabase/migrations/202608280001_initial_service.sql", import.meta.url), "utf8");

describe("database security migration", () => {
  it.each(["profiles", "lifecycle_progress", "marketplace_items"])("enables RLS and revokes anon access on %s", (table) => {
    expect(migration).toContain(`alter table public.${table} enable row level security`);
    expect(migration).toMatch(new RegExp(`revoke all on[^;]*public\\.${table}[^;]*from anon`, "s"));
  });

  it("uses cascading auth-user foreign keys and immutable owners", () => {
    expect(migration.match(/references auth\.users\(id\) on delete cascade/g)).toHaveLength(3);
    expect(migration).toContain("new.user_id <> old.user_id");
    expect(migration).toContain("new.seller_id <> old.seller_id");
  });

  it("limits profiles and progress to the authenticated owner", () => {
    for (const policy of ["profiles_select_own", "profiles_update_own", "progress_select_own", "progress_insert_own", "progress_update_own", "progress_delete_own"]) {
      expect(migration).toContain(`create policy ${policy}`);
    }
    expect(migration).toMatch(/create policy profiles_select_own[\s\S]*to authenticated[\s\S]*auth\.uid\(\)[\s\S]*user_id/);
    expect(migration).not.toMatch(/grant insert[^;]*public\.profiles/i);
  });

  it("allows only authenticated marketplace owners to write and hides non-public states from other users", () => {
    expect(migration).toContain("status in ('active','sold') or seller_id = (select auth.uid())");
    expect(migration).toContain("seller_id = (select auth.uid()) and status = 'active'");
    expect(migration).toContain("create policy marketplace_update_own");
    expect(migration).toContain("create policy marketplace_delete_own");
    expect(migration).not.toMatch(/create policy[^;]+to anon/i);
  });

  it("creates profiles and maintains timestamps with dedicated triggers", () => {
    expect(migration).toContain("create trigger on_auth_user_created after insert on auth.users");
    for (const trigger of ["profiles_updated_at", "lifecycle_progress_updated_at", "marketplace_items_updated_at"]) expect(migration).toContain(`create trigger ${trigger}`);
  });
});
