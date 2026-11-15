#!/usr/bin/env node
/**
 * gates.mjs — the mechanical gates of the website pipeline, in one run.
 *
 * Replaces ~10-15 separate tool calls per verify pass with a single pass/fail
 * table. Zero dependencies, plain Node ESM, run from the project root.
 *
 *   node scripts/gates.mjs
 *   node scripts/gates.mjs --brand "Iron Vault" --city Lahore --currency PKR
 *   node scripts/gates.mjs --client        # also require client-only artifacts
 *   node scripts/gates.mjs --json          # machine-readable output
 *
 * Config resolution order: CLI flags -> pipeline.config.json -> content/site.json
 * -> src/content/site.ts (best effort). Anything it cannot determine is SKIPped
 * with the reason, never silently passed — a gate that cannot run is not a gate
 * that passed.
 *
 * Exit code 1 if any gate FAILs. SKIP does not fail the run but is always shown.
 *
 * Gates covered here (the rest are judgment calls, see SKILL.md):
 *   G1  doc integrity      G13 deliverables exist
 *   G6  content-driven     G15 docs self-consistent
 *   G16 shipped            G22 dependency hygiene
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative, sep } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const has = (n) => args.includes(`--${n}`);
const IS_CLIENT = has('client');
const AS_JSON = has('json');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function readJSON(p) {
  try { return JSON.parse(readFileSync(join(ROOT, p), 'utf8')); } catch { return null; }
}

/** Pull "quoted values" for a few known keys out of a TS/JSON source blob. */
function scrapeKeys(src, keys) {
  const out = {};
  for (const k of keys) {
    const m = src.match(new RegExp(`\\b${k}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`));
    if (m) out[k] = m[1];
  }
  return out;
}

function loadConfig() {
  const cfg = readJSON('pipeline.config.json') || {};
  const site = readJSON('content/site.json') || readJSON('src/content/site.json') || {};

  let scraped = {};
  for (const p of ['src/content/site.ts', 'content/site.ts']) {
    if (existsSync(join(ROOT, p))) {
      const src = readFileSync(join(ROOT, p), 'utf8');
      scraped = scrapeKeys(src, ['name', 'currency', 'line2', 'domainLabel', 'city']);
      break;
    }
  }

  const brand = flag('brand') || cfg.brand || site.name || scraped.name || null;
  const currency = flag('currency') || cfg.currency || site.currency || scraped.currency || null;
  // City is rarely a discrete field; allow it to come from address.line2 ("DHA Phase 5, Lahore").
  let city = flag('city') || cfg.city || site.city || scraped.city || null;
  if (!city && scraped.line2) city = scraped.line2.split(',').pop().trim();
  if (!city && site.address?.line2) city = String(site.address.line2).split(',').pop().trim();

  return {
    brand, city, currency,
    domain: flag('domain') || cfg.domain || site.domainLabel || scraped.domainLabel || null,
    deliverables: cfg.deliverables || null,
  };
}

// ---------------------------------------------------------------------------
// File walking
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'out', 'coverage', '.netlify']);

function walk(dir, acc = []) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return acc;
  for (const entry of readdirSync(abs)) {
    if (SKIP_DIRS.has(entry)) continue;
    const rel = join(dir, entry);
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) walk(rel, acc);
    else acc.push(rel);
  }
  return acc;
}

const posix = (p) => p.split(sep).join('/');

/** Component/app sources — the "chassis". Content and tests are excluded. */
function chassisFiles() {
  return [...walk('src/components'), ...walk('src/app')]
    .filter((f) => ['.tsx', '.ts'].includes(extname(f)))
    .filter((f) => !/\.(test|spec)\.[tj]sx?$/.test(f))
    .filter((f) => !posix(f).includes('/content/'));
}

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

// ---------------------------------------------------------------------------
// Gate results
// ---------------------------------------------------------------------------

