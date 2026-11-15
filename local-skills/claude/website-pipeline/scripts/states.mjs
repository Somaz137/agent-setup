#!/usr/bin/env node
/**
 * states.mjs — the Stage 8 gate for states a visitor reaches by acting. G24.
 *
 * WHY THIS EXISTS
 *
 * Every other gate loads a URL and asserts against it. That is coverage of
 * exactly one state per route — the initial render — and reporting it as "the
 * page passes" quietly redefines the page as its first paint. On 2026-09-05 a
 * booking form made /contact 1020px wide against a 390px phone viewport and
 * scrolled the whole page sideways. A sweep of all 5 routes x 4 narrow widths
 * found zero overflow, and the visual-regression suite covering exactly those
 * combinations passed honestly: the defect was two clicks deep, and nothing in
 * the pipeline clicks. The same hole produced the "nothing looks clickable"
 * defect a day earlier — a gate measuring the resting state a visitor is
 * already in, never a state reached by acting.
 *
 * So this script's job is not to be a better assertion. It is to put the
 * product into its reachable states at all, and then assert something cheap in
 * every one of them.
 *
 *   node scripts/states.mjs http://localhost:3000
 *   node scripts/states.mjs <url> --widths 320,390 --flows tests/flows.mjs
 *   node scripts/states.mjs <url> --browsers chromium,webkit --shots out/
 *
 * WHY HORIZONTAL OVERFLOW IS THE FIRST INVARIANT
 *
 * It is one integer compared to another. No baseline image, no threshold, no
 * per-project tuning, no flake, and it needs no judgement to interpret. That
 * makes it cheap enough to assert in EVERY state, which is the property that
 * matters — a rich assertion in one state is worth less than a poor assertion
 * in all of them. Add invariants here only if they keep that property.
 *
 * NOTE ON WAITING: never use `networkidle` here. A dev server holds an HMR
 * websocket open for the life of the page, so the network is never idle and
 * the wait can only end by timing out — silently, with no output, blaming a
 * timeout rather than the cause. `domcontentloaded` plus the explicit settle
 * below is both stricter and deterministic.
 */

import { existsSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};

const BASE = args.find((a) => a.startsWith('http'));
if (!BASE) {
  console.error('usage: node scripts/states.mjs <base-url> [--widths 320,390] [--flows tests/flows.mjs]');
  console.error('       [--browsers chromium,firefox,webkit] [--shots <dir>] [--timeout 15000]');
  process.exit(2);
}

const WIDTHS = flag('widths', '320,390,768').split(',').map(Number);
const BROWSERS = flag('browsers', 'chromium').split(',');
const FLOWS_PATH = flag('flows', 'tests/flows.mjs');
const SHOTS = flag('shots');
const TIMEOUT = Number(flag('timeout', '15000'));

if (!existsSync(FLOWS_PATH)) {
  console.error(`no flows file at ${FLOWS_PATH}.`);
  console.error('This gate needs the project to declare its reachable states; it cannot');
  console.error('discover them. See the header of this file for the shape.');
  process.exit(2);
}

const { flows } = await import(pathToFileURL(resolve(FLOWS_PATH)).href);
if (!Array.isArray(flows) || flows.length === 0) {
  console.error(`${FLOWS_PATH} exports no flows.`);
  process.exit(2);
}

const playwright = await import('playwright');

/**
 * Deterministic settle. Mirrors the visual-regression spec: `load` is not
 * enough because `img.complete` is true before an AVIF is DECODED, and an
 * undecoded image paints at a different size.
 */
async function settle(page) {
  await page.evaluate(async () => {
    for (const img of document.querySelectorAll('img')) img.loading = 'eager';
    await Promise.all(
      [...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {})),
    );
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

/**
 * The invariant. Returns null when the state is clean, or a failure describing
 * the outermost elements that cross the viewport edge — outermost, because a
 * single overflowing container otherwise reports every descendant it contains
 * and buries the cause in its own consequences.
 */
const checkOverflow = () => {
  const vw = document.documentElement.clientWidth;
  const doc = document.documentElement.scrollWidth;
  if (doc <= vw) return null;
  const crosses = (el) => {
    const r = el.getBoundingClientRect();
    return r.right > vw + 1 || r.left < -1;
  };
  const offenders = [...document.querySelectorAll('body *')]
    .filter(crosses)
    .filter((el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (crosses(p)) return false;
      }
      return true;
    })
    .slice(0, 6)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return `<${el.tagName.toLowerCase()}> w=${Math.round(r.width)} right=${Math.round(r.right)} class="${(el.getAttribute('class') || '').slice(0, 80)}"`;
    });
  return { vw, doc, over: doc - vw, offenders };
};

