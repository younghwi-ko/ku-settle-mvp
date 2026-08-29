import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

describe("Guest and Demo storage boundaries", () => {
  it("persists checklist, verification, products, and profile only outside authenticated mode", () => {
    expect(page.match(/appMode !== "authenticated"[^\n]*localStorage\.setItem/g)?.length).toBeGreaterThanOrEqual(3);
    expect(page).toContain('if (appMode === "authenticated") return;');
  });

  it("keeps Demo and Guest listings local without auth", () => {
    expect(page).toContain('appMode === "demo" || appMode === "guest"');
    expect(page).toContain('source: "demo", ownedByCurrentUser: true');
  });

  it("keeps Reset demo local and unavailable to authenticated accounts", () => {
    expect(page).toContain('[storageKeys.profile, storageKeys.checklist, storageKeys.verified, storageKeys.userProducts].forEach');
    expect(page).toContain('appMode !== "authenticated" && <><button className="reset-demo"');
  });

  it("preserves Guest or Demo UI when Supabase account loading fails", () => {
    expect(page).toMatch(/catch \(error\) \{ setServiceMessage\(mapServiceError\(error\)\); \}/);
    expect(page).not.toMatch(/catch \(error\)[^}]*setAppMode\("authenticated"\)/);
  });
});