const results = [];
const pass = (id, name, note = '') => results.push({ id, name, status: 'PASS', note, details: [] });
const fail = (id, name, note, details = []) => results.push({ id, name, status: 'FAIL', note, details });
const skip = (id, name, note) => results.push({ id, name, status: 'SKIP', note, details: [] });

// ---------------------------------------------------------------------------
// G1 — doc integrity: docs must not contradict package.json on pinned versions
// ---------------------------------------------------------------------------

function gateG1() {
  const pkg = readJSON('package.json');
  if (!pkg) return skip('G1', 'Doc integrity', 'no package.json');

  const docs = [...walk('docs'), 'README.md'].filter(
    (f) => extname(f) === '.md' && existsSync(join(ROOT, f))
  );
  if (!docs.length) return skip('G1', 'Doc integrity', 'no markdown docs found');

  // Docs spell packages differently from package.json ("Next.js 15.x" vs "next").
  // Without these aliases the gate silently passes on a real contradiction.
  const watched = {
    next: '(?:next\\.?js|nextjs|next)',
    react: 'react',
    tailwindcss: '(?:tailwind\\s*css|tailwindcss|tailwind)',
  };
  const hits = [];

  for (const [dep, pattern] of Object.entries(watched)) {
    const declared = pkg.dependencies?.[dep] || pkg.devDependencies?.[dep];
    if (!declared) continue;
    const major = String(declared).match(/(\d+)/)?.[1];
    if (!major) continue;

    for (const doc of docs) {
      const src = readFileSync(join(ROOT, doc), 'utf8');
      // Allow "Next.js 16", "Next.js: 15.x", "next@16", "Next.js v16".
      const re = new RegExp(`\\b${pattern}[\\s:@]*v?(\\d+)(?:\\.[\\dx]+)*`, 'gi');
      let m;
      while ((m = re.exec(src))) {
        if (m[1] !== major) {
          hits.push(`${posix(doc)}:${lineOf(src, m.index)} says ${dep} ${m[1]}, installed is ${major}`);
        }
      }
    }
  }

  return hits.length
    ? fail('G1', 'Doc integrity', `${hits.length} version contradiction(s)`, hits)
    : pass('G1', 'Doc integrity', 'docs agree with package.json');
}

// ---------------------------------------------------------------------------
// G6 — content-driven: the chassis carries no business facts and no fixed shape
// ---------------------------------------------------------------------------

