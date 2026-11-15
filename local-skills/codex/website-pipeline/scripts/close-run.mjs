#!/usr/bin/env node
/**
 * close-run.mjs — the Stage 13 gate. G23, mechanised.
 *
 * A retrospective that depends on remembering to write one is a retrospective
 * that gets skipped on the run that most needed it. This makes skipping it
 * FAIL LOUDLY instead of passing silently.
 *
 * It deliberately does NOT write the retro for you. Deciding what actually went
 * wrong is judgment, and a script that invented entries would produce a log
 * nobody trusts. What it does is refuse to let the run close without one, say
 * exactly what is missing, and mechanise the parts that ARE mechanical: script
 * drift back into the skill, and the three-strikes rule.
 *
 *   node scripts/close-run.mjs                  check; exit 1 if not closeable
 *   node scripts/close-run.mjs --sync           also carry improved scripts back
 *   node scripts/close-run.mjs --vault "<dir>"  override vault location
 *
 * Checks:
 *   C1  a retro entry dated TODAY exists in the build log
 *   C2  that entry uses the vault's four-field format
 *   C3  project scripts match the skill's copies (improvements carried back)
 *   C4  three-strikes: nothing sitting at 3+ occurrences unconverted
 *   C5  required deliverables exist
 */

import { readFileSync, existsSync, copyFileSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const SYNC = args.includes('--sync');
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};

/**
 * Where the SKILL's copies live — not where this file happens to be running
 * from.
 *
 * This was `dirname(fileURLToPath(import.meta.url))`, which is the directory of
 * the *running* script. Since close-run.mjs is vendored into each project and
 * invoked as `node scripts/close-run.mjs`, that resolved to the project's own
 * scripts/ — so `mine` and `theirs` were the same path for every vendored file,
 * the comparison could never differ, and C3 reported "project and skill scripts
 * match" on every run. The sync-back has therefore never carried anything back,
 * while reporting success. Found 2026-09-05, when the skill's shots.mjs turned
 * out to differ from a project copy C3 had just called identical.
 *
 * A no-op that reports PASS is worse than a missing check: it consumes the
 * attention a real check would have earned.
 */
const SKILL_SCRIPTS = (() => {
  const override = flag('skill');
  if (override) return override;
  const home = process.env.USERPROFILE || process.env.HOME || '';
  return join(home, '.claude', 'skills', 'website-pipeline', 'scripts');
})();

/** The project's own scripts/, for the identity guard in C3. */
const PROJECT_SCRIPTS = dirname(fileURLToPath(import.meta.url));

/** Locate the vault, or return null rather than guessing wrong. */
function findVault() {
  const override = flag('vault');
  if (override) return override;
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const candidates = [
    join(home, 'OneDrive', 'Desktop', 'Website Making Plan'),
    join(home, 'Desktop', 'Website Making Plan'),
  ];
  for (const c of candidates) if (existsSync(join(c, '99 Logs'))) return c;
  return null;
}

const results = [];
const add = (id, name, status, note, details = []) =>
  results.push({ id, name, status, note, details });

const now = new Date();
const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

// ---------------------------------------------------------------------------
// C1 / C2 — the retro entry itself
// ---------------------------------------------------------------------------
const vault = findVault();
const logPath = vault ? join(vault, '99 Logs', 'Build Mistakes And Fixes.md') : null;

if (!logPath || !existsSync(logPath)) {
  add('C1', 'Retro entry', 'FAIL', 'build log not found', [
    `looked for: ${logPath ?? '(vault not located)'}`,
    'pass --vault "<path to Website Making Plan>" if it lives elsewhere',
  ]);
  add('C2', 'Retro format', 'SKIP', 'no log to check');
  add('C4', 'Three strikes', 'SKIP', 'no log to check');
} else {
  const log = readFileSync(logPath, 'utf8');
  const entries = log.split(/^## /m).slice(1);
  const todays = entries.filter((e) => e.startsWith(iso));

  if (todays.length === 0) {
    add('C1', 'Retro entry', 'FAIL', `no entry dated ${iso}`, [
      'This run has not been written up. Append to:',
      `  ${logPath}`,
      '',
      `## ${iso} — short title`,
      '**Observed:** what happened, specific enough to understand months later',
      '**Change:** the concrete change made',
      '**Applies to:** which stage, gate, script or file',
      '**Revisit:** the condition or date that reopens this',
      '',
      'If the run genuinely surfaced nothing, write that as one entry and say',
      'why. "Nothing went wrong" is a finding worth dating.',
    ]);
    add('C2', 'Retro format', 'SKIP', 'nothing to check');
  } else {
    add('C1', 'Retro entry', 'PASS', `${todays.length} entry/entries dated ${iso}`);

    const malformed = [];
    for (const e of todays) {
      const title = e.split('\n')[0].trim();
      for (const field of ['**Observed:**', '**Change:**', '**Applies to:**', '**Revisit:**']) {
        if (!e.includes(field)) malformed.push(`${title} — missing ${field.replace(/\*/g, '')}`);
      }
    }
    if (malformed.length) {
      add('C2', 'Retro format', 'FAIL', `${malformed.length} field(s) missing`, malformed);
    } else {
      add('C2', 'Retro format', 'PASS', 'all entries carry the four fields');
    }
  }

  // -------------------------------------------------------------------------
  // C4 — three strikes. An issue logged three times is a missing gate.
  // -------------------------------------------------------------------------
  const applies = [];
  for (const e of entries) {
    const m = e.match(/\*\*Applies to:\*\*\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)/);
    if (m) {
      applies.push({
        title: e.split('\n')[0].trim(),
        target: m[1].replace(/\s+/g, ' ').trim(),
      });
    }
  }
  const tally = new Map();
  for (const a of applies) {
    // Only concrete artefacts count. "Stage 8" is far too coarse — four
    // unrelated defects in one stage is not one issue recurring three times,
    // and a warning that fires on coincidence teaches you to ignore warnings.
    const tokens = a.target.match(/\bG\d{1,2}\b|[a-z-]+\.mjs/g) ?? [];
    for (const token of new Set(tokens)) {
      if (!tally.has(token)) tally.set(token, []);
      tally.get(token).push(a.title);
    }
  }
  const repeat = [...tally.entries()].filter(([, v]) => v.length >= 3);
  if (repeat.length) {
    add('C4', 'Three strikes', 'WARN', `${repeat.length} recurring target(s)`,
      repeat.flatMap(([k, v]) => [
        `${k} — referenced by ${v.length} entries:`,
        ...v.slice(-4).map((t) => `    · ${t}`),
        '    -> check whether these are ONE recurring issue. If they are, it is',
        '       a missing gate: convert it to a check before this run closes.',
      ]));
  } else {
    add('C4', 'Three strikes', 'PASS', 'nothing at three or more occurrences');
  }
}

