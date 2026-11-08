import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

// 실제 Chromium UI + 모의 HTTP. 모든 API 요청을 가로채며 실제 DB 검증이 아니다.
const base = new URL(process.env.RESERVATION_TEST_BASE_URL ?? "http://localhost:3001");
assert.ok(["localhost", "127.0.0.1"].includes(base.hostname), "모의 예약 검증은 로컬 앱만 허용합니다.");
const productId = "11111111-1111-4111-8111-111111111111";
const reservationId = "22222222-2222-4222-8222-222222222222";
const name = "예약 검증용 가상 상품";
const initialListing = { id: productId, item_name: name, seller_name: "Fixture", price_krw: 1000, category: "home", condition: "good", pickup_location: "KU", status: "active" };
const reservation = (status = "active", end = "11:00") => ({ id: reservationId, listing_id: productId, buyer_name: "Fixture", status, created_at: "2026-01-01T00:00:00Z", expires_at: "2099-01-01T12:00:00Z", pickup_date: "2099-01-01", pickup_start_time: "10:00:00", pickup_end_time: `${end}:00` });
const copy = { ko: { reserve: "예약하기", check: "서버 예약 확인", retry: "같은 요청 재시도" }, en: { reserve: "Reserve item", check: "Check server reservation", retry: "Retry same request" } };
const browser = await chromium.launch({ headless: true });
let passed = 0;
const scenarios = ["success", "reject", "lost-found", "lost-retry", "lookup-failure", "server-502", "cancelled", "expired", "duplicate", "edit-cancel", "edit-lost", "cancel-lost", "cancel-reject"];
const cases = [...["initial-reserved-cancel", "initial-reserved-reject", "initial-reserved-other", "initial-reserved-sold", "initial-reserved-hidden", "initial-reserved-refetch"].flatMap((s) => ["ko", "en"].map((l) => [s, l, 390])), ...scenarios.map((s) => [s, "ko", 390]), ["success", "en", 390], ["success", "ko", 1440], ["success", "en", 1440], ["success", "ko", 320], ["success", "en", 320], ["lookup-failure", "ko", 320], ["lookup-failure", "en", 320]];
try {
  for (const [scenario, locale, width] of cases) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
    await context.addInitScript(() => localStorage.setItem("ku-settle-setup-skipped:guest", "1"));
    const initialReserved = scenario.startsWith("initial-reserved");
    let listing = { ...initialListing, status: initialReserved ? "reserved" : "active" };
    let posts = 0; let patches = 0; let lookups = 0; let current = initialReserved ? reservation() : null; let release;
    const keys = []; let stateLoaded = false; let refetchFailed = false;
    await context.route("**/*", async (route) => {
      const request = route.request(); const url = new URL(request.url());
      if (url.origin !== base.origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return ["GET", "HEAD"].includes(request.method()) ? route.continue() : route.abort();
      const reply = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      const path = url.pathname.replace(/\/$/, "");
      if (path === "/api/session/bootstrap") return reply({ ok: true });
      if (path === "/api/account/config") return reply({ emailDeliveryEnabled: false, signupEnabled: false });
      if (path === "/api/session/state" && request.method() === "GET") {
        if (scenario === "initial-reserved-refetch" && patches && !refetchFailed) { refetchFailed = true; return reply({}, 502); }
        stateLoaded = true; return reply({ listings: listing.status === "hidden" ? [] : [listing], myListings: [], reservations: current ? [current] : [], serviceRequests: [], lifecycle: [] });
      }
      if (path === "/api/marketplace/listings") return reply({ listings: listing.status === "hidden" ? [] : [listing], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
      if (path === `/api/marketplace/listings/${productId}/reservations`) {
        if (request.method() === "GET") { lookups++; return scenario === "lookup-failure" ? reply({}, 502) : reply({ reservation: current }); }
        if (request.method() === "POST") {
          posts++; keys.push(request.headers()["x-idempotency-key"]);
          assert.ok(stateLoaded, "초기 상태 조회 전 예약 요청");
          if (scenario === "reject") return reply({ error: "listing_unavailable" }, 409);
          if (scenario === "server-502") return reply({}, 502);
          if (["lost-found", "lookup-failure"].includes(scenario)) { current = reservation(); listing.status = "reserved"; return route.abort(); }
          if (scenario === "lost-retry" && posts === 1) return route.abort();
          if (scenario === "duplicate") await new Promise((resolve) => { release = resolve; });
          current = reservation(["cancelled", "expired"].includes(scenario) ? scenario : "active");
          listing.status = current.status === "active" ? "reserved" : "active";
          return reply({ reservation: current }, 201);
        }
      }
      if (path === `/api/reservations/${reservationId}` && request.method() === "PATCH") {
        patches++; const body = request.postDataJSON();
        if (["cancel-reject", "initial-reserved-reject"].includes(scenario)) return reply({}, 409);
        current = body.status === "cancelled" ? reservation("cancelled", "12:00") : reservation("active", "12:00");
        if (body.status === "cancelled") listing = { ...listing, status: scenario === "initial-reserved-other" ? "reserved" : scenario === "initial-reserved-sold" ? "sold" : scenario === "initial-reserved-hidden" ? "hidden" : "active" };
        if (["edit-lost", "cancel-lost"].includes(scenario)) return route.abort();
        return reply({ reservation: current });
      }
      // 미등록 API도 절대 실제 서버로 보내지 않는다.
      return reply({ error: "fixture_not_available" }, 503);
    });
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    const data = () => page.evaluate(() => JSON.parse(localStorage.getItem("ku-settle-local-data-v6")));
    const noConfirmation = async () => {
      assert.deepEqual((await data()).preferences.reservedProductIds, []);
      assert.equal(await page.locator(".service-status").count(), 0, "실패·미확인 요청에 성공 배너가 남음");
    };
    const waitConfirmed = () => page.waitForFunction((id) => JSON.parse(localStorage.getItem("ku-settle-local-data-v6"))?.preferences.reservations.some((r) => r.id === id && r.status === "active"), reservationId);
    try {
      await page.goto(`${base.origin}/?lang=${locale}&page=marketplace`, { waitUntil: "networkidle" });
      await page.locator(".product-card").filter({ hasText: name }).click();
      if (initialReserved) {
        const card = page.locator(".product-card").filter({ hasText: name });
        const labels = JSON.parse(readFileSync(new URL(`../app/i18n/locales/${locale}.json`, import.meta.url), "utf8"));
        const settled = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const snapshot = async () => ({ cardReserved: await card.locator(".availability").evaluate((el) => el.classList.contains("reserved")), detailReserved: await page.locator(".modal .availability").evaluate((el) => el.classList.contains("reserved")), cardLabel: await card.locator(".availability").textContent(), detailLabel: await page.locator(".modal .availability").textContent() });
        const initial = { cardReserved: true, detailReserved: true, cardLabel: labels.common.reserved, detailLabel: labels.common.reserved };
        assert.deepEqual(await snapshot(), initial);
        await page.locator(".modal .product-actions .primary").click();
        const rejected = scenario === "initial-reserved-reject";
        if (rejected) { await page.locator(".reservation-result").waitFor(); assert.equal(await page.locator(".service-status[role=status]").count(), 0); }
        else if (scenario === "initial-reserved-refetch") {
          await page.locator(".reservation-result").waitFor(); await settled();
          assert.deepEqual(await snapshot(), initial, "상품 재조회 실패를 Available로 추정함");
          assert.equal(await page.locator(".service-status[role=status]").count(), 0, "상품 재조회 실패에 성공 배너 표시");
          await page.locator(".reservation-result button").click();
          await page.locator(".reservation-result").waitFor({ state: "hidden" });
        } else await page.locator(".service-status[role=status]").waitFor();
        await settled();
        if (listing.status === "hidden") {
          await page.locator(".modal").waitFor({ state: "hidden" });
          assert.equal(await card.count(), 0); assert.equal(new URL(page.url()).searchParams.has("listing"), false);
          await page.reload({ waitUntil: "networkidle" });
          assert.equal(await card.count(), 0); assert.equal(await page.locator(".modal").count(), 0);
        } else {
        const reserved = listing.status === "reserved" || listing.status === "sold";
        const label = listing.status === "sold" ? labels.marketplace.sold : listing.status === "reserved" ? labels.common.reserved : labels.common.available;
        const expected = { cardReserved: reserved, detailReserved: reserved, cardLabel: label, detailLabel: label };
        assert.equal(listing.status, rejected || scenario === "initial-reserved-other" ? "reserved" : scenario === "initial-reserved-sold" ? "sold" : "active");
        assert.deepEqual(await snapshot(), expected, "취소 후 렌더링·상세 동기화가 끝나도 서버 상태와 불일치");
        if (listing.status === "sold") {
          assert.equal(await page.locator(".modal .product-actions .primary").isDisabled(), true);
        }
        if (scenario === "initial-reserved-other") assert.equal(await page.locator(".modal .product-actions .primary").isDisabled(), true, "타인의 예약을 취소할 수 있는 버튼 표시");
        await page.locator(".modal-close").click();
        await page.locator(".modal").waitFor({ state: "hidden" });
        await card.click(); await page.locator(".modal").waitFor(); await settled();
        assert.deepEqual(await snapshot(), expected, "닫았다 다시 연 상세 불일치");
        await page.reload({ waitUntil: "networkidle" }); await page.locator(".modal").waitFor(); await settled();
        assert.deepEqual(await snapshot(), expected, "서버 응답 기반 새로고침 불일치");
        }
        assert.equal((await data()).preferences.reservations[0].status, rejected ? "active" : "cancelled");
        assert.equal(posts, 0); assert.equal(patches, 1);
        console.log(`PASS 모의 HTTP 브라우저: ${scenario}, ${locale}, ${width}px`); passed++;
        continue;
      }
      await page.locator(".modal").last().getByRole("button", { name: copy[locale].reserve, exact: true }).click();
      const form = page.locator(".modal form").last();
      await form.locator('[name="pickupDate"]').fill("2099-01-01");
      await form.locator('[name="pickupStartTime"]').fill("10:00");
      await form.locator('[name="pickupEndTime"]').fill("11:00");
      if (scenario === "duplicate") {
        await form.evaluate((el) => { el.requestSubmit(); el.requestSubmit(); });
        await page.waitForFunction(() => document.querySelector('form[aria-busy="true"]'));
        assert.equal(await form.locator('[type="submit"]').isDisabled(), true);
        await noConfirmation();
        while (!release) await new Promise((resolve) => setTimeout(resolve, 10));
        release();
      } else await form.locator('[type="submit"]').click();
      if (["reject", "lost-found", "lost-retry", "lookup-failure", "server-502", "cancelled", "expired"].includes(scenario)) {
        await form.getByRole("alert").waitFor(); await noConfirmation();
        assert.ok(await form.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), "예약 안내 가로 넘침");
        if (["lost-found", "lost-retry", "lookup-failure"].includes(scenario)) {
          await form.getByRole("button", { name: copy[locale].check, exact: true }).click();
          if (scenario === "lookup-failure") { await form.getByRole("button", { name: copy[locale].check, exact: true }).waitFor({ state: "visible" }); await noConfirmation(); assert.equal(posts, 1); }
          if (scenario === "lost-retry") { await form.getByRole("button", { name: copy[locale].retry, exact: true }).click(); await waitConfirmed(); assert.equal(posts, 2); assert.equal(keys[0], keys[1]); }
          if (scenario === "lost-found") { await waitConfirmed(); assert.equal(posts, 1); }
          assert.equal(lookups, 1);
        }
      } else {
        await waitConfirmed(); assert.equal(posts, 1);
        assert.equal((await data()).preferences.reservations[0].id, reservationId);
        if (["edit-cancel", "edit-lost", "cancel-lost", "cancel-reject"].includes(scenario)) {
          await page.keyboard.press("Escape");
          const card = page.locator(".reservation-card").first();
          if (["edit-cancel", "edit-lost"].includes(scenario)) {
            await card.locator(".reservation-card-actions button").first().click();
            const edit = page.locator(".modal form").last();
            await edit.locator('[name="pickupEndTime"]').fill("12:00");
            await edit.locator('[type="submit"]').click();
            if (scenario === "edit-lost") { await edit.getByRole("alert").waitFor(); await edit.getByRole("button", { name: copy[locale].check, exact: true }).click(); }
            await page.waitForFunction(() => JSON.parse(localStorage.getItem("ku-settle-local-data-v6")).preferences.reservations[0].pickupEndTime === "12:00");
            assert.equal(posts, 1); assert.equal(patches, 1);
          }
          if (scenario !== "edit-lost") {
            await card.locator(".reservation-card-actions button").last().click();
            if (scenario !== "edit-cancel") {
              await page.locator(".reservation-result").waitFor();
              assert.equal((await data()).preferences.reservations[0].status, "active");
              assert.equal(await page.locator(".service-status[role=status]").count(), 0);
              await page.locator(".reservation-result button").click();
            }
            if (scenario !== "cancel-reject") {
              await page.waitForFunction(() => JSON.parse(localStorage.getItem("ku-settle-local-data-v6")).preferences.reservations[0].status === "cancelled");
              assert.deepEqual((await data()).preferences.reservedProductIds, []);
            } else assert.equal((await data()).preferences.reservations[0].status, "active");
            assert.equal(patches, scenario === "edit-cancel" ? 2 : 1);
          }
        } else if (scenario === "success") {
          await page.reload({ waitUntil: "networkidle" }); await waitConfirmed();
          assert.equal((await data()).preferences.reservations[0].id, reservationId);
          await page.goto(`${base.origin}/?lang=${locale}&page=marketplace&listing=1`, { waitUntil: "networkidle" });
          assert.equal(await page.locator(".product-actions").count(), 0, "샘플 상품에 예약 버튼 노출");
          assert.equal(posts, 1);
        }
      }
      console.log(`PASS 모의 HTTP 브라우저: ${scenario}, ${locale}, ${width}px`); passed++;
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
console.log(`모의 HTTP 브라우저 ${passed}/${cases.length} 통과. 실제 DB 요청·데이터 생성 없음.`);
