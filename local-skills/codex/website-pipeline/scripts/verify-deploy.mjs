#!/usr/bin/env node
/**
 * verify-deploy.mjs — G14. Verify a deploy from its public origin.
 *
 * A green build and 200 responses are not a verified deploy. Build-time env
 * vars (NEXT_PUBLIC_SITE_URL and friends) bake absolute URLs into metadata, and
 * when one is unset the site happily serves a stale fallback domain in its
 * canonical tags, sitemap, robots and OG images. That has shipped before.
 *
 *   node scripts/verify-deploy.mjs https://example.netlify.app
 *   node scripts/verify-deploy.mjs https://example.com --max 12
 *   node scripts/verify-deploy.mjs https://example.com --json
 *
 * Exit 1 on any mismatch or missing artifact.
 */

const args = process.argv.slice(2);
const AS_JSON = args.includes('--json');
const base = args.find((a) => /^https?:\/\//.test(a));
const maxRoutes = Number(
  args.includes('--max') ? args[args.indexOf('--max') + 1] : 10
);

if (!base) {
  console.error('usage: node scripts/verify-deploy.mjs <https://your-live-url> [--max N] [--json]');
  process.exit(2);
}

const origin = new URL(base).origin;
const host = new URL(base).host;
const findings = [];
const note = (level, msg) => findings.push({ level, msg });

async function get(url) {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'website-pipeline/verify-deploy' } });
    return { ok: res.ok, status: res.status, url: res.url, body: await res.text() };
  } catch (err) {
    return { ok: false, status: 0, url, body: '', error: String(err.message || err) };
  }
}

/** Every absolute http(s) URL in a blob, deduped. */
function urlsIn(text) {
  return [...new Set((text.match(/https?:\/\/[^\s"'<>)\]]+/g) || []))];
}

/** Hosts that appear in the text but are not this origin and are not third-party assets. */
function foreignHosts(text, allowed = []) {
  const skip = [
    host,
    // XML/HTML namespace and spec URLs are declarations, not links to a host.
    'schema.org', 'www.w3.org', 'www.sitemaps.org', 'ogp.me', 'gmpg.org',
    'fonts.googleapis.com', 'fonts.gstatic.com',
    'www.google.com', 'maps.google.com', 'wa.me', 'api.whatsapp.com',
    'images.unsplash.com', 'images.pexels.com', 'ik.imagekit.io',
    'www.googletagmanager.com', 'www.google-analytics.com',
    ...allowed,
  ];
  const hosts = new Set();
  for (const u of urlsIn(text)) {
    try {
      const h = new URL(u).host;
      if (!skip.some((s) => h === s || h.endsWith(`.${s}`))) hosts.add(h);
    } catch { /* not a URL we can parse */ }
  }
  return [...hosts];
}

const meta = (html, re) => (html.match(re) || [])[1] || null;

// ---------------------------------------------------------------------------

async function main() {
  // --- robots.txt -----------------------------------------------------------
  const robots = await get(`${origin}/robots.txt`);
  if (!robots.ok) {
    note('FAIL', `robots.txt → ${robots.status || robots.error}`);
  } else {
    const sitemapLine = robots.body.match(/Sitemap:\s*(\S+)/i)?.[1];
    if (!sitemapLine) note('WARN', 'robots.txt has no Sitemap: line');
    else if (!sitemapLine.startsWith(origin)) {
      note('FAIL', `robots.txt Sitemap points at ${sitemapLine}, expected ${origin}`);
    } else note('OK', `robots.txt → Sitemap ${sitemapLine}`);

    const foreign = foreignHosts(robots.body);
    if (foreign.length) note('FAIL', `robots.txt references foreign host(s): ${foreign.join(', ')}`);
  }

  // --- sitemap.xml ----------------------------------------------------------
  const sitemap = await get(`${origin}/sitemap.xml`);
  let routes = [];
  if (!sitemap.ok) {
    note('FAIL', `sitemap.xml → ${sitemap.status || sitemap.error}`);
  } else {
    routes = [...sitemap.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
    if (!routes.length) note('FAIL', 'sitemap.xml contains no <loc> entries');
    else note('OK', `sitemap.xml → ${routes.length} route(s)`);

    const foreign = foreignHosts(sitemap.body);
    if (foreign.length) note('FAIL', `sitemap.xml lists foreign host(s): ${foreign.join(', ')}`);
  }

  // --- per-route metadata ---------------------------------------------------
  const toCheck = (routes.length ? routes : [origin]).slice(0, maxRoutes);
  for (const routeUrl of toCheck) {
    const path = (() => { try { return new URL(routeUrl).pathname; } catch { return routeUrl; } })();
    const page = await get(routeUrl.startsWith('http') ? routeUrl : `${origin}${routeUrl}`);
    if (!page.ok) { note('FAIL', `${path} → ${page.status || page.error}`); continue; }

    const checks = {
      canonical: meta(page.body, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i),
      'og:url': meta(page.body, /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i),
      'og:image': meta(page.body, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i),
      'twitter:image': meta(page.body, /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i),
    };

    const bad = [];
    for (const [k, v] of Object.entries(checks)) {
      if (!v) { if (k === 'canonical') bad.push(`${k} missing`); continue; }
      if (/^https?:\/\//.test(v) && !v.startsWith(origin)) bad.push(`${k}=${v}`);
    }
    if (bad.length) note('FAIL', `${path} → ${bad.join('  ')}`);
    else note('OK', `${path} → metadata on ${host}`);
  }
}

await main();

if (AS_JSON) {
  console.log(JSON.stringify({ origin, findings }, null, 2));
} else {
  const MARK = { OK: '  ok  ', WARN: ' warn ', FAIL: ' FAIL ' };
  console.log(`\nverify-deploy — ${origin}\n`);
  for (const f of findings) console.log(`[${MARK[f.level]}] ${f.msg}`);
  const fails = findings.filter((f) => f.level === 'FAIL').length;
  const warns = findings.filter((f) => f.level === 'WARN').length;
  console.log(`\n${findings.length - fails - warns} ok · ${warns} warn · ${fails} fail\n`);
  if (fails) {
    console.log('A stale absolute URL usually means a build-time env var was never set');
    console.log('on the host. That needs a REBUILD, not a restart.\n');
  }
}

process.exit(findings.some((f) => f.level === 'FAIL') ? 1 : 0);
