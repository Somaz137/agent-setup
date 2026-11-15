---
name: website-pipeline
description: End-to-end pipeline for building local-business websites — demo sites for cold outreach and paid client sites. Covers discovery, research, IA, design direction selection, content, build, verification, accessibility, security review, SEO, deploy and handoff, with an executable gate at every stage. Use when the user asks to build, plan, design or ship a website, landing page, demo site, outreach sample, or a client site for a gym, boutique, clinic, salon, restaurant, retail or similar local business.
---

# Website Pipeline

One pipeline. Two modes. Every stage ends in a gate that either passes or blocks.

**This pipeline exists because the same defects kept recurring.** Every gate below
traces to a specific failure that already happened, not to a general principle.
Do not skip a gate because the work "looks fine" — looking fine is what every one
of those defects did.

## Step 0 — Before anything else

1. **Read `Website Making Plan/99 Logs/Build Mistakes And Fixes.md`.** Every run
   reads it before starting. If an entry's *Revisit* condition is now met, act on
   it before proceeding.
2. **Declare the mode** and say it out loud to the user:
   - `demo` — fictional or prospect brand, cold outreach, no paying client
   - `client` — a real paying client
   - `cms: on|off` — on for catalog / self-editing clients (see CMS below)
3. **Long build ahead?** Run `$impeccable hooks off`. Its `Stop` deep pass
   rescans *every UI file touched this session* on every turn end, so cost grows
   as the session runs. Turn it back on for the polish pass (Stage 8).

## Stack — locked, do not re-litigate per project

Next.js 16 (LTS, **EOL 2027-10-21**) · React 19 · TypeScript · Tailwind v4 ·
shadcn/ui on **Base UI** · Netlify.

- **Base UI, not Radix.** shadcn's default since July 2026; Base UI ships
  monthly with a full-time team, Radix slowed after the Modulz/WorkOS
  acquisition. Radix is not deprecated — but do not mix both (G22).
- **Content is JSON, never `.ts`.** `content/*.json` + a typed loader using
  `resolveJsonModule`. A CMS can read JSON/YAML/MD; it cannot read TypeScript.
  This single choice is what makes client self-editing possible.
- Third-party blocks: Magic UI (MIT, free commercial) and Aceternity (free core,
  **paid all-access tier** — check the licence before shipping to a client).
- **Before Oct 2027:** run the Next 17 migration review.

Out of scope: full-app builds with auth/database (the PeerVoting archetype).
Different tier, different pipeline.

## Stages

| # | Stage | Demo | Client | Gate |
|---|---|---|---|---|
| 1 | Intake | 40-line brand card, invented + `ui-ux-pro-max:brand` identity and `ui-ux-pro-max:design` logo | **Read the Best Practices "Website Brief"** in Notion Lead Research first, then `design-brief` + `grilling` + `08 Templates/Client Intake Form.md` to fill gaps | G21 (client) |
| 2 | Research | 3 reference fetches, section inventory | **Only what the Website Brief lacks.** It already carries industry best practice, 2–3 reference examples, page structure and a tech recommendation — do not redo it | — |
| 3 | IA | template IA for the vertical | `information-architecture` + `content-strategy` | G21 (client) |
| 4 | Spec + plan | ≤120 lines, one doc | full spec + plan | G1, G2 |
| 5 | Content | invented data files | `copywriting` + `seo-content-brief`, real photos | — |
| 6 | Direction | 3 directions seeded from `ui-ux-pro-max` search, you pick | same, client picks and signs off | **G5**, G25 |
| 7 | Build | serial: one subagent per page | same | G3, G4, G17 |
| 8 | Verify | one consolidated pass | same | G6–G11, G13, G24, G26, G27 |
| 9 | Security | headers + `npm audit` | + `/security-review`, spam protection, secret scan | G12 |
| 10 | SEO | one Lighthouse | full suite + drift baseline | G19 |
| 11 | Deploy | throwaway subdomain | real domain + DNS | G14, G15 |
| 12 | Ship | merge | merge + handoff | G16, G18 |
| 13 | Retro | `close-run.mjs --sync` | `close-run.mjs --sync` | **G23** |
| 14 | Field check | — | 28 days post-launch | G20 (client) |