const results = [];
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

for (const browserName of BROWSERS) {
  const engine = playwright[browserName];
  if (!engine) {
    console.error(`unknown browser "${browserName}"`);
    process.exit(2);
  }
  const browser = await engine.launch();
  for (const flow of flows) {
    const widths = flow.widths ?? WIDTHS;
    for (const width of widths) {
      const label = `${browserName} @${String(width).padStart(4)}  ${flow.name}`;
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.setDefaultTimeout(TIMEOUT);
      // Two attempts. A locator timeout against a cold server is flake; the
      // same flow failing twice is not. Retrying is cheaper than the judgement
      // call it replaces.
      //
      // There is deliberately NO "state absent, skipped" path here. The first
      // draft had one — "if the very first step finds nothing, the state must
      // not exist at this width" — and it immediately mislabelled a genuinely
      // broken flow as fine at every width, then mislabelled a flake as an
      // absence. A runner cannot tell "this state does not exist here" from
      // "this state is broken here", and guessing lands on the silent answer.
      // So the FLOW declares where it exists, via `widths`, and everything the
      // runner is asked to reach must be reachable or it fails.
      let outcome = null;
      for (let attempt = 1; attempt <= 2 && !outcome?.ok; attempt++) {
        let reached = -1;
        try {
          await page.goto(`${BASE}${flow.route}`, { waitUntil: 'domcontentloaded' });
          for (const [i, step] of flow.steps.entries()) {
            await step(page);
            reached = i;
          }
          await settle(page);
          const bad = await page.evaluate(checkOverflow);
          if (SHOTS) {
            const slug = `${browserName}-${flow.name.replace(/[^a-z0-9]+/gi, '-')}-${width}`;
            await page.screenshot({ path: `${SHOTS}/${slug}.png` });
          }
          outcome = { label, ok: !bad, detail: bad };
        } catch (err) {
          outcome = {
            label,
            ok: false,
            detail: {
              unreachable: true,
              step: reached + 2,
              of: flow.steps.length,
              attempts: attempt,
              message: err.message.split('\n')[0].slice(0, 90),
            },
          };
        }
      }
      results.push(outcome);
      await page.close();
    }
  }
  await browser.close();
}

console.log(`\nG24 — interacted states  (${BASE})\n`);
let failed = 0, skipped = 0, passed = 0;
for (const r of results) {
  if (r.ok === true) { passed++; console.log(`[  ok  ] ${r.label}`); }
  else if (r.ok === null) { skipped++; console.log(`[ skip ] ${r.label}  ${r.detail.message}`); }
  else if (r.detail.unreachable) {
    failed++;
    console.log(`[ FAIL ] ${r.label}`);
    console.log(`         state unreachable after ${r.detail.attempts} attempt(s): step ${r.detail.step} of ${r.detail.of} did not complete`);
    console.log(`           · ${r.detail.message}`);
    console.log('         Either the flow has rotted, or this state does not exist at this');
    console.log("         width — if the latter, narrow the flow's `widths` in the flows file.");
  }
  else {
    failed++;
    console.log(`[ FAIL ] ${r.label}`);
    console.log(`         page is ${r.detail.over}px wider than the ${r.detail.vw}px viewport (scrollWidth ${r.detail.doc})`);
    for (const o of r.detail.offenders) console.log(`           · ${o}`);
  }
}
console.log(`\n${passed} passed · ${failed} failed · ${skipped} skipped`);
if (failed > 0) {
  console.log('\nA horizontal scroller nested inside a grid or flex item is the usual cause:');
  console.log('the item keeps its default min-width:auto, so its track is sized to the');
  console.log("scroller's min-content and the scroller never gets to scroll. min-w-0 on");
  console.log('the item is the fix, not overflow-x:clip on an ancestor — that hides it.');
}
process.exit(failed > 0 ? 1 : 0);
