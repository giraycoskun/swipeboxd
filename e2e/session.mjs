#!/usr/bin/env node
/**
 * A real group session, driven by two browsers.
 *
 *   # server: PROVIDER=tmdb, display-name login, throwaway DB
 *   cd ~/Repos/messer-swipe && rm -f /tmp/e2e-session.db
 *   DATABASE_URL="file:/tmp/e2e-session.db" npx tsx src/db/migrate.js
 *   PROVIDER=tmdb DATABASE_URL="file:/tmp/e2e-session.db" AUTH_SECRET=… \
 *     npx next dev -p 3101 --hostname 127.0.0.1
 *   E2E_SESSION_BASE_URL=http://127.0.0.1:3101 npm run e2e:session
 *
 * TMDB mode is what makes this cheap: `authenticate()` returns a fresh local
 * identity per display name, so two contexts are two members with no second
 * Jellyfin account and no credential file. Media comes from Playwright routes.
 *
 * `/api/session/matches` is NOT used as the assertion: it resolves every match
 * through the provider, and a TMDB instance with no token cannot. The database is
 * the durable fact, so the test reads it directly.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.E2E_SESSION_BASE_URL || "http://127.0.0.1:3101";
const DB = process.env.E2E_SESSION_DB || "/tmp/e2e-session.db";
const SHOTS = path.join(ROOT, "e2e/shots");
const require = createRequire(import.meta.url);

function loadPlaywright() {
  const roots = [
    path.join(ROOT, "node_modules"),
    process.env.PLAYWRIGHT_PATH,
    path.join(process.env.HOME ?? "", "Repos/messer-ui/node_modules"),
    "/tmp/node_modules",
  ].filter(Boolean);
  for (const root of roots) {
    try {
      return require(require.resolve("playwright", { paths: [root] }));
    } catch {}
  }
  throw new Error("playwright not found — npm i -D playwright, or set PLAYWRIGHT_PATH");
}

const movie = (n) => ({
  Id: `session-fixture-${n}`,
  Name: `Session Fixture ${n}`,
  ProductionYear: 2010 + n,
  CommunityRating: 7.1,
  Overview: `Fixture ${n}.`,
  UserData: { IsFavorite: false, Played: false },
});

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const matchRows = (code) => {
  try {
    const out = execFileSync("sqlite3", [DB, `select count(distinct externalId) from "Like" where isMatch = 1 and sessionCode = '${String(code).replace(/'/g, "''")}';`], { encoding: "utf8" }).trim();
    return Number(out);
  } catch (error) {
    return `unreadable: ${error.message}`;
  }
};

const fixtures = async (page, items) => {
  await page.route("**/api/media/items**", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify({ items, hasMore: false }) }));
  await page.route("**/api/media/item/**", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify(items[0]) }));
  await page.route("**/api/media/start-here**", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify({ startHere: { action: "start", label: "Start S1E1" }, hostOnly: false }) }));
};

const waitDeck = async (page, timeout = 45000) => {
  await page.waitForFunction(() => {
    const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    return !!el?.closest('[data-slot="card"]');
  }, { timeout }).catch(() => {});
  await page.waitForTimeout(400);
};

const login = async (page, name) => {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  const input = page.locator('input[placeholder="Display name"]');
  const submit = page.locator("button[type=submit]");
  await input.waitFor({ timeout: 60000 });

  // A controlled input can swallow the first typing (the hydration race the contract
  // e2e documents), and a disabled submit swallows the click without a word. Try both
  // mechanisms, then fail loudly instead of timing out on a selector nobody will reach.
  let ready = false;
  for (let attempt = 0; attempt < 6 && !ready; attempt++) {
    await input.click();
    await input.fill(name);
    await page.waitForTimeout(700);
    if ((await input.inputValue()) === name && await submit.isEnabled()) { ready = true; break; }
    await input.fill("");
    await input.pressSequentially(name, { delay: 40 });
    await page.waitForTimeout(700);
    ready = await submit.isEnabled();
  }
  if (!ready) {
    await page.screenshot({ path: path.join(SHOTS, "login-stuck.png") });
    throw new Error(`the login form never enabled for ${name} (input="${await input.inputValue()}")`);
  }

  await submit.click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 30000 }).catch(() => {});
  await waitDeck(page);
};

const api = (page, url, init) =>
  page.evaluate(async ({ url, init }) => {
    const res = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers || {}) },
    });
    const text = await res.text();
    try { return { status: res.status, body: JSON.parse(text) }; }
    catch { return { status: res.status, body: text }; }
  }, { url, init });

const topTitle = (page) =>
  page.evaluate(() => {
    // The deck stacks four cards and the DOM order is back-to-front, so the first
    // card in the document is the one at the bottom. Ask the screen instead.
    const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    const card = el?.closest('[data-slot="card"]');
    return card?.querySelector("h2")?.textContent?.trim() ?? null;
  });

const takeover = (page) =>
  page.evaluate(() => {
    const dialog = document.querySelector("[data-match-takeover]");
    if (!dialog) return null;
    const content = dialog.firstElementChild?.getBoundingClientRect();
    return {
      label: dialog.getAttribute("aria-label") || "",
      covers: Math.round(dialog.getBoundingClientRect().width) >= window.innerWidth,
      contentWidth: Math.round(content?.width ?? 0),
      text: (dialog.innerText || "").replace(/\s+/g, " ").slice(0, 160),
    };
  });

const waitTakeover = async (page, timeout = 10000) => {
  await page.waitForSelector("[data-match-takeover]", { timeout }).catch(() => {});
  return takeover(page);
};

const dismissTakeover = async (page) => {
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll("[data-match-takeover] button"))
      .find((el) => /continue/i.test(el.textContent ?? ""));
    button?.click();
  });
  await page.waitForSelector("[data-match-takeover]", { state: "detached", timeout: 10000 }).catch(() => {});
};