**Content (5) comes before Direction (6).** Previews render real headlines,
prices and photos — never lorem. A direction chosen against placeholder text is
chosen against the wrong thing.

## Choosing the look before building it

**Seed the three directions first.** Before drawing anything, run
`ui-ux-pro-max` search for the vertical and pull a *different* style, palette
and font pairing for each of the three. Three directions drawn from one
designer's default instincts are three variations of the same direction, and a
client picking between near-identical comps has not been given a choice. Record
the three seeds in the spec so the comps can be traced back to them.

**No variant library yet, or a new direction is wanted:** use the `design` skill.
Three whole-home-page comps as `.dc.html` artboards on one canvas, published as
an Artifact to compare. HTML/CSS only — no React, no build, cheap.

**Library exists (project 2+):** a `/preview` route renders every registered
variant against this project's real content, in two views:
- *Directions* — 3 complete home compositions (theme × section variants)
- *Sections* — every variant of one section, for swapping individually

Nothing here is throwaway: these are the shipping components. The choice writes
`content/design.json`.

**The library compounds.** Project 1 yields one variant per section. Project 2
adds a second only where nothing fits. By project four, selection is nearly free
— that is what makes "show me the options first" sustainable.

## Variant system

**L1 — Theme packs.** Define themable vars with plain `@theme` (values are
embedded as global vars and *can* be overridden later), then override under
`@layer base { [data-theme='x'] { --color-accent: … } }`.
**Do not use `@theme inline` for this** — with `inline` the variable does not
exist globally and you must supply the override yourself.

**L2 — Section variants.** Two or more implementations behind one registry:

```
src/components/sections/hero/
  types.ts            # the props contract EVERY hero variant accepts
  index.ts            # { "full-bleed": HeroFullBleed, "split": HeroSplit }
  hero-full-bleed.tsx
  hero-split.tsx
```

Start with 2 variants each for **hero, pricing, showcase, CTA** — not everywhere.

**L3 — Composition.** `content/design.json` names the theme, the sections and
their order. Pages become `renderSections(design.home)`.

**The load-bearing rule:** every variant of a section accepts *identical* props.
A field only one variant needs goes into the shared contract as optional — never
as a variant-specific prop, or switching variants breaks the data. Type the
registry `Record<string, ComponentType<HeroProps>>` and `tsc` enforces it free.

**Before editing a section component, enumerate its mount sites.** `grep` the component name
across `app/` and state what the change does at *each* route that mounts it. A section reused
across routes has as many contracts as it has mount sites, and an edit motivated by one of them
is an unreviewed change to all the others: a CTA block swapped for a maps link — correct for the
home page, where a band one section below still carried every phone number — shipped the
branch-listing route, whose entire purpose is ringing a branch, with no way to call anyone. The
composition, not the component, is what differs per route, so where routes genuinely need to
differ the difference belongs in the shared props contract as an optional field — the rule G17
already enforces — **never as an edit to the component body.** No gate catches this class: G24,
G26 and axe all assert properties of what is present, and this defect is an *absence*. The page
is perfectly valid without the thing it needs.

**An element rendered empty is still doing structural work** — heading level, landmark, the
space it occupies. Removing it is a document-structure change, not a visual tidy-up: the same
edit left a page running h1 → h3, invisible on screen and real for anyone navigating by
headings, and dropped the intro's descenders onto the next card's rule. Re-run the
heading-order probe and re-shoot the route after any such removal.

**L4** — a genuinely different design *language* — is not a config switch. That
is `impeccable`'s new-work flow choosing a new visual world: re-run the pipeline.

## Where ui-ux-pro-max fits — and where it must not

`ui-ux-pro-max` is a **reference database and asset generator**, not a second
opinion on craft. It supplies raw material *before* a surface exists. Once code
is being written, `impeccable` is the sole authority on styling and quality —
two skills issuing styling opinions over the same file produce revert commits,
which is the failure G9 already exists to stop.

