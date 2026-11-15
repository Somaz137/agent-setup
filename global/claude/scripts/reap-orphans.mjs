#!/usr/bin/env node
/**
 * reap-orphans.mjs — kill stranded Claude-spawned processes from dead sessions.
 *
 * Written after a `find / -name card-states.png` from a session that ended the
 * previous day ran for 26 hours and burned 10.1 core-hours at 104% of a core,
 * alongside two detached `python -m http.server` instances, four `tail -f`/`grep`
 * watchers and five stranded bash wrappers.
 *
 * Runs as a SessionStart hook. Start, not end: a SessionEnd/Stop hook never fires
 * when the app crashes or is force-quit, which is exactly how orphans are made.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS DOES NOT USE PROCESS ANCESTRY AS THE OWNERSHIP SIGNAL
 *
 * The obvious rule — "spare it if its parent chain reaches a live claude.exe" —
 * does not work. Claude's Bash tool launches a wrapper shell that EXITS as soon
 * as the command is backgrounded, so a perfectly healthy dev server started via
 * run_in_background is already parentless seconds later. Measured on this
 * machine: a live `next dev` traced back through cmd.exe and two bash wrappers
 * to PID 8204, which no longer existed, while the session was still running.
 *
 * So ancestry is used only as a positive protection (if a live owner IS found,
 * skip), never as evidence of abandonment. The load-bearing signals are AGE and
 * ACCUMULATED CPU, with an explicit never-touch list for real dev servers.
 * ---------------------------------------------------------------------------
 *
 * Reaped when: name is reapable AND it carries a Claude fingerprint AND it is
 * not protected AND no live owner is found AND
 *     age > --min-age (default 4h)          — ordinary strandedness
 *   OR cpu > --max-cpu (default 600s) and age > 30m   — runaway, kill early
 *
 * EXCEPT for shell/console wrappers (cmd.exe, powershell.exe, pwsh.exe,
 * conhost.exe): a name match there is necessary but never sufficient. A live
 * terminal window is ordinarily one of these, so "old" alone is exactly what
 * an innocent idle terminal looks like. Wrappers additionally require real
 * accumulated CPU (>= --min-age AND >= 30s CPU) — age and CPU together, never
 * age alone. This was added after a stranded `cmd.exe` (dead parent, 30h old,
 * 1.22 CPU-hours) walked past the old REAPABLE list entirely, because nothing
 * in it named the wrapper layer that actually spawns the interpreters above.
 *
 * A process with an EMPTY CommandLine cannot be matched against PROTECTED or
 * CLAUDE_PATH (both test the command line; testing '' is not evidence either
 * way) — it is judged on name + age + CPU + dead-parent alone and reported in
 * -v output as "unidentifiable — decided on name/age/cpu" rather than being
 * silently folded into an ordinary verdict.
 *
 * Usage:
 *   node reap-orphans.mjs                 # reap (hook mode: silent when clean)
 *   node reap-orphans.mjs --dry-run       # list what it would do, kill nothing
 *   node reap-orphans.mjs --dry-run -v    # ...and show every skip reason
 *   node reap-orphans.mjs --min-age 60    # more aggressive
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run') || argv.includes('--report');
const VERBOSE = argv.includes('--verbose') || argv.includes('-v');
const MIN_AGE_MIN = numArg('--min-age', 240);   // 4h: nothing legitimate is this old and forgotten
const MAX_CPU_SEC = numArg('--max-cpu', 600);   // 10 CPU-minutes = runaway
const RUNAWAY_AGE_MIN = 30;                     // runaways get killed at this age instead
const WRAPPER_MIN_CPU_SEC = 30;                 // an idle terminal accrues near-zero CPU
                                                 // even when old; require real work, not just age
const WARN_AGE_MIN = 24 * 60;                   // nag about protected servers older than a day
const LOG = join(homedir(), '.claude', 'logs', 'reap-orphans.log');

function numArg(flag, dflt) {
  const i = argv.indexOf(flag);
  const v = i >= 0 ? Number(argv[i + 1]) : NaN;
  return Number.isFinite(v) ? v : dflt;
}

/* ---------- classification tables -------------------------------------- */

