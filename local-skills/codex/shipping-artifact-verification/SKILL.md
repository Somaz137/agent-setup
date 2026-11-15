---
name: shipping-artifact-verification
description: >
  Verify the thing that actually ships, not the thing that is convenient to
  test. Use when a build passes / tests are green / Lighthouse is 100 but the
  deployed site, the browser-loaded bundle, or an interactive third-party
  component could still be broken. Covers post-deploy live-origin metadata
  checks (canonical URL, sitemap, robots, Open Graph), classic multi-script
  global-scope collisions, chrome-devtools viewport and load-time-animation
  gotchas, and headless-browser bisection for "the tool is broken vs our
  config is broken". Triggers on: "verify the deploy", "is it actually live",
  "check the shipped site", "canonical URL", "og:image wrong domain",
  "works in tests but not the browser", "the editor/widget is broken".
license: MIT
metadata:
  author: rimazasif130
  origin: task-observer weekly review 2026-09-03 (observations LPD-0001, LPD-0003, Gym-0004, LPD-0002)
  version: "1.0.0"
---

# Shipping-artifact verification

**Core principle:** a test that exercises the *convenient* load path (Node
`require`, a bundler that scopes each file, a build that exits 0, a
performance score against whatever domain is baked in) does not exercise the
path that *ships*. When the shipping path differs from the test path, verify
the shipping path directly. Everything below is one cheap check for one
class of defect that renders identically to a correct version and therefore
survives every screenshot, green build, and score.

Run the check that matches the situation. They are independent.

---

## 1. Post-deploy: canonical-URL metadata against the real domain

**When:** any deploy to a new or changed domain. A green build, 200s on every
route, rendered pages, working client JS, and Lighthouse 100s do **not**
verify this — Lighthouse scores 100 with the wrong domain baked in.

**Why it breaks:** frameworks resolve a "site URL" / "base URL" / "public
URL" from an env var that carries a **placeholder default**. The var is
**build-time** (`NEXT_PUBLIC_*`, `VITE_*`, `PUBLIC_*`, `GATSBY_*`, Hugo
`baseURL`, Astro `site`), so it must exist *at build*, not at runtime, and
nobody set it on the new host. Nothing errors; it just serves the wrong
value in files no human browsing the site ever looks at.

**Check — fetch from the LIVE origin, not the repo, not localhost:**

```bash
D=https://the-real-domain.example
curl -s $D/robots.txt
curl -s $D/sitemap.xml | head -20
curl -s $D/ | grep -Eio '<link[^>]+rel="canonical"[^>]*>|og:url[^>]*|og:image[^>]*|twitter:image[^>]*'
# plus any RSS/JSON feed the site publishes
```

**Pass criterion:** the real domain appears in every one of: `robots.txt`
(sitemap line + host), `sitemap.xml` (every `<loc>`), `<link rel="canonical">`,
`og:url`, `og:image`, `twitter:image`, feeds, and `hreflang` if present. A
placeholder domain or a previous host's domain in **any** of them is a
**failed deploy**, not a nitpick.

**Fix:** set the env var on the host and **rebuild** (a restart does not
re-read a build-time var). State in the completion report which commit /
branch / domain was verified.

---

## 2. Classic multi-script global-scope collisions

**When:** a page loads multiple JS files as plain `<script>` tags — no
bundler, no ES modules (CMS preview panels, admin widgets, legacy embeds,
dual-target CommonJS-or-browser files).

**Why it breaks:** under Node each file gets its own module-wrapper function
scope, so `require()` and the whole test suite pass. In the browser, classic
scripts share **one global lexical scope**, so a second file's top-level
`const money` / `let x` / `function f` / `class C` that collides with the
first throws `Identifier 'x' has already been declared` **at parse time** and
the entire file silently fails to load. Tests, `npm run build`, and config
linters all stay green.

**Check — concatenate in load order and `node --check`:**

```bash
cat tools/shared.js tools/images.js tools/card.js tools/preview.js > /tmp/concat.js
node --check /tmp/concat.js   # SyntaxError on duplicate top-level const/let/function/class
```

Wire it into CI next to the unit tests. It catches lexical redeclarations
(the ones that hard-fail a whole file), not runtime collisions (two files
both assigning `window.foo`) — for those, load the real page.

---

## 3. chrome-devtools MCP: viewport and load-time-animation gotchas

**When:** verifying a responsive layout or a page-load animation with the
chrome-devtools MCP.

**Viewport — use `emulate`, not `resize_page`:** `resize_page` is clamped by
the real browser window's minimum width (~500px on a typical machine, more
with a docked DevTools pane). Below that, `window.innerWidth` silently stays
at the minimum and your "390px phone" check runs at 502px with **no error**.

```
mcp__chrome-devtools__emulate  viewport: "390x844x3,mobile,touch"
```

applies a CDP device-metrics override that is not bound by OS window size.
**Re-navigate / reload once after `emulate`** so layout and JS width branches
pick up the new metrics, then **read back `window.innerWidth`** and assert it
equals the target before trusting the screenshot. Use `resize_page` only for
widths comfortably above the window minimum. Never leave test-only DOM
mutations (`scrollLeft` probes, injected styles) in place between assertions
— reload first.

**Load-time animations — attach the probe before navigation:**
`evaluate_script` runs after `load` + DOM-settle, by which time a sub-second
animation is already at its final value. Instead pass `navigate_page` an
`initScript` that installs a `requestAnimationFrame` sampler (poll for the
element, push `[performance.now(), el.scrollLeft]`) *before* page scripts
run, then read the trace afterward. Add `emulate cpuThrottlingRate: 6` to
stretch the easing curve. Clean result = monotonic from start to target with
no reversal; a reversal is "jump then re-scroll" jitter.

---

## 4. Headless bisection: "the tool is broken" vs "our config is broken"

**When:** a hosted or interactive third-party component (CMS editor, embedded
widget, SaaS UI) misbehaves — especially a **silent, error-free**
misbehaviour (a typed value vanishes, a control does nothing, no console
error).

**Do this before touching your own integration code.** Reproduce in a
headless browser (chrome-devtools MCP / Playwright) against the tool's
built-in test / offline backend:

1. Full config, all custom code → reproduce.
2. **Minimal config, zero custom code** → still fails? It is upstream. Stop
   debugging your code, pin around it, file the bug.
3. Older version of the dependency → works? Confirms an upstream regression;
   pin to the last good version (see the `cms-migration` skill for choosing
   which).

This bisection (full → minimal, current → older) is **step 1, not step 5**.
Incremental hardening of your own code around an upstream bug is the slow
path to the same answer.

---

## Reporting

Whatever check ran, the completion note states: what was verified, against
what (domain / commit / version), and the pass/fail per item. "Build passed"
is never the verification — it is the thing the verification exists to
distrust.
