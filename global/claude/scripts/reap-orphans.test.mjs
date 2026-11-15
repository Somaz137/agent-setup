/**
 * Rule assertions for reap-orphans.mjs.
 * Command lines below are verbatim from the 2026-09-04 incident on this machine.
 * Run: node reap-orphans.test.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'reap-orphans.mjs'), 'utf8');
const grab = (n) => {
  const m = src.match(new RegExp('^const ' + n + ' = (/.*/[a-z]*);', 'm'));
  if (!m) throw new Error('could not find const ' + n);
  return new Function('return ' + m[1])();
};
const PROTECTED = grab('PROTECTED');
const CLAUDE_PATH = grab('CLAUDE_PATH');
const REAPABLE = grab('REAPABLE');

const B = String.fromCharCode(92); // backslash, kept out of literals

// [label, processName, commandLine, mustBeProtected]
const cases = [
  ['next dev listener',        'node',   'C:' + B + 'proj' + B + 'node_modules' + B + 'next' + B + 'dist' + B + 'server' + B + 'lib' + B + 'start-server.js', true],
  ['next dev bin',             'node',   'node node_modules' + B + '.bin' + B + '..' + B + 'next' + B + 'dist' + B + 'bin' + B + 'next dev', true],
  ['npm run dev',              'node',   'node npm-cli.js run dev', true],
  ['turbopack worker',         'node',   'node C:' + B + 'proj' + B + '.next' + B + 'dev' + B + 'build' + B + 'chunks' + B + 'pool_entry.js 54075', true],
  ['dev server in scratchpad', 'node',   'node C:' + B + 'Temp' + B + 'claude' + B + 'proj' + B + 'uuid' + B + 'scratchpad' + B + 'site' + B + 'node_modules' + B + 'next' + B + 'dist' + B + 'bin' + B + 'next dev', true],
  ['vite',                     'node',   'node /c/proj/node_modules/vite/bin/vite.js', true],
  ['the runaway find',         'find',   'find.exe / -name card-states.png', false],
  ['stale http.server',        'python', 'C:' + B + 'Python314' + B + 'python.exe -m http.server 8791', false],
  ['tail watcher',             'tail',   'tail.exe -f C:' + B + 'Temp' + B + 'claude' + B + 'proj' + B + 'uuid' + B + 'tasks' + B + 'x.output', false],
  ['grep watcher',             'grep',   'grep.exe -E --line-buffered CRITICAL|HIGH', false],
  ['stranded bash',            'bash',   'bash.exe -c source /c/Users/User/.claude/shell-snapshots/snapshot-bash-123.sh', false],
  ['stale mcp',                'node',   'node _npx' + B + 'x' + B + 'node_modules' + B + 'chrome-devtools-mcp' + B + 'build' + B + 'src' + B + 'bin' + B + 'chrome-devtools-mcp.js', false],
];

let fails = 0;
for (const [label, name, cmd, mustProtect] of cases) {
  const prot = PROTECTED.test(cmd);
  const reapableName = REAPABLE.test(name);
  const ok = prot === mustProtect && reapableName;
  if (!ok) fails++;
  console.log(
    (ok ? '  PASS  ' : '  FAIL  ') +
    (mustProtect ? 'expect protect ' : 'expect reap    ') +
    '-> ' + (prot ? 'PROTECTED' : 'reapable ').padEnd(10) +
    label
  );
}

// The claude fingerprint must catch the paths the incident processes carried.
const fpCases = [
  ['shell-snapshot path', '/c/Users/User/.claude/shell-snapshots/snapshot-bash-1.sh', true],
  ['temp scratchpad',     'C:' + B + 'Temp' + B + 'claude' + B + 'proj' + B + 'uuid' + B + 'scratchpad', true],
  ['ide extension',       'extensions' + B + 'anthropic.claude-code-2.1.259' + B + 'claude.exe', true],
  ['unrelated user path', 'C:' + B + 'Users' + B + 'User' + B + 'OneDrive' + B + 'Desktop' + B + 'x', false],
];
for (const [label, cmd, want] of fpCases) {
  const got = CLAUDE_PATH.test(cmd);
  const ok = got === want;
  if (!ok) fails++;
  console.log((ok ? '  PASS  ' : '  FAIL  ') + 'fingerprint ' + (want ? 'yes' : 'no ') + '    -> ' + (got ? 'matched  ' : 'no match ') + label);
}

const total = cases.length + fpCases.length;
console.log(fails ? '\n' + fails + ' of ' + total + ' FAILED' : '\nall ' + total + ' rule assertions pass');
process.exit(fails ? 1 : 0);