// Only short-lived tooling is ever a candidate. Never a browser, editor, or app.
// cmd/powershell/pwsh/conhost were added after a stranded `cmd.exe` (dead
// parent, 30h old, 1.22 CPU-hours) sailed through this filter untouched: on
// Windows cmd.exe is the wrapper that SPAWNS the interpreters above, so it
// outlives them and accumulates their runtime. It is gated far more strictly
// than the rest of this list — see WRAPPER and its use in the decide loop
// below. A name appearing here is necessary, never sufficient, for reaping.
const REAPABLE = /^(python\d*|pythonw|node|deno|bun|ruby|php|bash|sh|dash|tail|grep|head|cat|sed|awk|find|xargs|sleep|npm|cmd|cmd\.exe|powershell|pwsh|conhost)$/i;

// Shell/console wrapper processes. A live terminal window is ordinarily one
// of these, and ordinary is not stranded — so unlike the rest of REAPABLE,
// a name match here is never enough on its own. The decide loop requires the
// full strict signal set for a WRAPPER match: dead parent (already required
// for every candidate) AND real age AND real accumulated CPU. Age alone,
// which is sufficient for an interpreter like a stray `node`, is explicitly
// NOT sufficient for a wrapper — an old, idle, perfectly healthy terminal
// looks exactly like "old" and nothing else.
const WRAPPER = /^(cmd|cmd\.exe|powershell|pwsh|conhost)$/i;

// If the chain reaches one of these while it is alive, something owns the
// process and we leave it be. Absence of an owner proves nothing (see header).
const LIVE_OWNER = /^(claude|Antigravity IDE|Code|Cursor|windsurf|WindowsTerminal|powershell|pwsh|explorer)\.exe$/i;

// Ties a process to a Claude session.
const CLAUDE_PATH = /([\\/]\.claude[\\/]|[\\/]Temp[\\/]claude[\\/]|anthropic\.claude-code|claude-code[\\/])/i;

// Real dev servers. NEVER killed — a false positive here costs the user their
// running app, while leaving one alive costs almost nothing. Reported if stale.
const PROTECTED = /([\\/]\.?next[\\/](dist|dev)[\\/]|[\\/]\.bin[\\/]next\b|\bnext\s+(dev|start)\b|[\\/]vite[\\/]|\bvite(\.js)?\b|webpack|nodemon|[\\/]astro[\\/]|\brun\s+dev\b|\brun\s+start\b|runserver|rails\s+server|\bserve\b)/i;

// Name-scoped signatures for things nobody deliberately leaves running. These
// substitute for a claude path when the parent that carried it has already died.
const EPHEMERAL = [
  { name: /^python\d*$/i, re: /\bhttp\.server\b/i,        label: 'http.server' },
  { name: /^tail$/i,      re: /\s-f\b/i,                  label: 'tail -f' },
  { name: /^grep$/i,      re: /--line-buffered/i,         label: 'grep watcher' },
  { name: /^find$/i,      re: /./,                        label: 'find sweep' },
  { name: /^node$/i,      re: /(chrome-devtools-mcp|@playwright[\\/]mcp|@modelcontextprotocol[\\/])/i, label: 'stale mcp' },
];

/* ---------- process snapshot ------------------------------------------- */