**Name collision — read this before Stage 6.** Two different skills are called
`design`:

| Written as | Is | Used at |
|---|---|---|
| `design` (bare) | Codex Design canvas — `.dc.html` artboards, published as an Artifact | Stage 6 comps |
| `ui-ux-pro-max:design` | logo, icon, banner, social image, CIP generator | Stage 1, Stage 12 |

Always write the plugin-qualified name. A bare `design` at Stage 1 draws
artboards instead of a logo and the run silently goes sideways.

**Where it earns its place:**

| Stage | Sub-skill | What it supplies |
|---|---|---|
| 1 Intake (demo) | `ui-ux-pro-max:brand` | Voice, identity and messaging for an invented brand. Demo mode has to invent one and had no method — the brand card was 40 lines of guesswork |
| 1 Intake (demo) | `ui-ux-pro-max:design` | The logo itself. Needs `GEMINI_API_KEY`; see Setup below. A demo with no mark reads as a template, which is exactly what cold outreach must not do |
| 6 Direction | `ui-ux-pro-max` | Style, palette and font-pairing search — 84 / 192 / 74 entries. One distinct seed per direction (see Stage 6) |
| 6→7 L1 themes | `ui-ux-pro-max:design-system` | Primitive → semantic → component token architecture, spacing and type scales. Feeds the `@theme` pack directly |
| 12 Ship (demo) | `ui-ux-pro-max:banner-design` | OG image and the Notion Portfolio Demos card. That write-up is the artefact a lead actually sees |

**Where it must not go:**

- **Stage 7 build.** `ui-ux-pro-max:ui-styling` covers shadcn/Tailwind, which is
  the locked stack — but the variant system (L2) owns component structure and
  `impeccable` owns craft. A third voice here contradicts G17's single props
  contract.
- **Stage 8 verify.** `impeccable` owns the polish pass. Nothing else runs there.
- **Client brand work without asking.** A paying client usually arrives with a
  logo and palette already. Generating a new identity over the top is scope
  creep, not service. Demo mode invents; client mode reads the Website Brief.

**Setup — only the generative half needs a key.** `ui-ux-pro-max:design` shells
out to Gemini for logo, icon and CIP output. Without it that one sub-skill is
inert; the other six (search, brand, design-system, ui-styling, banner-design,
slides) work regardless.

Set up on this machine 2026-09-05:

- `GEMINI_API_KEY` is set at Windows **User** scope. `setx` is not on PATH here —
  use `[Environment]::SetEnvironmentVariable("GEMINI_API_KEY","...","User")`.
  A new value needs a Codex restart; the session inherits its env at launch.
- `google-genai` 2.22.0 and `pillow` 12.3.0 installed to Python 3.13 at
  `AppData/Local/Programs/Python/Python313`.

**The key is valid. The obstacle was broken IPv6, and it is solved.** Diagnosed
2026-09-05. The router advertises IPv6 and Windows prefers it, but this ISP's
IPv6 route to Google does not work: connections stall ~10s and mostly fail.
IPv4 to the identical host is instant. Measured on the same request:

| Resolution | Success | Speed |
|---|---|---|
| Default (IPv6 first) | 4/10 | 6.7 s/req |
| IPv4 only | **10/10** | **0.6 s/req** |

**Fix — per process, no admin, no reboot, nothing else on the machine changed.**
Put the shim directory on `PYTHONPATH` and Python loads it automatically at
startup:

```
set PYTHONPATH=C:/Users/User/.Codex/scripts/ipv4only
python <ui-ux-pro-max design script>
```

Run any `ui-ux-pro-max:design` generation script (logo, icon, CIP) that way.
`~/.Codex/scripts/check-gemini-key.py` has the same patch inlined and needs no
PYTHONPATH — run it first to confirm the key still works.

