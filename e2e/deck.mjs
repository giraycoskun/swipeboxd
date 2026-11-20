#!/usr/bin/env node
/**
 * Deck interactions — the keys the guide prints, the hints they trigger, and the
 * spoiler mask. Separate from `contract.mjs` on purpose: that file asserts layout,
 * this one asserts behaviour, and they can fail for different reasons.
 *
 *   # a display-name server (PROVIDER=tmdb) or a library-backed one both work
 *   E2E_BASE_URL=http://127.0.0.1:3101 npm run e2e:deck
 *
 * Media comes from Playwright routes, so no provider is needed and no credential
 * file is read unless the server asks for a username/password form.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:3100";
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
  Id: `fixture-movie-${n}`,
  Name: `Fixture Movie ${n}`,
  ProductionYear: 2000 + n,
  CommunityRating: 7.4,
  Overview: `Fixture movie ${n} overview.`,
  UserData: { IsFavorite: false, Played: false },
});

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

function loadCredentials() {
  const file = process.env.E2E_CREDENTIALS || path.join(os.homedir(), "Server/etc/secrets/jellyfin.env");
  const env = {};
  if (!fs.existsSync(file)) throw new Error(`no credential file at ${file}`);
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const login = async (page, displayName = "Reviewer") => {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  const submit = page.locator("button[type=submit]");
  const name = page.locator('input[placeholder="Display name"]');
  const user = page.locator('input[placeholder="Username"]');
  await Promise.race([
    name.waitFor({ timeout: 30000 }).catch(() => {}),
    user.waitFor({ timeout: 30000 }).catch(() => {}),
  ]);
  if (!(await name.count())) {
    const credentials = loadCredentials();
    const pass = page.locator('input[placeholder="Password"]');
    for (let attempt = 0; attempt < 3; attempt++) {
      await user.fill(credentials.JELLYFIN_USER);
      await pass.fill(credentials.JELLYFIN_PASSWORD);
      await page.waitForTimeout(500);
      if ((await user.inputValue()) === credentials.JELLYFIN_USER && await submit.isEnabled()) break;
      await user.click();
      await user.pressSequentially(credentials.JELLYFIN_USER, { delay: 25 });
      await pass.click();
      await pass.pressSequentially(credentials.JELLYFIN_PASSWORD, { delay: 25 });
      await page.waitForTimeout(600);
      if (await submit.isEnabled()) break;
    }
    await submit.click();
    await page.waitForTimeout(12000);
    await waitDeck(page);
    return;
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    await name.click();
    await name.pressSequentially(displayName, { delay: 25 });
    await page.waitForTimeout(700);
    if (await submit.isEnabled()) break;
    await name.fill("");
  }
  await submit.click();
  await page.waitForTimeout(9000);
};

const waitDeck = async (page, timeout = 45000) => {
  await page.waitForFunction(() => {
    const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    return !!el?.closest('[data-slot="card"]');
  }, { timeout }).catch(() => {});
  await page.waitForTimeout(400);
};

const topTitle = (page) =>
  page.evaluate(() => {
    // Four cards stack back-to-front in the DOM; ask the screen which one is on top.
    const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    const card = el?.closest('[data-slot="card"]');
    return card?.querySelector("h2")?.textContent?.trim() ?? null;
  });

const main = async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  const items = [1, 2, 3, 4].map(movie);
  await page.route("**/api/media/items**", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify({ items, hasMore: false }) }));
  await page.route("**/api/media/item/**", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify(items[0]) }));
  await page.route("**/api/media/start-here**", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify({ startHere: { action: "start", label: "Start S1E1" }, hostOnly: false }) }));

  await login(page, "Deck Reviewer");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(SHOTS, "deck-keys.png") });

  const first = await topTitle(page);
  check("the deck renders a fixture card", first === "Fixture Movie 1", String(first));

  // 1. D likes, and the card actually leaves
  await page.keyboard.press("d");
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(SHOTS, "deck-hints.png") });
  await page.waitForTimeout(700);
  const afterD = await topTitle(page);
  check("D likes the top card", afterD !== first, `${first} → ${afterD}`);

  // 2. R rewinds it back
  await page.keyboard.press("r");
  await page.waitForTimeout(1800);
  const afterR = await topTitle(page);
  check("R undoes the last swipe", afterR === first, `${afterD} → ${afterR}`);

  // 3. A passes
  await page.keyboard.press("a");
  await page.waitForTimeout(1600);
  const afterA = await topTitle(page);
  check("A passes the top card", afterA !== afterR, `${afterR} → ${afterA}`);

  // 4. arrows still work (the shipped pair must not regress)
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1600);
  const afterArrow = await topTitle(page);
  check("ArrowRight still likes", afterArrow !== afterA, `${afterA} → ${afterArrow}`);

  // 5. F opens the filter drawer
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  await page.keyboard.press("f");
  await page.waitForTimeout(1500);
  const drawer = await page.evaluate(() => {
    const el = document.querySelector('[data-slot="drawer-content"]');
    return el ? getComputedStyle(el).pointerEvents !== "none" : false;
  });
  check("F opens the filter drawer", drawer);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1200);

  // 6. the hints appear on the first key press and expire on their own
  const hints = await page.evaluate(() => {
    const el = document.querySelector("[data-deck-hints]");
    return el ? { exists: true, opacity: getComputedStyle(el).opacity } : { exists: false, opacity: "0" };
  });
  check("the key hints appear after a key press", hints.exists && Number(hints.opacity) > 0.5, JSON.stringify(hints));
  await page.waitForTimeout(4600);
  const expired = await page.evaluate(() => {
    const el = document.querySelector("[data-deck-hints]");
    return el ? getComputedStyle(el).opacity : "0";
  });
  check("the hints fade again", Number(expired) < 0.5, expired);

  // 7. the spoiler mask — a fresh page so the episode fixture is the only card
  const episodeCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const ep = await episodeCtx.newPage();
  const episode = {
    Id: "fixture-episode-1",
    Kind: "episode",
    Name: "The One Where It Was Spoiled",
    SeriesName: "Fixture Show",
    SeasonNumber: 1,
    EpisodeNumber: 4,
    RunTimeTicks: 2700000000,
    Overview: "SECRET SPOILER: the butler did it.",
    ImageTags: { Primary: "episode-primary" },
    UserData: { IsFavorite: false, Played: false },
  };
  await ep.route("**/api/media/items**", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify({ items: [episode], hasMore: false }) }));
  await ep.route("**/api/media/item/**", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify(episode) }));
  await login(ep, "Spoiler Reviewer");
  await ep.waitForTimeout(2500);
  await ep.screenshot({ path: path.join(SHOTS, "spoiler-masked.png") });

  const masked = await ep.evaluate(() => {
    const card = document.querySelector('[data-slot="card"]');
    return {
      text: card?.innerText ?? "",
      images: card?.querySelectorAll("img").length ?? 0,
      reveal: Array.from(card?.querySelectorAll("button") ?? []).some((b) => /reveal/i.test(b.textContent ?? "")),
    };
  });
  check("a masked episode hides its title", !masked.text.includes(episode.Name), masked.text.replace(/\s+/g, " ").slice(0, 80));
  check("a masked episode hides its synopsis", !masked.text.includes("SECRET SPOILER"), masked.text.replace(/\s+/g, " ").slice(0, 80));
  check("a masked episode loads no still", masked.images === 0, `${masked.images} img`);
  check("the mask offers a reveal", masked.reveal);
  check("the mask still says which episode it is", /Fixture Show/.test(masked.text) && /S1E4/.test(masked.text), masked.text.replace(/\s+/g, " ").slice(0, 80));

  await ep.evaluate(() => {
    const card = document.querySelector('[data-slot="card"]');
    const button = Array.from(card?.querySelectorAll("button") ?? []).find((b) => /reveal/i.test(b.textContent ?? ""));
    button?.click();
  });
  await ep.waitForTimeout(800);
  await ep.screenshot({ path: path.join(SHOTS, "spoiler-revealed.png") });
  const revealed = await ep.evaluate(() => document.querySelector('[data-slot="card"]')?.innerText ?? "");
  check("revealing restores the title and synopsis",
    revealed.includes(episode.Name) && revealed.includes("SECRET SPOILER"),
    revealed.replace(/\s+/g, " ").slice(0, 80));

  await episodeCtx.close();

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? "e2e: all checks passed" : `e2e: ${failed.length} failed`} · shots in e2e/shots/`);
  process.exit(failed.length === 0 ? 0 : 1);
};

main().catch((error) => {
  console.error("e2e: failed to run —", error.message);
  process.exit(1);
});