function snapshot() {
  const ps = [
    "$ErrorActionPreference = 'Stop'",
    "$epoch = [datetime]'1970-01-01T00:00:00Z'",
    '$out = Get-CimInstance Win32_Process | ForEach-Object {',
    '  $s = 0',
    '  if ($_.CreationDate) { $s = [int64](($_.CreationDate.ToUniversalTime() - $epoch).TotalMilliseconds) }',
    '  $cpu = 0',
    '  try { $cpu = [int64]((([uint64]$_.KernelModeTime + [uint64]$_.UserModeTime)) / 10000000) } catch { $cpu = 0 }',
    '  [pscustomobject]@{',
    '    pid     = [int]$_.ProcessId',
    '    ppid    = [int]$_.ParentProcessId',
    '    name    = [string]$_.Name',
    '    cmd     = [string]$_.CommandLine',
    '    started = $s',
    '    cpu     = $cpu',
    '  }',
    '}',
    'ConvertTo-Json -InputObject @($out) -Compress -Depth 3',
  ].join('\n');

  const raw = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
    encoding: 'utf8',
    maxBuffer: 96 * 1024 * 1024,
    windowsHide: true,
  });
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [parsed];
}

const procs = snapshot();
const byPid = new Map(procs.map((p) => [p.pid, p]));
const base = (n) => String(n || '').replace(/\.exe$/i, '');

/** Walk toward the root. A parent that started after its child means the PID
 *  was recycled, so the true parent is gone and the chain ends there. */
function ancestry(p) {
  const chain = [];
  let cur = p;
  for (let hops = 0; hops < 64; hops++) {
    if (!cur.ppid || cur.ppid === cur.pid) break;
    const parent = byPid.get(cur.ppid);
    if (!parent) break;                           // parent gone
    if (parent.started > cur.started) break;      // PID reused
    chain.push(parent);
    if (LIVE_OWNER.test(parent.name)) return { chain, owner: parent };
    cur = parent;
  }
  return { chain, owner: null };
}

// Never reap anything this script is itself running underneath.
const selfChain = new Set([process.pid]);
{
  const me = byPid.get(process.pid);
  if (me) for (const a of ancestry(me).chain) selfChain.add(a.pid);
}

// Label used when a process has no CommandLine at all: it cannot be matched
// against CLAUDE_PATH or EPHEMERAL (both test p.cmd, and testing a regex
// against '' is not "checked and clear", it is "never checked"), and the
// PROTECTED test a few lines below is equally blind for the same reason. Such
// a process is judged on name + age + CPU + dead-parent alone — the only
// signals that remain — which is strictly weaker evidence than every other
// reap decision this script makes, so it is called out by name rather than
// silently blending into an ordinary 'claude-path' or null verdict.
const UNIDENTIFIED_LABEL = 'unidentifiable — decided on name/age/cpu';

function fingerprint(p, chain) {
  const hasCmd = !!p.cmd;
  // Self-cmd tests only make sense with an actual CommandLine to test.
  if (hasCmd && CLAUDE_PATH.test(p.cmd)) return 'claude-path';
  // Ancestor cmd lines are independent of this process's own (possibly
  // empty) CommandLine, so this check still applies either way.
  for (const a of chain) if (CLAUDE_PATH.test(a.cmd || '')) return 'claude-ancestor';
  if (hasCmd) {
    const n = base(p.name);
    for (const sig of EPHEMERAL) if (sig.name.test(n) && sig.re.test(p.cmd)) return sig.label;
  }
  if (!hasCmd) return UNIDENTIFIED_LABEL;
  return null;
}

/* ---------- decide ------------------------------------------------------ */

const now = Date.now();
const kill = [];
const warn = [];
const skipped = [];

