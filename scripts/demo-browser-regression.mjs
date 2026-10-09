import assert from "node:assert/strict";
import { chromium } from "playwright";
import { join } from "node:path";

// This suite exercises the rendered app, not HTTP/DB persistence. Even GET session
// bootstrap/state handlers can write, so only assets and account config are allowed.
const base = new URL(process.env.DEMO_TEST_BASE_URL ?? "http://localhost:3001");
assert.ok(!base.username && !base.password && ["http:", "https:"].includes(base.protocol));
assert.ok(["localhost", "127.0.0.1", "temporary-fleet-maroon-2opm8kt.vercel.app"].includes(base.hostname), "Unapproved demo origin");
const browser = await chromium.launch({ headless: true });
let blocked = 0;
const failures = [];
const urlFor = (params) => { const url = new URL(base.origin); url.search = new URLSearchParams(params).toString(); return url.toString(); };
async function load(page, url) {
  const response = await page.goto(url, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => document.documentElement.dataset.locale);
}
async function expanded(page, value) {
  await page.waitForFunction((open) => document.querySelector("#guide-arc-current-check details")?.open === open, value);
}
async function noOverflow(page, selector) {
  const measurements = await page.locator(selector).evaluate((root) => {
    const boundary = root.getBoundingClientRect();
    const outside = [...root.querySelectorAll("*")].filter((el) => {
      if (!el.getClientRects().length) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && (rect.right > boundary.right + 1 || rect.left < boundary.left - 1);
    }).map((el) => `${el.tagName}.${el.className}`);
    return { client: root.clientWidth, scroll: root.scrollWidth, outside };
  });
  assert.ok(measurements.scroll <= measurements.client + 1, `${selector} content overflow: ${JSON.stringify(measurements)}`);
  assert.deepEqual(measurements.outside, [], `${selector} overflowing descendants`);
}
async function clickable(locator) {
  await locator.scrollIntoViewIfNeeded();
  assert.equal(await locator.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return Boolean(hit && (el === hit || el.contains(hit)));
  }), true, "Another element covers the control");
}
try {
  for (const locale of ["ko", "en"]) for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 1000 : 844 }, serviceWorkers: "block" });
    // Disposable browser-local state only. Never borrow an existing user's cookies.
    await context.addInitScript(() => localStorage.setItem("ku-settle-setup-skipped:guest", "1"));
    await context.route("**/*", (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== base.origin || !["GET", "HEAD"].includes(request.method()) || (url.pathname.startsWith("/api/") && url.pathname !== "/api/account/config")) {
        blocked += 1;
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const article = page.locator("#guide-arc-current-check");
    try {
      await load(page, urlFor({ lang: locale }));
      await page.locator(".hero h1").waitFor();
      assert.equal(await page.getByRole("dialog").count(), 0, "Skipped setup reappeared");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, "Home horizontal overflow");
      await noOverflow(page, ".next-task-grid");
      if (process.env.DEMO_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.DEMO_SCREENSHOT_DIR, `home-${locale}-${width}.png`), animations: "disabled" });

      await load(page, urlFor({ lang: locale, page: "life-guide", review: "demo" }));
      await article.waitFor();
      await expanded(page, false);
      const historyBefore = await page.evaluate(() => history.length);
      await article.locator("summary").click();
      await expanded(page, true);
      let params = new URL(page.url()).searchParams;
      assert.equal(params.get("guide"), "arc-current-check");
      assert.equal(params.get("lang"), locale);
      assert.equal(params.get("review"), "demo");
      assert.equal(await page.evaluate(() => history.length), historyBefore + 1, "Automatic opening wrote extra history entries");
      await noOverflow(page, "#guide-arc-current-check");
      await noOverflow(page, "#guide-arc-current-check .guide-progress");
      if (process.env.DEMO_SCREENSHOT_DIR) await article.screenshot({ path: join(process.env.DEMO_SCREENSHOT_DIR, `arc-${locale}-${width}.png`), animations: "disabled" });
      const select = article.locator("select");
      await clickable(select);
      await select.selectOption("completed"); // Longest appointment label in KO/EN.
      await noOverflow(page, "#guide-arc-current-check .guide-progress");
      if (process.env.DEMO_SCREENSHOT_DIR) {
        await article.locator(".guide-progress").scrollIntoViewIfNeeded();
        await article.locator(".guide-progress").screenshot({ path: join(process.env.DEMO_SCREENSHOT_DIR, `appointment-${locale}-${width}.png`), animations: "disabled" });
      }
      await select.selectOption("not_required");
      await page.reload({ waitUntil: "networkidle" });
      await expanded(page, true);
      assert.equal(await select.inputValue(), "not_required", "Browser-local progress did not survive refresh");
      await article.locator("summary").click();
      await expanded(page, false);
      assert.equal(new URL(page.url()).searchParams.has("guide"), false);
      await page.goBack(); await expanded(page, true);
      await page.goForward(); await expanded(page, false);
      // Keyboard-generated click follows the same URL path, not a native-toggle loop.
      await article.locator("summary").focus();
      await page.keyboard.press("Enter"); await expanded(page, true);
      const address = page.url();
      await load(page, address); await expanded(page, true);
      const stableHistory = await page.evaluate(() => history.length);
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => history.length), stableHistory);
      await article.locator(".guide-primary-cta").click();
      const task = page.locator('[data-task-id="arc"]');
      await task.waitFor();
      assert.equal(await task.locator(".guide-progress select").inputValue(), "not_required", "ARC card progress differs from guide");
      params = new URL(page.url()).searchParams;
      assert.equal(params.get("stage"), "first-weeks");
      assert.equal(params.get("taskId"), "arc");
      await page.waitForFunction(() => {
        const box = document.querySelector('[data-task-id="arc"]')?.getBoundingClientRect();
        // Expanded ARC cards may be taller than the mobile viewport.
        return box && box.top < innerHeight && box.bottom > 68;
      });
      await page.reload({ waitUntil: "networkidle" }); await task.waitFor();
      await page.goBack(); await expanded(page, true);

      await load(page, urlFor({ lang: locale, page: "marketplace", listing: "1" }));
      const dialog = page.locator(".modal[role=dialog]");
      await dialog.waitFor();
      await noOverflow(page, ".modal");
      const maps = dialog.locator(".map-action-inline a");
      assert.equal(await maps.count(), 2);
      for (const link of await maps.all()) {
        await clickable(link);
        const href = await link.getAttribute("href");
        assert.match(href, /^https:\/\/(www\.)?google\.com\/maps/);
        const popupPromise = context.waitForEvent("page");
        await link.click();
        const popup = await popupPromise;
        await popup.close(); // External requests are blocked; no remote Maps operation.
      }
      const share = dialog.locator(".share-link button");
      await clickable(share); await share.click();
      await dialog.locator(".share-feedback").waitFor();
      if (process.env.DEMO_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.DEMO_SCREENSHOT_DIR, `listing-${locale}-${width}.png`), animations: "disabled" });
      await page.reload({ waitUntil: "networkidle" }); await dialog.waitFor();
      const close = dialog.locator(".modal-close");
      await clickable(close); await close.click();
      await dialog.waitFor({ state: "hidden" });
      assert.equal(new URL(page.url()).searchParams.has("listing"), false);
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(await dialog.count(), 0, "Closed listing reopens on refresh");
      const card = page.locator(".product-card").filter({ hasText: locale === "ko" ? "전기밥솥" : "Rice Cooker" }).first();
      await card.click();
      await dialog.waitFor();
      await page.goBack(); await dialog.waitFor({ state: "hidden" });
      await page.goForward(); await dialog.waitFor();
      await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
      assert.equal(new URL(page.url()).searchParams.has("listing"), false);
      await card.click(); await dialog.waitFor();
      await page.locator(".modal-backdrop").click({ position: { x: 2, y: 2 } });
      await dialog.waitFor({ state: "hidden" });
      assert.equal(new URL(page.url()).searchParams.has("listing"), false);
      console.log(`PASS ${locale} ${width}px: home bounds, ARC bounds/progress/history/target, listing maps/share/close/history`);
    } catch (error) {
      failures.push(`${locale} ${width}px: ${error.message}`);
      console.error(`FAIL ${locale} ${width}px: ${error.stack}`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
console.log(`UI-only regression: ${6 - failures.length}/6 viewport/locale combinations passed; ${blocked} API/external/non-read requests blocked. No server persistence tested.`);
if (failures.length) process.exitCode = 1;