const main = async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  if (!fs.existsSync(DB)) throw new Error(`no session database at ${DB} — migrate it first`);
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const items = [1, 2, 3, 4].map(movie);

  const ctxA = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const ada = await ctxA.newPage();
  await fixtures(ada, items);
  await login(ada, "Ada");
  const whoAmI = await api(ada, "/api/session");
  console.log(`debug  Ada is on ${new URL(ada.url()).pathname} · /api/session ${whoAmI.status} · ${JSON.stringify(whoAmI.body).slice(0, 120)}`);

  // 1. the host opens a session
  const created = await api(ada, "/api/session", { method: "POST", body: JSON.stringify({ action: "create" }) });
  check("POST /api/session {action:create} succeeds", created.status === 200 && created.body?.code, JSON.stringify(created.body).slice(0, 80));
  const code = created.body?.code;
  check("the code looks like a code", /^[A-Z0-9]{4,8}$/.test(code || ""), String(code));

  // 2. the second member joins by URL
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const bo = await ctxB.newPage();
  await fixtures(bo, items);
  await login(bo, "Bo");
  await bo.goto(`${BASE}/?join=${code}`, { waitUntil: "domcontentloaded" });
  // Joining changes the session, so the deck unmounts and refetches, and the app
  // opens the session sheet for the new member. Close it before typing: a dialog
  // owns the keyboard, which is exactly the behaviour the deck keys implement.
  await bo.waitForTimeout(3000);
  await bo.keyboard.press("Escape");
  await bo.waitForSelector('[role="dialog"][data-state="open"]', { state: "detached", timeout: 8000 }).catch(() => {});
  await waitDeck(bo);

  const boSession = await api(bo, "/api/session");
  check("the second member carries the same code", boSession.body?.code === code, `${boSession.body?.code} vs ${code}`);
  const members = await api(bo, "/api/session/members");
  const memberList = Array.isArray(members.body) ? members.body : (members.body?.members ?? []);
  check("the session has two members", memberList.length === 2, memberList.map((m) => m.externalUserName ?? m.userName ?? m.name).join(", "));

  // 3. one like is not a match
  await ada.keyboard.press("ArrowRight");
  await ada.waitForTimeout(2200);
  check("one like is not a match yet", matchRows(code) === 0, `rows=${matchRows(code)}`);
  check("no takeover before the second like", (await takeover(bo)) === null);

  // 4. the second like is — the takeover is a React update after the swipe animation,
  // so wait for it rather than guessing a sleep.
  await bo.keyboard.press("ArrowRight");
  const panel = await waitTakeover(bo);
  check("the second like takes over the screen", !!panel, panel ? panel.label : "no takeover");
  check("the takeover covers the viewport", panel?.covers === true);
  check("its content stays in the 448 px column", (panel?.contentWidth ?? 999) <= 448, `${panel?.contentWidth}px`);
  check("it names the other member and the title", /Ada/.test(panel?.text || "") && /Session Fixture 1/.test(panel?.text || ""), panel?.text?.slice(0, 100));
  check("the match is one row in the database", matchRows(code) === 1, `rows=${matchRows(code)}`);
  await bo.screenshot({ path: path.join(SHOTS, "match-takeover-phone.png") });
  await bo.setViewportSize({ width: 1440, height: 900 });
  await bo.waitForTimeout(500);
  await bo.screenshot({ path: path.join(SHOTS, "match-takeover-desktop.png") });
  await bo.setViewportSize({ width: 390, height: 844 });
  await bo.waitForTimeout(400);

  // 5. Continue dismisses it and the deck is still behind
  await dismissTakeover(bo);
  check("Continue dismisses the takeover", (await takeover(bo)) === null);
  await waitDeck(bo);
  check("the deck is still mounted behind it", (await topTitle(bo)) !== null, String(await topTitle(bo)));

  // 6. the next match arrives on its own, and Escape dismisses it
  await ada.keyboard.press("ArrowRight");
  await ada.waitForTimeout(1800);
  await bo.keyboard.press("ArrowRight");
  const second = await waitTakeover(bo);
  check("the next match arrives after Continue", /Session Fixture 2/.test(second?.text || ""), second?.text?.slice(0, 80));
  await bo.keyboard.press("Escape");
  await bo.waitForSelector("[data-match-takeover]", { state: "detached", timeout: 8000 }).catch(() => {});
  check("Escape dismisses it", (await takeover(bo)) === null);

  // 7. a third match, dismissed so the fourth card stays reachable
  await ada.keyboard.press("ArrowRight");
  await ada.waitForTimeout(1800);
  await bo.keyboard.press("ArrowRight");
  const third = await waitTakeover(bo);
  check("a third match shows", /Session Fixture 3/.test(third?.text || ""), third?.text?.slice(0, 80));
  await dismissTakeover(bo);
  check("three matches in the database", matchRows(code) === 3, `rows=${matchRows(code)}`);

  // 8. a like the other member passed is not a match
  await ada.keyboard.press("ArrowRight");
  await ada.waitForTimeout(1800);
  await bo.keyboard.press("ArrowLeft");
  await bo.waitForTimeout(2200);
  check("a pass on a liked title is not a match", matchRows(code) === 3, `rows=${matchRows(code)}`);
  check("no takeover for a pass", (await takeover(bo)) === null);

  await ctxA.close();
  await ctxB.close();
  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? "e2e: all checks passed" : `e2e: ${failed.length} failed`} · shots in e2e/shots/`);
  process.exit(failed.length === 0 ? 0 : 1);
};

main().catch((error) => {
  console.error("e2e: failed to run —", error.message);
  process.exit(1);
});