for (const p of procs) {
  const note = (r) => skipped.push({ p, r });
  if (selfChain.has(p.pid)) { note('self'); continue; }
  if (!REAPABLE.test(base(p.name))) continue;

  const ageMin = p.started ? (now - p.started) / 60000 : Infinity;
  const { chain, owner } = ancestry(p);
  const fp = fingerprint(p, chain);
  if (!fp) { note('no claude fingerprint'); continue; }

  // An empty CommandLine cannot match PROTECTED either — testing a regex
  // against '' always fails, which is not the same claim as "checked the
  // command and it isn't a dev server". Called out as its own branch so this
  // is a documented non-decision rather than a silent side effect of the
  // regex test below happening to receive an empty string. It is still safe
  // to fall through to the ordinary owner/age/cpu logic: every PROTECTED
  // pattern (next dev, vite, webpack, ...) requires a non-empty command to
  // ever match, so a real dev server can never present as empty-cmd here.
  if (!p.cmd) {
    note('empty CommandLine — cannot test PROTECTED, deciding on name/age/cpu');
  } else if (PROTECTED.test(p.cmd)) {
    if (ageMin > WARN_AGE_MIN) warn.push({ ...p, ageMin, fp });
    note('protected dev server');
    continue;
  }
  if (owner) { note(`owned by live ${owner.name} (pid ${owner.pid})`); continue; }

  const runaway = p.cpu >= MAX_CPU_SEC && ageMin >= RUNAWAY_AGE_MIN;

  if (WRAPPER.test(base(p.name))) {
    // Strict AND of every signal: dead parent (already established — we
    // only reach here when `owner` is falsy), real age, AND real CPU. Never
    // reaped on age alone, because an old-but-idle terminal is exactly what
    // a perfectly healthy shell window looks like.
    if (!(ageMin >= MIN_AGE_MIN && p.cpu >= WRAPPER_MIN_CPU_SEC)) {
      note(`wrapper lacks full evidence (age ${ageMin.toFixed(0)}m, cpu ${p.cpu}s) — never reaped on age alone`);
      continue;
    }
  } else if (!runaway && ageMin < MIN_AGE_MIN) {
    note(`too young (${ageMin.toFixed(0)}m)`);
    continue;
  }

  kill.push({ ...p, ageMin, fp, why: runaway ? `runaway ${p.cpu}s cpu` : `stranded ${Math.round(ageMin / 60)}h` });
}

// Deepest first, so a wrapper never outlives the child it was waiting on.
kill.sort((a, b) => b.started - a.started);

/* ---------- act --------------------------------------------------------- */

const short = (c) => String(c || '').replace(/\s+/g, ' ').trim().slice(0, 100);
const fmt = (k) => `  ${String(k.pid).padEnd(6)} ${base(k.name).padEnd(7)} ${String(Math.round(k.ageMin) + 'm').padEnd(7)} ${k.why || ''} [${k.fp}]  ${short(k.cmd)}`;

if (VERBOSE) for (const s of skipped) console.error(`  skip ${s.p.pid} ${s.p.name} — ${s.r}`);

const report = [];
if (kill.length) {
  report.push(`reap-orphans: ${DRY ? 'would kill' : 'killed'} ${kill.length} stranded process(es) from dead Claude sessions:`);
  report.push(...kill.map(fmt));
}
if (warn.length) {
  report.push(`reap-orphans: ${warn.length} dev server(s) running over 24h, left alone (kill by hand if stale):`);
  report.push(...warn.map(fmt));
}

// Shown whenever this speaks up, so the hook is never a mystery setting.
const FOOTER = 'reap-orphans: this is a SessionStart hook — delete the block from ~/.claude/settings.json any time to turn it off.';

if (!kill.length && !warn.length) {
  if (DRY) console.log('reap-orphans: nothing to reap.');
  process.exit(0);                               // hook mode: silent when clean
}

if (DRY) {
  console.log([...report, FOOTER].join('\n'));
  process.exit(0);
}

if (kill.length) {
  try {
    const ids = kill.map((k) => k.pid).join(',');
    execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
      `Stop-Process -Id ${ids} -Force -Confirm:$false -ErrorAction SilentlyContinue; exit 0`],
      { encoding: 'utf8', windowsHide: true, timeout: 20000 });
  } catch (e) {
    report.push(`reap-orphans: kill failed — ${e.message}`);
  }
}

try {
  mkdirSync(dirname(LOG), { recursive: true });
  appendFileSync(LOG, `\n[${new Date().toISOString()}]\n${report.join('\n')}\n`);
} catch { /* logging must never break a session */ }

console.log([...report, FOOTER].join('\n'));