// ---------------------------------------------------------------------------
// C3 — script drift. An improvement made inside a project must reach the
// skill, or the next build rediscovers the same defect from scratch.
// ---------------------------------------------------------------------------
const VENDORED = [
  'gates.mjs',
  'shots.mjs',
  'states.mjs',
  'shape-test.mjs',
  'verify-deploy.mjs',
  'close-run.mjs',
];
const drift = [];
const synced = [];
const absentFromSkill = [];

// Guard: if the skill's scripts/ resolves to the project's own, every
// comparison is a file against itself and this check can only ever pass. Say
// so instead of reporting a match nobody verified.
if (resolve(SKILL_SCRIPTS) === resolve(PROJECT_SCRIPTS) || !existsSync(SKILL_SCRIPTS)) {
  add('C3', 'Script drift', 'SKIP', `cannot locate the skill's scripts (${SKILL_SCRIPTS})`, [
    'Pass --skill <dir> to point at the skill\'s scripts/ directory.',
    'Not reporting a match: nothing was actually compared.',
  ]);
} else {
for (const f of VENDORED) {
  const mine = join(ROOT, 'scripts', f);
  const theirs = join(SKILL_SCRIPTS, f);
  // A script the project has but the skill does not is the most valuable case
  // of all — a NEW tool that would otherwise never reach the next build.
  if (existsSync(mine) && !existsSync(theirs)) {
    if (SYNC) { copyFileSync(mine, theirs); synced.push(`${f} -> skill (new)`); }
    else absentFromSkill.push(`${f} — exists in project, absent from skill`);
    continue;
  }
  if (!existsSync(mine) || !existsSync(theirs)) continue;
  // Normalise line endings: Git rewrites them on Windows, and a CRLF/LF
  // difference is not a real divergence.
  const norm = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  if (norm(mine) !== norm(theirs)) {
    if (SYNC) {
      copyFileSync(mine, theirs);
      synced.push(`${f} -> skill`);
    } else {
      const newer = statSync(mine).mtimeMs > statSync(theirs).mtimeMs ? 'project' : 'skill';
      drift.push(`${f} — differs (${newer} copy is newer)`);
    }
  }
}
if (synced.length) {
  add('C3', 'Script drift', 'PASS', `${synced.length} script(s) carried back`, synced);
} else if (drift.length || absentFromSkill.length) {
  add('C3', 'Script drift', 'FAIL', `${drift.length + absentFromSkill.length} script(s) out of sync`, [
    ...drift,
    ...absentFromSkill,
    'If the project copy is the improved one: re-run with --sync to carry it back.',
    'If the skill copy is newer: copy it into the project instead.',
  ]);
} else {
  add('C3', 'Script drift', 'PASS', `project and skill scripts match (${VENDORED.length} compared)`);
}
}

// ---------------------------------------------------------------------------
// C5 — deliverables
// ---------------------------------------------------------------------------
const REQUIRED = ['docs/brief.md', 'docs/IMAGES.md', 'docs/lighthouse.md', 'README.md'];
const missing = REQUIRED.filter((f) => !existsSync(join(ROOT, f)));
if (missing.length) {
  add('C5', 'Deliverables', 'FAIL', `${missing.length} missing`, missing);
} else {
  add('C5', 'Deliverables', 'PASS', `${REQUIRED.length} present`);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const MARK = { PASS: '  ok  ', FAIL: ' FAIL ', WARN: ' warn ', SKIP: ' skip ' };
console.log('\nwebsite-pipeline — closing the run (Stage 13 / G23)\n');
for (const r of results) {
  console.log(`[${MARK[r.status]}] ${r.id.padEnd(3)} ${r.name.padEnd(15)} ${r.note}`);
  for (const d of r.details) console.log(`            ${d}`);
}
const failed = results.filter((r) => r.status === 'FAIL');
const warned = results.filter((r) => r.status === 'WARN');
console.log(
  `\n${results.filter((r) => r.status === 'PASS').length} passed · ` +
    `${failed.length} failed · ${warned.length} warning(s)\n`,
);
if (failed.length) {
  console.log('This run is NOT closeable. Fix the above, then re-run.\n');
  process.exit(1);
}
console.log('Run is closeable.\n');
