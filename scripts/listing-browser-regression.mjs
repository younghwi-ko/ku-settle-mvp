import assert from "node:assert/strict";
import { chromium } from "playwright";

// Chromium with simulated HTTP responses. No API requests reach the app or a database.
const base = new URL(process.env.RESERVATION_TEST_BASE_URL ?? "http://127.0.0.1:3107");
assert.ok(["localhost", "127.0.0.1"].includes(base.hostname));
const id = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const reservationId = "33333333-3333-4333-8333-333333333333";
const original = { id, item_name: "내 테스트 상품", seller_name: "Seller", price_krw: 1000, category: "home", condition: "good", pickup_location: "KU", status: "active" };
const other = { ...original, id: otherId, item_name: "타인 테스트 상품" };
const browser = await chromium.launch();
const cases = [
  ...["sold", "hidden", "deleted", "edit", "cancel"].flatMap((action) =>
    ["success", "reject"].map((outcome) => [action, outcome])),
  ["edit", "lost"], ["edit", "unreadable"], ["sold", "lost"], ["cancel", "lost"],
  ["ownership", "success"], ["sample", "success"],
];
let failures = 0;
try {
  for (const [action, outcome] of cases) {
    const scenario = `${action}-${outcome}`;
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: "block" });
    await context.addInitScript(() => localStorage.setItem("ku-settle-setup-skipped:guest", "1"));
    let listing = { ...original, status: action === "cancel" ? "reserved" : "active" };
    let reservation = action === "cancel" ? { id: reservationId, listing_id: id, buyer_name: "Buyer", status: "active", created_at: "2026-01-01T00:00:00Z", expires_at: "2099-01-01T12:00:00Z", pickup_date: "2099-01-01", pickup_start_time: "10:00:00", pickup_end_time: "11:00:00" } : null;
    const writes = [];
    let stateReads = 0;
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== base.origin) return route.abort();
      const path = url.pathname.replace(/\/$/, "");
      if (!path.startsWith("/api/")) return ["GET", "HEAD"].includes(request.method()) ? route.continue() : route.abort();
      const reply = (data, status = 200) => route.fulfill({ json: data, status });
      if (path === "/api/session/bootstrap") return reply({ ok: action !== "sample" }, action === "sample" ? 503 : 200);
      if (path === "/api/account/config") return reply({ emailDeliveryEnabled: false, signupEnabled: false });
      const listings = ["hidden", "deleted"].includes(listing.status) ? [other] : [listing, other];
      if (path === "/api/session/state" && request.method() === "GET") {
        stateReads++;
        if (outcome === "unreadable" && writes.length && stateReads === 2) return reply({}, 502);
        return reply({ listings, myListings: [listing], reservations: reservation ? [reservation] : [], serviceRequests: [], lifecycle: [] });
      }
      if (path === "/api/marketplace/listings" && request.method() === "GET") return reply({ listings, pagination: { page: 1, pageSize: 20, total: listings.length, totalPages: 1 } });
      if (path === `/api/reservations/${reservationId}` && request.method() === "PATCH") {
        writes.push({ path, method: request.method() });
        if (outcome === "reject") return reply({ error: "version_conflict" }, 409);
        reservation.status = request.postDataJSON().status;
        listing.status = "active";
        if (outcome === "lost") return route.abort("connectionreset");
        return reply({ reservation });
      }
      if (path === `/api/marketplace/listings/${id}` && ["PATCH", "DELETE"].includes(request.method())) {
        writes.push({ path, method: request.method() });
        if (outcome === "reject") return reply({ error: "listing_conflict_or_not_found" }, 409);
        if (request.method() === "DELETE") listing.status = "deleted";
        else {
          const payload = request.postDataJSON();
          if (action === "edit") listing = { ...listing, item_name: payload.itemName, description: payload.description, price_krw: payload.priceKrw, pickup_location: payload.pickupLocation };
          else {
            assert.deepEqual(payload, { status: action });
            listing.status = payload.status;
          }
        }
        if (["lost", "unreadable"].includes(outcome)) return route.abort("connectionreset");
        return reply({ ok: true, listing });
      }
      return reply({}, 409);
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => console.error(error.message));
    page.setDefaultTimeout(7000);
    try {
      if (action === "sample") await context.addInitScript(() => {
        if (!localStorage.getItem("ku-settle-local-data-v6")) localStorage.setItem("ku-settle-local-data-v6", JSON.stringify({ products: [{ id: "user-sample", name: "Local sample", priceKrw: 1000, category: "Home", condition: "good", pickup: "KU", status: "Available", icon: "box", source: "sample" }] }));
      });
      const leaving = () => page.getByRole("button", { name: "곧 출국해요", exact: true }).click();
      const rowFor = (name) => page.locator(".my-listing-row").filter({ hasText: name });
      const data = () => page.evaluate(() => JSON.parse(localStorage.getItem("ku-settle-local-data-v6")));
      const success = page.locator(".service-status[role=status]").filter({ hasText: "저장됨" });
      const error = page.locator(".service-status.error");
      const editor = page.getByRole("dialog", { name: "상품 수정", exact: true });
      const editedName = "서버에서 수정한 상품";
      const actions = { sold: "판매 완료로 표시", hidden: "상품 숨기기", deleted: "상품 삭제" };
      const showDeleted = () => page.getByRole("button", { name: "삭제된 상품 보기", exact: true }).click();
      await page.goto(`${base.origin}/?lang=ko&page=marketplace`, { waitUntil: "networkidle", timeout: 60000 });
      await leaving();
      const row = rowFor(action === "sample" ? "Local sample" : original.item_name);
      await row.waitFor();
      if (action === "ownership") {
        assert.equal(await page.locator(".my-listing-row").filter({ hasText: other.item_name }).count(), 0);
        await page.goto(`${base.origin}/?lang=ko&page=marketplace&listing=${otherId}`, { waitUntil: "networkidle" });
        await page.getByRole("dialog", { name: other.item_name }).waitFor();
        assert.equal(await page.locator(".owner-listing-actions").count(), 0);
        assert.deepEqual(writes, []);
      } else if (action === "cancel") {
        await row.getByRole("button", { name: "예약 취소", exact: true }).click();
        if (outcome !== "success") {
          await page.locator(".reservation-result").waitFor();
          assert.equal(await success.count(), 0);
          await page.getByRole("button", { name: "서버 예약 확인", exact: true }).click();
          await page.locator(".reservation-result").waitFor({ state: "hidden" });
        }
        await row.locator(".listing-reservation").waitFor({ state: outcome === "reject" ? "visible" : "hidden" });
        assert.deepEqual(writes, [{ path: `/api/reservations/${reservationId}`, method: "PATCH" }]);
        assert.equal(reservation.status, outcome === "reject" ? "active" : "cancelled");
        await page.reload({ waitUntil: "networkidle" });
        await leaving();
        await row.locator(".listing-reservation").waitFor({ state: outcome === "reject" ? "visible" : "hidden" });
      } else {
        await row.locator(".my-listing-row-main").click();
        if (action === "edit" || action === "sample") {
          await page.getByRole("button", { name: "상품 수정", exact: true }).click();
          await editor.getByLabel("상품명", { exact: true }).fill(editedName);
          await editor.getByRole("button", { name: "저장", exact: true }).click();
          if (outcome !== "success") {
            const message = await editor.getByRole("alert").textContent();
            assert.match(message, outcome === "reject" ? /저장되지 않았습니다/ : /저장됐을 수 있습니다/);
            assert.equal(await success.count(), 0);
            assert.equal(await editor.getByLabel("상품명", { exact: true }).inputValue(), editedName);
          } else await editor.waitFor({ state: "hidden" });
        } else {
          await page.getByRole("button", { name: actions[action], exact: true }).click();
          if (outcome !== "success") {
            assert.match(await error.textContent(), outcome === "reject" ? /저장되지 않았습니다/ : /저장됐을 수 있습니다/);
            assert.equal(await success.count(), 0);
          } else {
            await success.waitFor();
            if (action === "deleted") assert.equal(new URL(page.url()).searchParams.get("listing"), null);
          }
        }
        const expectedName = action === "sample" || (action === "edit" && outcome !== "reject") ? editedName : original.item_name;
        const expectedStatus = outcome === "reject" || action === "edit" || action === "sample" ? "active" : action;
        const saved = (await data()).products.find((item) => item.id === (action === "sample" ? "user-sample" : id));
        assert.equal(saved.name, outcome === "unreadable" ? original.item_name : expectedName);
        assert.equal(saved.serviceStatus, expectedStatus);
        assert.equal(saved.source, action === "sample" ? "sample" : "live");
        assert.equal(writes.length, action === "sample" ? 0 : 1);
        if (["lost", "unreadable"].includes(outcome)) assert.ok(stateReads >= 2);
        await page.goto(`${base.origin}/?lang=ko&page=marketplace`, { waitUntil: "networkidle" });
        await leaving();
        if (expectedStatus === "deleted") {
          assert.equal(await rowFor(expectedName).count(), 0);
          await showDeleted();
        }
        const reloaded = rowFor(expectedName);
        await reloaded.waitFor();
        const afterReload = (await data()).products.find((item) => item.id === (action === "sample" ? "user-sample" : id));
        assert.equal(afterReload.serviceStatus, expectedStatus);
        assert.equal(afterReload.source, action === "sample" ? "sample" : "live");
        if (expectedStatus !== "deleted") {
          await reloaded.locator(".my-listing-row-main").click();
          const detail = page.getByRole("dialog", { name: expectedName, exact: true });
          await detail.getByText(action === "sample" ? "샘플 데이터" : "실제 등록 상품", { exact: true }).waitFor();
          assert.equal(await detail.locator(".availability").textContent(), await reloaded.locator("small").textContent());
        }
      }
      console.log(`PASS ${scenario}`);
    } catch (error) {
      failures++;
      console.error(`FAIL ${scenario}: ${error.message}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (failures) process.exitCode = 1;