function gateG6(cfg) {
  const files = chassisFiles();
  if (!files.length) return skip('G6', 'Content-driven', 'no src/components or src/app');

  const terms = [cfg.brand, cfg.city, cfg.domain].filter(Boolean);
  const details = [];

  for (const f of files) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    const importsContent = /from\s+["'](@\/content|\.\.?\/.*content)/.test(src);

    // (a) business facts hardcoded in the chassis
    for (const term of terms) {
      const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      let m;
      while ((m = re.exec(src))) {
        details.push(`${posix(f)}:${lineOf(src, m.index)} hardcodes "${term}"`);
      }
    }
    if (cfg.currency) {
      const re = new RegExp(`["'\`][^"'\`]*\\b${cfg.currency}\\s*[\\d{]`, 'g');
      let m;
      while ((m = re.exec(src))) {
        details.push(`${posix(f)}:${lineOf(src, m.index)} hardcodes a ${cfg.currency} amount`);
      }
    }

    // (b) prose in the chassis — a component may not contain a sentence
    const proseRe = /(?:^|[\s({[=])["']([^"'\n]{45,})["']/g;
    let p;
    while ((p = proseRe.exec(src))) {
      const text = p[1];
      const words = text.trim().split(/\s+/).length;
      const looksLikeCode = /[{}<>|]|=>|\/\/|https?:|^[\w-]+$|\.(tsx?|css|json|png|jpe?g|svg|webp)$/i.test(text);
      const isClassList = /\b(flex|grid|text-|bg-|border-|px-|py-|gap-|rounded|absolute|relative)\b/.test(text);
      if (words >= 7 && !looksLikeCode && !isClassList) {
        details.push(`${posix(f)}:${lineOf(src, p.index)} prose in chassis: "${text.slice(0, 55)}…"`);
      }
    }

    if (!importsContent) continue;

    // (c) fixed column counts over a collection
    let g;
    const gridRe = /\bgrid-cols-(\d+)\b/g;
    while ((g = gridRe.exec(src))) {
      if (Number(g[1]) >= 2) {
        details.push(`${posix(f)}:${lineOf(src, g.index)} fixed grid-cols-${g[1]} over content`);
      }
    }

    // (d) literal index or positional slice into a collection
    let i;
    const idxRe = /\b([A-Za-z_$][\w$]*)\[(\d+)\]/g;
    while ((i = idxRe.exec(src))) {
      if (!/^(argv|arr|args|matches|m|parts|rows)$/.test(i[1])) {
        details.push(`${posix(f)}:${lineOf(src, i.index)} literal index ${i[1]}[${i[2]}]`);
      }
    }
    const sliceRe = /\.slice\(\s*\d/g;
    let s;
    while ((s = sliceRe.exec(src))) {
      const before = src.slice(Math.max(0, s.index - 40), s.index);
      if (!/\b(toISOString|string|str|text|paragraph|slug|id)\b/i.test(before)) {
        details.push(`${posix(f)}:${lineOf(src, s.index)} positional .slice() over a collection`);
      }
    }
  }

  if (!terms.length && !cfg.currency) {
    return skip('G6', 'Content-driven', 'brand/city unknown — pass --brand and --city');
  }

  // Justified allowlist. G6's heuristics are deliberately blunt (they found 89
  // real leaks on the first project that ran them), so they also flag things
  // that are not defects: SVG path geometry read as prose, `sizes=` hints,
  // String.prototype.slice, responsive breakpoints that are not count-locked.
  //
  // A permanently-red gate stops being a gate, but silently softening the
  // heuristic would lose the real finds. So suppression is explicit, per
  // project, in .gates-allow.json, and every entry MUST carry a reason of at
  // least 15 characters. The suppressed count is always printed, so what has
  // been waved through stays visible instead of disappearing.
  const allowRaw = readJSON('.gates-allow.json')?.G6 ?? [];
  const allow = allowRaw.filter(
    (a) => a && typeof a.match === 'string' && typeof a.reason === 'string' && a.reason.trim().length >= 15,
  );
  const rejected = allowRaw.length - allow.length;
  // Match against the detail with its :LINE stripped. A suppression anchored to
  // a line number silently stops matching the moment anything above it moves,
  // and the finding reappears looking new — which is worse than no suppression,
  // because it trains you to ignore the gate.
  const normalise = (d) => d.replace(/:\d+ /, ' ');
  const suppressed = [];
  const kept = details.filter((d) => {
    const n = normalise(d);
    if (allow.some((a) => n.includes(a.match) || d.includes(a.match))) {
      suppressed.push(d);
      return false;
    }
    return true;
  });

  const suffix =
    (suppressed.length ? `, ${suppressed.length} allowed` : '') +
    (rejected ? `, ${rejected} allowlist entry/entries IGNORED (missing reason)` : '');

  return kept.length
    ? fail('G6', 'Content-driven', `${kept.length} chassis leak(s)${suffix}`, kept)
    : pass('G6', 'Content-driven', `chassis is free of business facts and fixed shape${suffix}`);
}

// ---------------------------------------------------------------------------
// G13 — every promised deliverable exists
// ---------------------------------------------------------------------------

function gateG13(cfg) {
  const required = cfg.deliverables || [
    'README.md',
    'docs/IMAGES.md',
    'docs/lighthouse.md',
    ...(IS_CLIENT ? ['DESIGN.md', 'handoff.md', 'CLAUDE.md'] : []),
  ];
  const missing = required.filter((f) => !existsSync(join(ROOT, f)));
  return missing.length
    ? fail('G13', 'Deliverables', `${missing.length} missing`, missing.map((m) => `missing: ${m}`))
    : pass('G13', 'Deliverables', `${required.length} present`);
}

// ---------------------------------------------------------------------------
// G15 — docs do not contradict themselves about where the site lives
// ---------------------------------------------------------------------------

function gateG15() {
  const docs = [...walk('docs'), 'README.md'].filter(
    (f) => extname(f) === '.md' && existsSync(join(ROOT, f))
  );
  if (!docs.length) return skip('G15', 'Docs consistent', 'no markdown docs found');

  const hostsByDoc = new Map();
  const hostRe = /\b([a-z0-9-]+\.(?:netlify\.app|vercel\.app|pages\.dev|github\.io))\b/gi;
  const platformRe = /\b(Netlify|Vercel|Cloudflare Pages)\b/g;

  for (const doc of docs) {
    const src = readFileSync(join(ROOT, doc), 'utf8');
    const hosts = new Set([...src.matchAll(hostRe)].map((m) => m[1].toLowerCase()));
    const platforms = new Set([...src.matchAll(platformRe)].map((m) => m[1]));
    hostsByDoc.set(doc, { hosts, platforms, src });
  }

  const details = [];
  const allHosts = new Set([...hostsByDoc.values()].flatMap((v) => [...v.hosts]));
  if (allHosts.size > 1) {
    details.push(`docs reference ${allHosts.size} deploy hosts: ${[...allHosts].join(', ')}`);
  }
  for (const [doc, { platforms, src }] of hostsByDoc) {
    if (platforms.size > 1) {
      const where = [...platforms].map((p) => {
        const i = src.indexOf(p);
        return `${p} (line ${lineOf(src, i)})`;
      });
      details.push(`${posix(doc)} names ${platforms.size} platforms: ${where.join(', ')}`);
    }
  }

  return details.length
    ? fail('G15', 'Docs consistent', 'contradictory deploy target', details)
    : pass('G15', 'Docs consistent', 'one deploy target referenced');
}

// ---------------------------------------------------------------------------
// G16 — the work is actually shipped
// ---------------------------------------------------------------------------

function gateG16() {
  const git = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  let branch;
  try { branch = git('git rev-parse --abbrev-ref HEAD'); }
  catch { return skip('G16', 'Shipped', 'not a git repository'); }

  const details = [];
  try {
    const status = git('git status --porcelain');
    if (status) details.push(`working tree dirty (${status.split('\n').length} file(s))`);
  } catch { /* ignore */ }

  // Find the integration branch this repo actually uses.
  let target = null;
  for (const cand of ['origin/main', 'origin/master', 'main', 'master']) {
    try { git(`git rev-parse --verify ${cand}`); target = cand; break; } catch { /* next */ }
  }
  if (!target) return skip('G16', 'Shipped', 'no main/master branch found');

  if (branch === target.replace('origin/', '')) {
    if (!details.length) return pass('G16', 'Shipped', `on ${branch}`);
  } else {
    try {
      git(`git merge-base --is-ancestor HEAD ${target}`);
      details.push(`HEAD is merged into ${target}, but still on branch ${branch}`);
    } catch {
      details.push(`HEAD is NOT merged into ${target} (on ${branch})`);
    }
  }
  return details.length
    ? fail('G16', 'Shipped', 'unmerged or unclean', details)
    : pass('G16', 'Shipped', `merged into ${target}`);
}

// ---------------------------------------------------------------------------
// G22 — one headless UI library, no unused deps, licences noted
// ---------------------------------------------------------------------------

function gateG22() {
  const pkg = readJSON('package.json');
  if (!pkg) return skip('G22', 'Dependency hygiene', 'no package.json');

  const deps = { ...pkg.dependencies };
  const files = [...walk('src')].filter((f) =>
    ['.ts', '.tsx', '.mjs', '.js'].includes(extname(f))
  );
  const sources = files.map((f) => readFileSync(join(ROOT, f), 'utf8'));
  const esc = (n) => n.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const importsOf = (name) =>
    sources.some((s) => new RegExp(`from\\s+["'\`]${esc(name)}(\\/|["'\`])`).test(s));

  // CSS can pull a package too (`@import "tw-animate-css"`). Scanning only
  // JS/TS reports those as unused, which is a false positive, not a finding.
  const cssSources = [...walk('src'), ...walk('app'), ...walk('styles')]
    .filter((f) => ['.css', '.scss'].includes(extname(f)))
    .map((f) => readFileSync(join(ROOT, f), 'utf8'));
  const importedInCss = (name) =>
    cssSources.some((s) => new RegExp(`@(?:import|plugin|source)\\s+["']${esc(name)}`).test(s));

  // A CLI shipped as a dependency is a hygiene issue of its own, but it is not
  // "unused" in the dead-code sense — report it as misplaced instead.
  const CLI_PACKAGES = new Set(['shadcn', 'vercel', 'netlify-cli']);

  const details = [];

  // Two headless libraries in one project is an unfinished migration.
  const headless = ['radix-ui', '@radix-ui/react-slot', '@base-ui/react'].filter(
    (d) => deps[d] && importsOf(d)
  );
  const families = new Set(headless.map((d) => (d.startsWith('@base-ui') ? 'base-ui' : 'radix')));
  if (families.size > 1) {
    for (const d of headless) {
      const where = files.filter((f, i) =>
        new RegExp(`from\\s+["'\`]${d.replace('/', '\\/')}(\\/|["'\`])`).test(sources[i])
      );
      details.push(`${d} imported by ${where.map(posix).join(', ')}`);
    }
    details.unshift(`two headless UI libraries in use: ${[...families].join(' + ')}`);
  }

  // Declared but never imported, from JS/TS *or* CSS.
  const IGNORE = new Set(['next', 'react', 'react-dom', 'tailwindcss', '@tailwindcss/postcss']);
  for (const d of Object.keys(deps)) {
    if (IGNORE.has(d) || importsOf(d) || importedInCss(d)) continue;
    details.push(
      CLI_PACKAGES.has(d)
        ? `CLI package in dependencies (belongs in devDependencies or npx): ${d}`
        : `declared but never imported: ${d}`
    );
  }

  return details.length
    ? fail('G22', 'Dependency hygiene', `${details.length} issue(s)`, details)
    : pass('G22', 'Dependency hygiene', 'one UI library, no unused deps');
}

// ---------------------------------------------------------------------------
// Run + report
// ---------------------------------------------------------------------------

const cfg = loadConfig();
gateG1();
gateG6(cfg);
gateG13(cfg);
gateG15();
gateG16();
gateG22();

if (AS_JSON) {
  console.log(JSON.stringify({ config: cfg, results }, null, 2));
} else {
  const MARK = { PASS: '  ok  ', FAIL: ' FAIL ', SKIP: ' skip ' };
  console.log(`\nwebsite-pipeline gates — ${IS_CLIENT ? 'client' : 'demo'} mode`);
  console.log(`brand=${cfg.brand ?? '?'}  city=${cfg.city ?? '?'}  currency=${cfg.currency ?? '?'}\n`);
  for (const r of results) {
    console.log(`[${MARK[r.status]}] ${r.id.padEnd(4)} ${r.name.padEnd(22)} ${r.note}`);
    for (const d of r.details.slice(0, 12)) console.log(`             · ${d}`);
    if (r.details.length > 12) console.log(`             · …and ${r.details.length - 12} more`);
  }
  const failed = results.filter((r) => r.status === 'FAIL');
  const skipped = results.filter((r) => r.status === 'SKIP');
  console.log(
    `\n${results.length - failed.length - skipped.length} passed · ` +
    `${failed.length} failed · ${skipped.length} skipped\n`
  );
  if (skipped.length) console.log('A skipped gate is not a passed gate — supply its inputs.\n');
}

process.exit(results.some((r) => r.status === 'FAIL') ? 1 : 0);