**Do not diagnose this as an auth problem.** `SSLEOFError`,
`RemoteDisconnected`, `TimeoutError`, and httpx's `Cannot send a request, as the
client has been closed` are all the IPv6 stall. Only an HTTP status *from the
server* says anything about the key. A bare TLS handshake is not a reachability
test either — handshakes succeeded while real requests were failing.

A machine-wide alternative exists (`DisabledComponents = 0x20`, prefer IPv4)
and would speed up everything else on this box too, but it needs admin plus a
reboot. The shim is preferred: same result for this pipeline, zero blast radius.

## Gates

Run `node scripts/gates.mjs` for the mechanical ones. The rest are listed with
their check.

**Report the denominator, never the results alone.** There are 27 gates below and 14 stages
above; `gates.mjs` implements six of them (G1, G6, G13, G15, G16, G22) and its summary line
counts only those six. So every status report — each interim one and the close-out — states
**gates run / gates defined** and *names the ones that did not run*, and says the same for
skipped stages. A gate with no runner shipped is reported `NOT RUN`, never omitted: G8 named
`axe` and had its dependency installed, which was enough to make it feel covered while no
runner had ever been written and `docs/lighthouse.md` did not exist. "Every gate I ran passed"
and "every gate passed" are the same sentence once the denominator is missing — and the person
least able to tell them apart is the one who built the report, because he sees the checks he
ran, not the ones he never reached for. Derive the unrun set from this table and the stage
table, not from memory of the run.

| # | Gate | Check |
|---|---|---|
| G1 | Doc integrity | After any spec/plan edit, grep the old literal → zero hits, and check every occurrence of the new one |
| G2 | Criteria executable | Every Success Criteria line names a command, or is struck. A criterion nobody can run is a wish |
| G3 | Plan write-back | When execution deviates, edit the plan **in the same commit**. A fix applied only to the code has a lifetime of one run |
| G4 | Design system frozen | Record the commit hash after Stage 6; at the end `git diff <hash> -- primitives + tokens` is empty or explained |
| G5 | Direction selected | 3 directions on real content, shot at 390+1280, presented; choice written to `content/design.json` before any further page is built |
| G6 | Content-driven | No user-visible string, fixed `grid-cols-N` over a collection, literal collection index, or hand-derived value in components. The heuristics are deliberately over-sensitive — that is what finds real leaks — so false positives are suppressed per project in `.gates-allow.json`, never by softening the check. Each entry needs a `reason` of 15+ characters or it is ignored *and reported as ignored*; the suppressed count always prints alongside the result; and matching strips the `:LINE` so an edit above a suppressed finding cannot silently un-suppress it. An escape hatch that costs nothing, or that rots on the next edit, becomes the new silence |
| G7 | Shape test | Rebuild with halved **and** empty collections. Real clients do not have exactly 6 programs and 3 plans |
| G8 | Machine audit | Lighthouse + `@axe-core/playwright` (WCAG 2.2), scores → `docs/lighthouse.md`. Claims **"no automated violations", never "accessible"** — axe covers ~30–50% of WCAG, so the manual keyboard pass stays required. **Alpha modifiers are a known source of violations this gate catches and craft review cannot.** A pair measured at design time is only safe at the value measured: a `/90` or `opacity-90` over text on a surface measured at 4.98:1 lands under 4.5, and the difference is invisible to any number of rounds of looking — four found nothing; axe called both *serious*. So record each pair's measured ratio **and its margin** in the token comment, because the margin is what tells a later reader whether the value can absorb a change; where a pair clears the floor by less than ~1.0 say so, and state that secondary text on that surface comes from a separately measured token, never from a modifier. Grep the diff for opacity/alpha utilities on text classes (a `/NN` suffix, `opacity-NN`) and treat each as a re-measurement trigger rather than a styling choice, then re-run this gate — not only at the end |
| G9 | One verify pass | A single ordered pass, not separate a11y/perf/SEO/design rounds. Separate rounds contradict each other and produce revert commits |
| G10 | Cross-browser | Playwright chromium + firefox + webkit × 3 widths |
| G11 | Visual regression | `toHaveScreenshot()`, `animations:'disabled'`, dynamic content masked, per-component thresholds, **full-page captures**, baselines committed to Git. **Corrected 2026-09-19: this row read `component-level not full-page` while the spec `shots.mjs --scaffold` generates has captured `fullPage: true` since the settle step was written — and the settle step exists *because* the capture is full-page. The script held the live decision; the prose was the stale copy. Thresholds are still tuned per assertion; the capture is whole-page.** **Baselines are generated and compared on one machine (the Windows dev box) — decided, not open.** Font rendering differs per OS, so a Linux CI runner would fail every test with nothing broken. Revisit only if someone else joins the work or builds move to the cloud. Column-count masonry cannot be made deterministic for this comparator — a `fullPage` capture triggers lazy-loading progressively as it scrolls to stitch, so a masonry section never settles the same way twice. Use a row-spanning grid for masonry-style sections instead; `--scaffold`'s settle step (flip to eager, `decode()`, `document.fonts.ready`, two animation frames) fixes lazy-loading everywhere else but cannot fix a layout that reflows during capture |
| G12 | Security | Headers live, **CSP verified with zero console violations after hydration**, `npm audit`, `/security-review`, no secrets committed, plus the **served-output check** in the Security baseline below — an audit of what a page renders does not bound what it discloses |
| G13 | Deliverables | Every doc the plan promised actually exists |
| G14 | Live origin | Fetch robots.txt, sitemap.xml and each route's canonical/OG from the **real public URL**. A green build and 200s are not a verified deploy |
| G15 | Docs consistent | Grep README/docs for stale host, version, brand |
| G16 | Shipped | Merged to `main`, build branch deleted |
| G17 | Variant contract | Every variant satisfies one props type — `tsc` via the typed registry |
| G18 | Library updated | New variants registered, added to `/preview`, screenshot committed |
| G19 | Schema + NAP | Correct `LocalBusiness` subtype (Thing→Organization→LocalBusiness→HealthClub/Store/Dentist…); name, address, phone, hours match the Google Business Profile **exactly** |
| G20 | Field data (client) | 28 days post-launch, CrUX via `seo-google`: LCP < 2.5s, INP < 200ms, CLS < 0.1 at p75. Lighthouse is lab; Google grades field |
| G21 | Discovery signed off (client) | Written brief **and** sitemap/IA approved in writing before design starts. Most scope creep and client disputes originate here |
| G22 | Dependency hygiene | One headless UI library per project; every third-party block's licence recorded and commercial-safe; no unused deps |
| G23 | Retrospective closed | Build log read at start, written at end; third-occurrence issues converted to a gate or script. **Enforced by `node scripts/close-run.mjs --sync`, which must exit 0 before the run is finished** |
| G24 | Interacted states | `states.mjs` puts the site into every state the project declares in `tests/flows.mjs` — a form past step 1, an open menu, a dialog — at narrow widths, and asserts `scrollWidth <= clientWidth` in each. **Every other gate loads a page and never uses it**, so the whole interactive surface was uncovered until this existed; two shipped defects escaped through it |
| G25 | Directions are distinct | The three Stage 6 comps trace to three *different* `ui-ux-pro-max` seeds — style, palette and font pairing, each recorded in the spec. Three comps from one instinct is one direction shown three times, and the client's "choice" is theatre |
| G26 | Affordance | `affordance.mjs` asserts computed style, not source: every enabled `<button>`/`[role=button]` resolves to `cursor:pointer` and every disabled one to `cursor:not-allowed`; every enabled one shows a hover delta ≥15/255 on some channel after a real `.hover()`, measured **in the theme that ships** (read from `content/design.json`), not the default pack. G8's contrast and focus checks only measure the resting and focused states — neither can see whether an element *looks* actionable before it is acted on. A build shipped with zero `cursor-pointer` anywhere (a utility-CSS reset that declares no `cursor` at all leaves `<button>` on the UA arrow while `<a href>` keeps a pointer) and an 8/255 hover shift on a 1px border passed every existing gate, because nothing was technically wrong. Whenever a CSS reset is replaced or upgraded, diff its preflight for removed `cursor`, `outline` and `appearance` declarations — the absence never shows up in a source diff, only at runtime |
| G27 | Primary actions reachable | Take the short list of primary actions the project declares — call the branch, open the menu, book — and assert each is reachable within N interactions **at every swept width**, not merely that the layout holds. A responsive visibility utility is the one change that makes a defect *less* detectable the more severe it is: `hidden sm:inline-flex` on a header call button hides it below 640px, which is every phone in ordinary use, so a business taking its orders by telephone shipped a header with no way to call on the device nearly every visitor holds. Hiding a control removes it from the population every other gate samples rather than failing any of them — G26 enumerates *visible* controls, G24 checks overflow, axe reads the rendered DOM, and a hidden control is simply not in any of their sets. Only a check driven by a declared list of what must be reachable, evaluated per device class, can see it. "Primary device" is a property of the audience, not of the developer's screen; the widest viewport is the one least like the visitor's. **No runner ships for this yet** — until one does report it `NOT RUN` rather than omitting it (see the denominator rule above); its natural home is `states.mjs`, which already reads the per-project `tests/flows.mjs` where the required actions would be declared |

**Why G19 earns its cost:** clean schema correlates with ~2.7× local-pack
appearance and ~3.2× AI-Overview citation, and ~73% of audited local businesses
have none. In a local market that is both a ranking edge and a sales argument.

## Security baseline

Every site ships headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
Referrer-Policy, Permissions-Policy, plus a three-tier cache policy.

Use `little-princess-designer2/netlify.toml` as a **model, not a copy**. That
policy is `script-src 'self'` with no `'unsafe-inline'` — correct for
hand-rolled static HTML, but **Next.js injects inline hydration scripts and it
will break the app**. Write a Next-appropriate policy and confirm zero CSP
violations in the console *after hydration*.

**Grep the served HTML, not the source — "not rendered" is not "not shipped".** A component's
props are a transport boundary, not a rendering boundary. A client component (`'use client'`)
handed a whole object as a prop serializes *that whole object* into the RSC flight payload
embedded in the HTML, not the fields it reads; the same holds for `getStaticProps` /
`getServerSideProps` payloads, Nuxt payloads, Astro island props and any hydration state. A
build shipped the content files' working notes — an unresolved phone number, a "this is wrong
and must be corrected" note — into View Source on the home page with every gate green, because
nothing rendered them and no gate asked a question about the served bytes. So add a
served-output check distinct from the rendered-output ones: fetch each route's HTML from the
built output and grep it for the content files' field names and known internal phrases,
asserting zero hits. Then fix the boundary rather than the authoring habit — **notes belong
beside the data they qualify**, since a note three files away is a note nobody reads, so mark
internal fields (a `_` prefix works) and have the typed content loader strip them at the
boundary. An internal field that cannot reach a component at all beats relying on no component
rendering it.

`next.config.ts` `headers()` is unsupported under `output: export`. Use
`netlify.toml` for a server build, `public/_headers` for a static one.

## CMS (opt-in)

Sveltia CMS at `/admin/`, commits to `content/`, Netlify rebuilds.

**Known risk — tell the client before promising it.** Sveltia is pre-1.0
(v1.0 expected late 2026), single-maintainer, and its docs are self-flagged as
incomplete. Netlify Identity and Git Gateway are deprecated and Sveltia's
replacements are targeted *at* v1.0. **Today every editor needs a GitHub
account** — real friction for a non-technical shop owner.

Decide and record in `handoff.md`: GitHub OAuth (default) · Cloudflare
`sveltia-cms-auth` worker · defer the CMS until v1.0.

## Execution rules

- **Serial on Windows — but still delegate.** No *parallel* page-building
  subagents: they contend on `.next`, the dev-server port and the git index
  even with disjoint source files. That is a ban on parallelism, not on
  delegation — dispatch each page's build (Stage 7) and the verify/polish
  pass (Stage 8) to **one subagent at a time**: spawn it, let it finish,
  read only its summary, then spawn the next. Measured across four builds
  on this pipeline: the one that delegated per-page (one subagent per
  page: Home, Programs, Schedule, Membership, Contact) kept 64% of its
  tokens out of the main thread and finished for 456M total; a
  comparable-scope build done entirely in the main thread cost 729M — 60%
  more — because every file a subagent would have read and discarded
  instead stayed in context and was re-sent on every remaining turn of the
  build. Building pages directly in the main thread is the expensive
  default here, not a shortcut, and it gets worse the longer the build
  runs.
- **Search before reading.** `Grep`/`Glob` for the specific symbol, section
  or failing line before `Read`-ing a whole file. A file opened whole
  stays in context for every remaining turn of the build, not just the
  turn that opened it — so the cost of reading it wrong compounds with
  however much build is left. Applies most at Stage 2 (Research — pull the
  one section of a reference page's markup you need, not the whole
  fetch), Stage 7 (Build — locate where a token, variant or section
  registry entry is defined before opening the file that defines it) and
  Stage 8 (Verify — find the one failing assertion in a gates/Lighthouse
  report instead of reading the whole report). Skip it only when the
  whole file is genuinely needed next (a component about to be rewritten
  end to end).
- **Match review effort to the defect class.** Presentational work → controller
  diff spot-checks plus one consolidated review. Logic, shared state, data
  integrity or security → a dedicated reviewer and a fix loop.
- **Commit per task**, conventional messages.
- **Per-task baseline:** `npx tsc --noEmit` and `npm run lint` clean.

## Automation

Seven scripts in `scripts/`, copied from this skill into each project. Improving
one improves every future build.

| Script | Use |
|---|---|
| `gates.mjs` | Six mechanical gates — G1, G6, G13, G15, G16, G22 — as one pass/fail table; not the whole gate set, so report its summary against the denominator above. Replaces ~10–15 tool calls per verify pass |
| `shots.mjs` | All routes × 3 widths × 3 browsers, animations disabled, masked. Drives G10/G11 |
| `states.mjs` | Every *interacted* state × narrow widths, asserting no horizontal overflow. Needs a per-project `tests/flows.mjs` declaring the states — it cannot discover them. Drives G24 |
| `affordance.mjs` | Every enabled/disabled button and `[role=button]`, across discovered routes, in the theme that ships: computed `cursor`, and a real-`.hover()` computed-style delta. Drives G26 |
| `shape-test.mjs` | Rebuilds against halved **and** emptied collections, then restores the real content — backed up to `.shape-backup/` and restored even on failure or Ctrl-C. Stop any dev/prod server first: Windows holds `.next` open and the rebuild fails with EPERM. Drives G7 |
| `verify-deploy.mjs <url>` | Live-origin robots/sitemap/canonical/OG assertions. Drives G14 |
| `close-run.mjs` | Refuses to close a run with no dated retro entry, carries improved scripts back to this skill with `--sync`, and applies three-strikes. Drives G23 |

**Prose and script are two copies of one decision, and they drift.** Each copy stays
internally coherent, so nothing surfaces the disagreement and a reader gets whichever one he
opened; an agent gets the prose, then runs the script, and produces output the prose calls
wrong. Two mechanical checks, run whenever this skill is edited and again at `--sync` time:
(1) every file in `scripts/` has a row in the table above and every row has a file — this
section said "three scripts" over a table of seven, and before that listed five over a
directory of six; (2) every gate row naming a concrete flag, threshold or mode is grepped in
the script that implements it — G11 said `component-level not full-page` over a script that
had been capturing `fullPage: true` since the settle step was written. **Surface the
disagreement; do not reword the prose to match the code.** Which copy is stale is a question
about intent that neither copy can answer: decide it, then record which one was wrong, so the
next reader knows which decision was live.

**Not scripted, deliberately:** design direction, variant selection, copy, IA,
`/security-review`, `impeccable` passes, `ui-ux-pro-max` seed selection, the CMS
auth decision. That is judgment
work where reading the output *is* the work. Nothing that runs once ever, either
— a single-use script costs more than it saves.

## Retrospective — how issues get closed permanently

At the end of every run, append to
`Website Making Plan/99 Logs/Build Mistakes And Fixes.md` in the vault's
established format:

```
## YYYY-MM-DD — short title
**Observed:** what happened, specific enough to understand months later
**Change:** the concrete change made
**Applies to:** which stage, gate, script or file
**Revisit:** the condition or date that reopens this
```

**The three-strikes rule.** A recurring issue is a *missing gate*, not something
to remember harder. On an issue's **third** logged occurrence it must become a
gate or a script before the run closes — a log entry alone stops counting as a
resolution.

**Closing the run is a command, not an intention.** A retro that depends on
remembering to write one gets skipped on exactly the run that most needed it.
So the last action of every build is:

```
node scripts/close-run.mjs --sync
```

It exits non-zero — the run is NOT finished — unless:

- an entry dated **today** exists in `Build Mistakes And Fixes.md`,
- every entry carries all four fields (Observed / Change / Applies to / Revisit),
- the vendored scripts in `scripts/` match this skill's copies (`--sync` copies
  improvements back, so the next build inherits them instead of rediscovering
  the same defect),
- the required deliverables exist,

and it warns when one artefact has accumulated three or more entries, which is
the three-strikes signal.

It deliberately does **not** write the retro for you. Deciding what actually
went wrong is judgment; a script that invented entries would produce a log
nobody trusts. Its whole job is to make skipping the retro impossible to do
silently.

**If the run genuinely surfaced nothing,** write that as one dated entry and say
why. "Nothing went wrong" is a finding worth dating — and an empty log after a
long build is far more suspicious than a boring one.

## Where this sits in the lead-generation system

This pipeline is the build half of the vault at `Desktop/Website Making Plan/`.
The two halves are deliberately separate and must not reach into each other.

```
Lead Finder → Notion Leads Master → Outreach → Somaz sends
                                                    │
                                    Best Practices → "Website Brief"
                                                    │
                                    THIS PIPELINE (client mode)
                                                    │
                                          live site + handoff
