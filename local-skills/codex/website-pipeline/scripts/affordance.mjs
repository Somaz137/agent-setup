#!/usr/bin/env node
/**
 * affordance.mjs — G26: does the interface look operable, not just measure
 * as operable.
 *
 * WHY THIS EXISTS (2026-09-05, Stage 8 Verify)
 *
 * G8's contrast and focus checks measure the states a visitor is already in:
 * resting colour, and what shows once focused. Neither can observe the
 * signal that tells a pointer user an element is actionable BEFORE they act
 * on it. A build shipped with zero `cursor-pointer` declarations anywhere —
 * a utility-CSS reset that declares no `cursor` at all leaves every
 * `<button>` on the UA arrow while `<a href>` still gets a pointer — and a
 * hover state that was an 8/255 shift on a 1px border passed every gate
 * that already existed. Nothing was technically wrong: the button was
 * reachable, labelled, contrast-passing and focusable. It just looked inert.
 *
 * WHAT THIS CHECKS, ON COMPUTED STYLE, NEVER ON SOURCE
 *
 *  - every enabled <button> / [role=button] resolves to cursor: pointer
 *  - every disabled one (disabled attribute or aria-disabled="true")
 *    resolves to cursor: not-allowed
 *  - every enabled one shows a hover delta above a perceptual floor
 *    (default 15/255 on some channel of background-color or border-color),
 *    measured by a REAL .hover() and re-reading computed style afterwards —
 *    never by grepping for a `hover:` class, because a `hover:` class that
 *    compiles and does nothing is exactly the defect this gate exists to
 *    catch
 *  - measured in the THEME THAT ACTUALLY SHIPS (read from
 *    content/design.json, see SKILL.md "Variant system" L3), not whichever
 *    pack happens to be the dev default. The same class string can be a
 *    correct hover in one theme pack and sub-perceptual in another.
 *
 * NOT CHECKED: an element whose only interactivity is a JS click handler
 * with no button/role semantics. That never reflects in the rendered DOM as
 * anything queryable at runtime, so this gate cannot see it — give it
 * role="button" (which it needs for a11y anyway) and it is covered.
 *
 *   node scripts/affordance.mjs http://localhost:3000
 *   node scripts/affordance.mjs <url> --theme <pack-name> --routes /,/contact
 *   node scripts/affordance.mjs <url> --floor 15   # per-channel 0-255 delta
 *
 * Requires: npm i -D playwright && npx playwright install
 */

import { readFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const base = args.find((a) => /^https?:\/\//.test(a));
if (!base) {
  console.error('usage: node scripts/affordance.mjs <base-url> [--routes /,/a] [--theme name] [--floor 15]');
  process.exit(2);
}

const FLOOR = Number(flag('floor', '15'));
const origin = new URL(base).origin;

/** The theme that actually ships, not whatever the dev server defaults to. */
function shippedTheme() {
  const explicit = flag('theme');
  if (explicit) return explicit;
  for (const p of ['content/design.json', 'src/content/design.json']) {
    if (existsSync(p)) {
      try {
        const j = JSON.parse(readFileSync(p, 'utf8'));
        if (j.theme) return j.theme;
      } catch { /* fall through */ }
    }
  }
  return null;
}
const THEME = shippedTheme();

async function discoverRoutes() {
  const given = flag('routes');
  if (given) return given.split(',');
  try {
    const res = await fetch(`${origin}/sitemap.xml`);
    if (!res.ok) throw new Error(String(res.status));
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => {
      try { return new URL(m[1]).pathname; } catch { return m[1]; }
    });
    if (locs.length) return locs;
  } catch { /* fall through */ }
  console.warn('no sitemap.xml — falling back to "/". Pass --routes to widen.');
  return ['/'];
}

let playwright;
try {
  playwright = await import('playwright');
} catch {
  console.error('playwright is not installed in this project.');
  console.error('  npm i -D playwright && npx playwright install');
  process.exit(2);
}

const browser = await playwright.chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

// Force the shipped theme before any app script runs — the same moment the
// app's own theme picker would set data-theme on <html>. See SKILL.md's L1
// theme packs: overrides live under [data-theme='x'].
if (THEME) {
  await context.addInitScript((t) => {
    document.documentElement.setAttribute('data-theme', t);
  }, THEME);
}

const page = await context.newPage();
const routes = await discoverRoutes();

const rgb = (s) => {
  const m = s.match(/[\d.]+/g);
  return m ? m.slice(0, 3).map(Number) : null;
};
const maxChannelDelta = (a, b) => (a && b ? Math.max(...a.map((v, i) => Math.abs(v - b[i]))) : 0);

const details = [];
let checked = 0;

for (const route of routes) {
  await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts?.ready).catch(() => {});

  const targets = await page.$$('button, [role="button"]');
  for (const el of targets) {
    const visible = await el.isVisible().catch(() => false);
    if (!visible) continue;
    checked++;

    const label = await el
      .evaluate((n) => (n.getAttribute('aria-label') || n.textContent || '').trim().slice(0, 40))
      .catch(() => '');
    const isDisabled = await el.evaluate(
      (n) => n.disabled === true || n.getAttribute('aria-disabled') === 'true',
    );
    const cursor = await el.evaluate((n) => getComputedStyle(n).cursor);

    if (isDisabled) {
      if (cursor !== 'not-allowed') {
        details.push(`${route} "${label}" — disabled but cursor is "${cursor}", not not-allowed`);
      }
      continue;
    }

    if (cursor !== 'pointer') {
      details.push(`${route} "${label}" — enabled but cursor is "${cursor}", not pointer`);
      continue; // a dead cursor makes the hover check moot for this element
    }

    const before = await el.evaluate((n) => {
      const c = getComputedStyle(n);
      return { bg: c.backgroundColor, border: c.borderColor };
    });
    await el.hover({ force: true }).catch(() => {});
    const after = await el.evaluate((n) => {
      const c = getComputedStyle(n);
      return { bg: c.backgroundColor, border: c.borderColor };
    });
    await page.mouse.move(0, 0); // reset hover before the next element

    const bgDelta = maxChannelDelta(rgb(before.bg), rgb(after.bg));
    const borderDelta = maxChannelDelta(rgb(before.border), rgb(after.border));
    const delta = Math.max(bgDelta, borderDelta);
    if (delta < FLOOR) {
      details.push(
        `${route} "${label}" — hover delta ${delta.toFixed(0)}/255 ` +
        `(bg ${bgDelta.toFixed(0)}, border ${borderDelta.toFixed(0)}), floor is ${FLOOR}`,
      );
    }
  }
}

await browser.close();

const themeNote = THEME ? `theme=${THEME}` : 'theme=default (none declared in content/design.json)';
console.log(`\nG26 — affordance  (${base}, ${themeNote})\n`);
console.log(`${checked} interactive element(s) checked across ${routes.length} route(s)\n`);
for (const d of details) console.log(`  · ${d}`);
console.log(`\n${checked - details.length} ok · ${details.length} failed\n`);
if (details.length) {
  console.log('A hover: class that compiles is not a hover state that is visible. The delta');
  console.log('has to be checked in the theme that ships — the same class string can be a');
  console.log('correct hover in one theme pack and sub-perceptual in another.');
}
process.exit(details.length ? 1 : 0);
