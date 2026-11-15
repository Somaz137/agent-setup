# Standing instructions for every project

These apply to all sessions on this machine, in any project.

## At the start of every session

Before your first action, invoke the `superpowers:using-superpowers` skill.

The Antigravity editor (and other embedded IDE harnesses) load plugin skills but
do not run plugin start-up hooks, so the superpowers auto-load has to be
triggered from here instead. In a plain terminal session the plugin's own
SessionStart hook already does this, and invoking again is harmless.

## Task observer — invoke on a trigger, not every session

Do NOT auto-load `task-observer` at session start; loading its ~8K-token
SKILL.md into every session is not worth it. Instead invoke `task-observer`:

- when opening or merging a PR, or otherwise wrapping up a unit of work, so
  it can do a retrospective pass over the session that is still in context
  and log any observations;
- whenever I explicitly ask for it, mention the observation log, a skill
  review, or skill improvements.

The single global observation workspace is `~/.claude/skill-observations/`
— always anchor there, never on a per-project path (that silently forks the
log, which is what happened before: 7 separate logs, one per project).

## Vetting third-party skills, plugins, and MCP servers

Before installing anything from outside this machine — a skill, a plugin, an
MCP server — or whenever asked to audit what is already installed, scan it
first with SkillSpector (`NVIDIA/SkillSpector`, on PATH as `skillspector`,
installed under the Python 3.13 at
`%USERPROFILE%\AppData\Local\Programs\Python\Python313`; the Python 3.14 build
can't compile its `yara-python` dependency):

```
skillspector scan <path-or-git-url> --no-llm        # one skill
skillspector scan <dir-of-skills> -r --no-llm       # a directory of skills
```

`--no-llm` is required here: no LLM API key is configured, so the semantic
analyzers are skipped either way and the flag just silences the warnings.
Read the risk score and every HIGH / CRITICAL finding, and report them to me
before installing — never install silently past a finding.

## Design references

When building or reskinning a website, app, or any UI, check
`github.com/VoltAgent/awesome-design-md` for a `DESIGN.md` matching the brand
or an adjacent aesthetic before inventing design tokens from scratch. It is a
browsable library of ~70 brand design systems (colour, type, spacing,
components, dark-mode) in plain markdown. Use it as a reference and starting
point, not a drop-in dependency — nothing to install.

## How to answer

Give direct, evidence-based answers. Do not be a "yes man".

- Lead with a clear verdict (yes / no / recommendation), then the facts that
  support it. No option surveys when a recommendation is possible.
- Back claims with concrete evidence: file contents, command output, numbers.
- If a fact has not been checked, say so. Never fill gaps with plausible-
  sounding guesses.
- When asked to evaluate something I appear to want, still say no if the facts
  say no.
- Skip flattery and filler.

## Clarifying plans

When brainstorming, planning, or clarifying a design (including the
"ask clarifying questions" step of `superpowers:brainstorming`), use the
`grilling` skill's method for the questioning: model the plan as a design
tree and work it in rounds, asking the whole currently-answerable frontier
per round as numbered questions each with a recommended answer, looking up
facts myself rather than asking. Keep the rest of the brainstorming
workflow (path classification, the approval gate, spec/plan handoff) as-is.

## Building websites

Any request to build, plan, design, verify or ship a website, landing page,
demo site, outreach sample or client site — for a gym, salon, boutique, clinic,
restaurant, retail or any local business — runs through the `website-pipeline`
skill. Invoke it explicitly rather than relying on description matching; the
retro, the gates and the vault logging all live inside it, and none of them
happen if the skill is never loaded.

**Every such run ends with `node scripts/close-run.mjs --sync`.** It exits
non-zero unless the build log carries an entry dated today, so a run cannot be
reported as finished without one. `--sync` also carries any improvement made to
`gates.mjs` / `shots.mjs` / `verify-deploy.mjs` inside the project back into the
skill, so the next build inherits the fix instead of rediscovering the defect.
Report the retro entries to me at the end rather than only writing them.

## Long-running processes

Learned 2026-09-04: an unbounded `find /` from a previous session ran 26 hours
at ~100% of a core, alongside two detached servers, four watchers and five
stranded shell wrappers. Nothing cleaned them up because nothing tracked them.

- **Never run an unbounded filesystem search.** No `find /`, no `find ~`. Bound
  it to the project directory, add `-maxdepth`, wrap it in `timeout 30`. If you
  don't know where a file is, use Glob or Grep — they are indexed and bounded.
- **Never detach a process.** No `(cmd &)`, no `nohup` — that deliberately
  hides it from the harness, so nothing can stop it when the session ends. Use
  the Bash tool's `run_in_background`, which stays tracked and killable.
- **Every watcher gets an explicit stop.** A `tail -f`, a `--line-buffered`
  pipe, or a poll loop is killed by PID the moment its task finishes. Prefer
  the Monitor tool, which the harness owns, over a hand-rolled tail.
- **Confirm the resource the NEXT step needs — not the stop call, and not
  whichever one you happened to be tracking.** A tracked `npm run <script>`
  task is the `npm` process, not the `node` server it spawned — stopping it
  can leave the real listener orphaned while the tool reports success. Probe
  what the process actually held (the port, the PID) before reporting it
  stopped, and launch the direct command (`node tools/serve.js`) when a
  reliable stop matters. But a freed port says nothing about open file
  handles: learned 2026-09-19, the port was confirmed free on every rebuild
  cycle while the build kept failing on `EPERM: unlink .next/static/<hash>`.
  Processes hold several resources independently, so name the one the next
  operation contends on and observe *that*.
- **A lock can be held by a party outside the session's causal story.** On a
  project path under a sync client (OneDrive, Dropbox, iCloud Drive) or a
  desktop indexer, file handles are held by a process this session never
  started, on a schedule it cannot see. Every conclusion drawn from the
  process tree is then sound and useless at once, and the standard instinct
  — hunt for stray `node` processes — burns cycles finding hours-old
  unrelated ones. When an artefact directory throws EPERM/EBUSY, **delete the
  directory rather than diagnose the holder**, and prefer a project path
  outside a synced folder for any repo with a hot build output.
- **Check for a supervisor before killing anything to reclaim resources.** A
  Windows service, scheduled task, systemd unit or container restart policy
  respawns what you killed, often larger. A mixed access-denied result across
  one program's processes is the tell: the part you cannot kill is the part
  that restarts the rest. Report the supervisor as the blocker instead.
- **Say what you left running**, with its port, at the end of the turn.
- `~/.claude/scripts/reap-orphans.mjs` (SessionStart hook) is the safety net,
  not the plan. It covers interpreters, coreutils and — since 2026-09-07 —
  shell wrappers (`cmd`, `powershell`, `pwsh`, `conhost`) on strict evidence
  only: dead parent AND age AND >=30s CPU. Inspect with `--dry-run`; it never
  kills a live session's processes. **"Nothing to reap" is not proof nothing
  is stranded** — its match list is a list of what someone thought of.

## Workflow rules

These are the surviving home for lessons that belong in `superpowers`
plugin skills — which live in a version-pinned plugin cache and lose any
in-place edit on the next update. Folded in from the 2026-09-03 and
2026-09-07 skill reviews; the parenthetical is the source skill and
observation. Longer procedural content for these same lessons — worked
examples, regex shapes, multi-step sweeps — lives in the companion
`superpowers-extras` skill, not here; **load `superpowers-extras`
immediately after loading any of verification-before-completion,
test-driven-development, writing-plans, executing-plans,
subagent-driven-development, systematic-debugging, or
dispatching-parallel-agents** — it supplements exactly those seven and is
never auto-loaded on its own.

- **Resolve deliverable shape before presenting a design** (brainstorming,
  D-0001). Artifact form (single file / folder / patch), destination path,
  and relationship to existing work (replaces / extends / sits beside) are
  clarifying questions, not assumptions — most of all when the task is
  framed as "like last time, but for X".
- **Spec edits: grep, don't eyeball** (brainstorming, D-0002). After
  changing any pinned value in a spec or plan, grep the whole document for
  the old literal (require zero hits) and check every occurrence of the new
  one. "Read it through for contradictions" does not catch a table cell
  that disagrees with prose six sections down.
- **Offer to collapse redundant controls early** (brainstorming, L-0007).
  When a design has two or more controls encoding the same fact — so they
  can disagree — present "make them one" as an explicit option before
  spec'ing rules for each combination. Writing a reconciliation rule for
  every A/B pairing is the tell that the two should be one.
- **Parallel work is bounded by the whole mutable surface, not just source
  files** (subagent-driven-development / writing-plans, G-0001). Subagents
  in one working tree also contend on the build output dir (`.next`,
  `dist`, `target`), the dev-server port, and the git index — even with
  disjoint source files. Default to serial unless each agent gets its own
  worktree + build dir + port. On Windows, serial.
- **Match review effort to the defect class it can catch** (subagent-driven-
  development, G-0002). For presentational / marketing / static work,
  default to controller-side diff spot-checks plus one consolidated review
  at the end. Reserve a dedicated reviewer subagent + fix loop for tasks
  carrying real logic, shared state, data integrity, or security surface.
  Decide it per task, the same way model tier is decided.
- **A brief's verbatim test and verbatim fixture can contradict each other**
  (executing-plans / writing-plans, L-0008). When a brief pins both an
  assertion and the data it runs against, mentally execute the assertion
  over the literal fixture before trusting the predicted pass/fail — watch
  greedy `[^"]*` / `.*`. Resolve the contradiction toward the brief's
  intent with a semantically-inert edit (e.g. reordering commutative
  config), get to green, and flag it in the report.
- **Verify the deployed artifact from its public URL** (verification-before-
  completion, G-0004; see the `shipping-artifact-verification` skill). A
  green build and 200 responses are not a verified deploy. After any deploy
  to a new or changed domain, fetch from the live origin and confirm the
  real domain in `robots.txt`, `sitemap.xml`, and `<link rel="canonical">`
  / `og:url` / `og:image` / feeds. Build-time env vars (`NEXT_PUBLIC_*`,
  `VITE_*`, `PUBLIC_*`, Hugo `baseURL`) need a rebuild, not a restart.
- **A check you have not seen fail is not a check** (verification-before-
  completion / test-driven-development, obs-0010/0014/0044/0045). A suite
  that has only ever been observed passing carries no information — prove
  it can fail on the specific defect it targets before reporting it as
  evidence, and confirm the deliberate break actually landed before trusting
  a failure (or a surviving pass). For anything meant to be reused, prove it
  against an input of a different *shape*, not just different values. Full
  method — inverting the fix in build output, verifying the break landed,
  the shape-testing rule — is in `superpowers-extras`.
- **A defect execution catches in the plan must be written back to the
  plan** (writing-plans / executing-plans / subagent-driven-development,
  obs-0041, escalation obs-0012, estimate case obs-0015). Fixing the code
  and leaving the plan document wrong turns the plan into a trap for its
  next run. When a fix targets a defect the codebase already flagged once
  in a comment or prior fix, that recurrence means the comment already
  failed as a countermeasure — add a machine check, not a fourth comment.
  An estimated number written into a plan must not be restated as a
  measurement in a shipped comment or report until it has actually been
  measured. Details and the labeling convention are in `superpowers-extras`.
- **A project's headline success criterion needs its own verification gate**
  (writing-plans / verification-before-completion, obs-0042). Generic gates
  (tests, lint, a11y, Lighthouse, review) are domain-agnostic by
  construction and cannot test the one claim a project exists to satisfy —
  passing all of them is not evidence for a claim none of them checks. Write
  every success criterion as an executable check or strike it.
- **A compound shell command can silently re-widen a permission allowlist**
  (`fewer-permission-prompts`, obs-0017). Chaining verification commands
  with `&&` or pipes matches none of the narrow exact-form entries the
  skill just wrote, so the harness prompts and records the approval at
  wildcard granularity — undoing the exact-form tightening the skill exists
  to produce. Run verification commands as separate calls when a narrowed
  allowlist matters, and re-read the settings file at the end of a session
  that just tightened it to confirm no broad pattern reappeared.
- **Separate a blocked endpoint from a bad credential before blaming
  either** (systematic-debugging, obs-0019). An unfamiliar credential
  format and an auth-call failure both look like evidence against the
  credential; neither is. Read the exception *type*, not its message — a
  connect/TLS/timeout class is transport and no credential fix touches it.
  Probe the endpoint host directly before touching the credential.
