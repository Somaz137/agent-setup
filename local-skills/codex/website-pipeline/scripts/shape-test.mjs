#!/usr/bin/env node
/**
 * shape-test.mjs — G7.
 *
 * Rebuilds the site against HALVED and EMPTIED collections, then restores the
 * real content. Iron Vault silently required exactly 6 programs and 3 plans;
 * nothing failed, the pages just came out wrong. A real salon does not have
 * exactly 5 categories, 18 gallery items and 3 offers.
 *
 *   node scripts/shape-test.mjs          # halved, then empty, then restore
 *   node scripts/shape-test.mjs --keep   # leave the last variant in place
 *
 * Content files are backed up to .shape-backup/ and ALWAYS restored, including
 * on failure or Ctrl-C — an aborted run must never leave gutted content behind.
 */

import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const CONTENT = join(ROOT, 'content');
const BACKUP = join(ROOT, '.shape-backup');
const KEEP = process.argv.includes('--keep');

/** file -> the array-bearing keys inside it. */
const COLLECTIONS = {
  'services.json': ['categories'],
  'gallery.json': ['items'],
  'stylists.json': ['stylists'],
  'testimonials.json': ['testimonials'],
  'faqs.json': ['faqs'],
  'offers.json': ['offers'],
};

function backup() {
  rmSync(BACKUP, { recursive: true, force: true });
  mkdirSync(BACKUP, { recursive: true });
  cpSync(CONTENT, BACKUP, { recursive: true });
}

function restore() {
  if (!existsSync(BACKUP)) return;
  cpSync(BACKUP, CONTENT, { recursive: true });
  rmSync(BACKUP, { recursive: true, force: true });
}

/** `mode` is 'half' or 'empty'. */
function reshape(mode) {
  for (const [file, keys] of Object.entries(COLLECTIONS)) {
    const path = join(CONTENT, file);
    const json = JSON.parse(readFileSync(path, 'utf8'));
    for (const key of keys) {
      if (!Array.isArray(json[key])) continue;
      json[key] =
        mode === 'empty' ? [] : json[key].slice(0, Math.max(1, Math.floor(json[key].length / 2)));
    }
    writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
  }
}

function build(label) {
  process.stdout.write(`\n=== ${label} ===\n`);
  try {
    execSync('npm run build', { stdio: 'pipe', cwd: ROOT });
    console.log(`PASS  build succeeded with ${label} collections`);
    return true;
  } catch (e) {
    console.log(`FAIL  build broke with ${label} collections`);
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    console.log(out.split('\n').slice(-25).join('\n'));
    return false;
  }
}

let failed = false;
process.on('SIGINT', () => {
  restore();
  process.exit(130);
});

try {
  backup();

  reshape('half');
  if (!build('HALVED')) failed = true;

  reshape('empty');
  if (!build('EMPTY')) failed = true;
} finally {
  if (!KEEP) restore();
}

if (!KEEP) {
  // Prove the restore actually worked rather than trusting it.
  const services = JSON.parse(readFileSync(join(CONTENT, 'services.json'), 'utf8'));
  console.log(`\nRestored: ${services.categories.length} service categories back in place.`);
  if (services.categories.length === 0) {
    console.log('FAIL  restore did not work — content is still gutted');
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