```

- **Logs are split by domain.** This pipeline owns
  `99 Logs/Build Mistakes And Fixes.md` — reads it at Step 0, writes it at
  Stage 13. It never touches `99 Logs/Mistakes And Fixes.md`, which belongs to
  the Retro & Learning agent (lead generation). That agent likewise never edits
  the build log.
- **Cadence differs.** Build lessons are resolved *inside the run that found
  them*, because they become gates or checks in this skill. Lead-gen lessons
  wait for the Sunday retro, because they change targeting and pricing.
- **Do not redo Best Practices' work.** Its Website Brief already carries
  industry best practice, reference examples, page structure and a tech
  recommendation. Read it; fill gaps only.
- **Static-vs-CMS has one owner.** Best Practices *recommends*; this pipeline's
  CMS step *decides* (weighing the Sveltia pre-1.0 and GitHub-account risk) and
  records the answer in `handoff.md`. Never restate it in a third place.
- **Demo mode ships to two places.** Deployable source stays in the vault under
  `11 Portfolio Demos/<name>-demo/`; the shareable one-page write-up (description
  + screenshots) goes to the Notion Portfolio Demos database, one page per demo
  so a lead can be sent that link on its own.
- **Blocked on a missing tool?** That is the documented trigger to unpark
  Agent 3 (Skills & Repo Scout). A genuine build blocker is the only reason to
  add tooling — not a hunch that something might help.

## Required artifacts before "done"

Demo: `docs/brief.md` · `docs/IMAGES.md` · `docs/lighthouse.md` ·
`docs/snapshots/` · `content/design.json` · `README.md` with the live URL ·
logo asset + the three recorded direction seeds (G25) · OG image.

Client, additionally: signed brief + sitemap · `DESIGN.md`
(`impeccable document`) · `handoff.md` · project `AGENTS.md` (`init`) ·
security headers · schema · analytics · privacy/legal pages · account handover ·
`seo-drift` baseline.
