---
name: superpowers-extras
description: Supplements superpowers verification-before-completion, test-driven-development, writing-plans, executing-plans, subagent-driven-development, systematic-debugging, and dispatching-parallel-agents with delta rules learned in later sessions. Load it right after loading any of those skills, or whenever writing/proving a test assertion over structured text (regex, HTML, config, logs), writing or executing a multi-step plan, debugging an integration or credential failure, testing code meant for reuse across differently-shaped inputs, running a long parameter sweep, or dispatching two or more agents into one working tree.
---

# superpowers-extras

## Why this file exists

The `superpowers` skills this file supplements live in a version-pinned
plugin cache (`plugins/cache/superpowers-dev/superpowers/<version>/skills/`).
That directory is writable but **volatile**: an in-place edit to one of its
`SKILL.md` files is silently discarded the next time the plugin updates, with
no error and no warning. Lessons learned from using those skills therefore
cannot be folded back into them directly — they need a home that survives an
update and that something actually loads. This skill is that home. It is
organized by the upstream skill it patches; when you finish loading one of
those skills, or start doing the kind of work its section header names, read
the matching section here before continuing.

Every rule below was learned the hard way, in a real session, and then
generalized until it no longer refers to any specific project, client, or
codebase.

---

## Supplements: verification-before-completion / test-driven-development

### A check you have not seen fail is not a check

The single most common way a suite ships wrong: it is written, run once,
comes back green, and reported as evidence — without ever having been shown
capable of failing. Green on a first run is consistent with an assertion
that can never fail (a selector that silently returns absent, a check
written against the already-fixed output, a timing window that always
settles the same way) exactly as much as it is consistent with a real,
working check. There is no way to tell the two apart from the passing run
alone.

Before reporting any post-hoc verification suite (one written after the fix
already exists, which is the normal case for browser, visual, and
integration checks — TDD's "watch it fail first" doesn't apply because there
was no pre-fix moment to write it in) as evidence:

1. **Aim the assertion at the defect's signature, not at the remedy's
   mechanism.** Before manufacturing anything, name the defect the check
   exists to catch, then ask whether the assertion is phrased around that
   defect or around the fix. A check written in terms of the invariant the
   fix establishes — no key carries the marker the new strip removes, every
   record passes the new validator — reads as testing the contract and feels
   more rigorous than one phrased around the symptom, but it can only fail
   if the fix's own machinery regresses: the one failure mode nobody expects
   and nobody is about to cause. That is a fix-integrity check, not a
   regression check, and it stays green through every reintroduction of the
   original defect. When the fix *is* a convention, the convention's absence
   is the new defect, and a check that looks for the convention cannot see
   it — the unmarked instance walks past the assertion untouched. So the
   deliberate break below must reintroduce the defect **in its original
   form**, not violate the fix's convention.
2. **Manufacture a failure that targets the defect**, and confirm the
   failure text names the actual symptom, not just "false" or "1 failed".
3. **Prefer breaking the build output over the source.** Where build
   artifacts are gitignored and regenerable (a `dist/` from one build
   command, a rendered HTML file, a compiled bundle), invert the fix there —
   delete the CSS rule, revert the one JS expression — rerun the suite, then
   regenerate a known-good copy. The source tree is never touched, so there
   is nothing to accidentally commit and no risk of leaving the break in
   place.
4. **Verify the break actually landed before interpreting the result.** A
   deliberate break is itself an action that can silently fail — an
   unanchored `String.replace()` / `sed s///` can hit an earlier, unrelated
   occurrence of the same literal text in a large file and leave the
   intended target untouched. If a break produces *no* failure, the first
   hypothesis is always "the break did not land" (`git diff --stat`, `sed -n`
   the mutated region, echo the replaced text — confirm the mutation is
   present) — never "the assertion is too weak". Weakening a correct
   assertion because an unverified break survived it is worse than never
   running the check at all: it ends with an assertion that no longer
   targets the defect, plus a false belief that it was validated.
5. **Choose the break from the words in the assertion's own name**, not from
   whatever is easiest to break. Deleting the subject of a check only tests
   that the check detects *absence*. A check that claims something about
   *placement* — inside this block, under this breakpoint, in this position
   relative to something else — is almost never falsified by deletion; it
   has to be falsified by **relocating** the subject somewhere the check
   should reject. Every noun in a check's description that a deletion-only
   break leaves unexercised is a property still untested.
6. **For anything meant to be reused** (a template, a kit, a scaffold, a
   component driven by a collection), a reuse claim is proven only by a
   second instance whose input **shape** differs — not just its values.
   Code and its sample data are usually authored together, so the code
   silently absorbs the data's shape: how many items a collection holds,
   which item is first, that a collection is non-empty at all. Swapping a
   brand name or a color never exposes this; only an empty collection, a
   single-item collection, and a collection roughly double the expected size
   will. Grep candidates for the tell: a hardcoded `grid-cols-N` (or
   equivalent) over a collection, or any literal index into one
   (`items[0]`, `.slice(1, 4)`).

**Principle:** a check that has only ever been observed passing carries no
information. It becomes evidence only once it has been observed failing for
the reason it exists — and the deliberate failure that produces that
evidence has to be verified itself, aimed at the exact property the check's
name claims, before its result means anything. A landed break plus a green
run is not a clearance; when the assertion is aimed at the remedy rather than
at the defect, it is an indictment.

### A parameter you have not seen change the output is not a parameter

The rule above governs the *check*. This one governs the *input*: a suite can
satisfy the first completely — every assertion in it proven capable of
failing — while a configured value feeding it is structurally dead and
nothing notices.

For any artifact built from **multiple additive or weighted contributions** —
a controller's gains, a scoring function's weights, a composite loss, a
ranking formula, a fee or discount stack — a working whole is not evidence
that every part works, because one sufficient component masks a dead sibling
perfectly. Tests of the whole cannot see a term multiplied by zero; unit tests
of the components cannot either, since each component is individually correct;
and reading cannot, because the line computing the dead term is exactly what a
correct implementation looks like — the defect usually lives in the state that
reaches the expression (two variables differenced after both were assigned the
same value on the same tick) rather than in the expression itself.

The only cheap detector is perturbation. Move one contribution *alone* to an
absurd value — several orders of magnitude, both signs — and require the
output to move. Bit-identical output across that sweep means the parameter is
decoration. Do this before porting a configured value to a second
implementation, before tuning it, and before citing it as a baseline: a dead
term is silently harmless in the implementation it was tuned in and changes
behavior in the one it is copied to, while every artifact still claims the two
are equivalent.

### Assertions over serialized text assert less than they read

Two closely related regex shapes read as structural checks and are actually
weaker:

**A lazy wildcard between two markers asserts order, never containment.**

```js
// looks like: "A sits inside OPEN...CLOSE"
/OPEN[\s\S]*?A[\s\S]*?B/.test(text)
```

`[\s\S]*?` matches any characters including the closing delimiter. This
pattern only ever proves "these strings appear in this order somewhere in
the document" — never that any of them are nested inside `OPEN`. It reads
like a containment assertion and executes as a sequence assertion, and the
two produce identical results on every well-formed passing case, which is
exactly why it survives review and keeps passing after the element it
"checks" is moved entirely outside the container.

Fix: capture the container's own span first, then assert over the captured
group only.

```js
const region = (text.match(/OPEN([\s\S]*?)CLOSE/) || ["", ""])[1];
region.includes("A") && region.includes("B") &&
  region.indexOf("A") < region.indexOf("B")
```

(This is only sound if the container has no nested occurrence of its own
closing delimiter before the real one — say so in a comment next to the
regex, since a later nested element would silently truncate the captured
region.)

**An open-ended tail slice is not a scope — it runs from the first marker to
end-of-file.**

```js
// looks like: "the region under this marker"
text.match(/MARKER[\s\S]*/)  // or without /g
```

Two independent faults hide here, both invisible on the passing case:
`[\s\S]*` has no end, so the "scope" is everything after the marker to EOF —
often 90%+ of the file; and `.match()` without `/g` takes the *first*
occurrence of `MARKER`, which in a long stylesheet, config, or log is rarely
the one meant. The check therefore proves "this appears somewhere in most of
the file" while reading as "this appears under this specific section" — and
survives moving the checked rule into an *earlier*, wrong section as easily
as the correct one.

Fix: pin both ends of the extracted region, and make the marker unique or
explicitly disambiguated (index into all matches, not the first).

For both shapes, when proving the assertion can fail: **relocation**, not
deletion, is the break that exercises the property actually being claimed —
deleting the subject only proves the check notices its absence.

**Principle:** an assertion's English name and its operational content drift
apart exactly where the two happen to agree on every passing input — which
is every input the author tried. Deliberately violating the *named*
property (move it, don't delete it) is what separates a real structural
check from a sequence check wearing its name.

### A missing dependency is a to-do, not a verification ceiling

"Cannot be verified here" is sometimes recorded as a permanent status for a
GUI- or hardware-dependent script and then carried forward across sessions
unchallenged. Before accepting that status, check two things: does the
missing dependency actually install, and does the interactive layer have a
headless mode — `SDL_VIDEODRIVER=dummy`, `MPLBACKEND=Agg`, `xvfb-run`,
`--headless`, `CI=1`. Run it under a bounded `timeout`; for a script with no
natural exit, hitting the timeout while doing real work (not crashing
immediately) is itself a pass signal. An unverified status inherited through
a handoff never re-examines itself on its own — it has to be attacked at the
moment it's read, not trusted because a prior session already tried.

### A baseline probe must not mutate the tree it is probing

Deciding whether a lint, type, or build error pre-exists a change invites
`git stash && <check> && git stash pop` — a stateful operation on the working
tree, run purely to observe it. It can fail mid-flight (a case-only path
collision on a case-insensitive filesystem, a permission error removing a
directory), leaving the stash created and the tree partially reset, deleting
real files on the way out and turning recovery of the change into its own
task. The observation was free; the probe was not.

Every baseline question has a read-only answer: run the check against
`git show HEAD:<path>`, or in a second worktree or clone; reason from the diff
or `git blame`, since an error on a line the change never touched is
pre-existing by construction; or scope the check to the changed files only,
which is usually sufficient on its own. Reserve tree-mutating operations —
`git stash`, branch switches — for when mutating the tree is the actual goal.

**Principle:** a verification step must not be able to damage the thing it is
verifying. When the goal is only to observe a baseline, prefer read-only
inspection over any operation that writes.

### Run a sweep's riskiest configuration first

When a script loops over N configurations and only some of them exercise
code paths the others don't (a runtime patch, an option only one
configuration sets, a branch guarded by `if x != default`), that guard is
the tell: it makes the risky path completely untested by every "default"
configuration that runs before it. A crash in configuration 7 of 20 destroys
the tail of the run and forces a partial redo, while the six configurations
that already succeeded said nothing about the crashing path's soundness.
Order is a verification decision: run the most mechanically unusual
configuration first as a smoke case, or exercise every distinct code path
once against a trivial workload before starting the expensive loop. Work
that fails late costs everything computed before it.

### Pair every headline claim with its own gate

Generic quality gates — unit tests, lint, accessibility, Lighthouse, code
review, design/craft review — check properties that are domain-agnostic by
construction. That's what makes them reusable, and it's exactly what
guarantees none of them can test the one claim a given project actually
exists to satisfy. A project whose stated purpose is "reskinnable in 15
minutes", "restores from backup in under an hour", "runs offline", or
"handles 10k rows" can pass every generic gate at 100% while failing its own
purpose outright — and the more generic gates it passes, the more false
confidence accumulates, because passing many gates that don't test the claim
is not evidence for the claim.

Before writing a success criterion into a plan or spec, phrase it as an
*executable check* — a command, a grep, a concrete procedure with a
pass/fail result — or strike it. A criterion nobody can run is a wish. Before
claiming a project done, re-read its stated purpose and name which command
proved it; "the generic gates passed" is a gap, not an answer. For a claim
of the shape "X can be swapped without touching Y", the check is to actually
perform the swap and rebuild — not to inspect the code and judge it
swappable.

### A newly written check must be shown a known defect before it is trusted

The same red-before-green discipline TDD applies to unit tests applies to
lint rules, CI gates, and detectors — and is skipped more often there,
because a check is usually written, then only *read*, and reading a check
you just wrote shows you the intent you meant to encode, not the behavior
you actually encoded. Both failure directions are silent: a false negative
reports green on a live defect and manufactures confidence; a false positive
trains whoever reads the tool's output to ignore it, which quietly disables
every true finding it will ever produce. This bites hardest exactly when a
detector is written *from* an already-enumerated defect list — that list
creates a strong feeling of coverage, which is precisely the situation where
verifying the detector feels least necessary.

Before trusting any new check: run it against an input already known to
violate it and confirm it goes red for the stated reason. If a defect list
already exists, that list *is* the fixture — assert the expected verdict per
item, not just "the script ran without error". Watch specifically for
naming mismatches between the artifact and the thing it references (a
package named one way in `package.json`, spelled differently in prose or
docs) and for import channels a scan doesn't cover (a dependency pulled in
via `@import` rather than a JS/TS import, say) — both produce silent misses
that read as coverage.

### A report of passing results omits the denominator

A status report assembled from results can only enumerate the checks that ran,
because a check that never ran produces nothing to enumerate. "Every check I
ran passed" and "every check passed" are then the same sentence, and the
difference is invisible precisely to whoever wrote the report: they see the
checks they reached for, not the ones they never reached for. The reader
cannot recover the second set from the first, so a verification summary
without a denominator is unfalsifiable — it reads identically whether coverage
was complete or a third of the defined checks were never invoked.

Print the denominator: *checks run / checks defined*, with the unrun ones
named. A check that has no runner written yet is reported NOT RUN, never
omitted — a named check whose dependency is already installed is the most
deceptive state of all, because the name plus the dependency read as coverage.
Derive the defined set from the process definition (the plan, the spec, the
skill that names the checks) and diff it against evidence on disk — the
artifacts each check is specified to produce — so the unrun set is computed
rather than recalled. A completion claim states what was checked *and* what
was not.

**Principle:** coverage is a property of the denominator, and a report of
passing results is indistinguishable from complete coverage. This is "absence
of a finding is absence of a check" one level up: there the silence sits
inside one scanner's rule set, here it sits across the whole list of checks
the work was supposed to pass.

---

## Supplements: writing-plans / executing-plans / subagent-driven-development

### A plan is a living document, not a historical record

When execution discovers the plan itself is wrong — an internal
contradiction, a violated constraint stated elsewhere in the same document,
a stale version pin — the natural move is to fix the *code* and move on.
That leaves the plan carrying the defect. This is invisible at the time
because the shipped artifact is correct and every check that compares code
against reality comes back green; it becomes visible only when the plan is
re-run, at which point the same defect reintroduces itself, silently, into
a second build.

When a task deviates from the plan for any reason other than a one-off
environment quirk, edit the plan in the same change as the code, and note
why. A plan that may be re-run or reused is a durable artifact, and a plan
left contradicting its own stated constraints is a latent bug in waiting,
not documentation of what happened once. Pair this with the existing
grep-don't-eyeball discipline: after the write-back, grep the plan (and any
spec it derives from) for the old literal and require zero hits.

That discipline covers a changed *value* and is powerless against a changed
*ordinal*. Inserting, deleting or reordering a numbered task shifts every
ordinal after it, and the cross-references it invalidates — "CREATE (Task 8)",
"see Task 9" — are indistinguishable from valid text, because each still names
a task that exists. A zero-hit grep for the old literal can never be satisfied
and a non-zero result proves nothing; reading through for contradictions
catches none of it either, since every individual reference is well-formed. So
after any edit that shifts positions, enumerate the numbered headings and
every cross-reference to them and compare the two sets mechanically instead of
rereading. Prefer stable anchors to ordinals when authoring, so a reference
survives renumbering, and qualify every cross-*document* ordinal with its
document ("the predecessor plan's Task 9") — that reference turns ambiguous
the moment the current plan also has a Task 9. Ordinals are positional
identifiers wearing the costume of stable ones.

### An estimate must be labeled at birth, or it becomes a false measurement downstream

A number derived arithmetically during planning (a layout will overflow at
this width; a batch will finish in about this long) is a legitimate basis
for allocating work. The failure isn't making the estimate — it's that
nothing marks it *as* an estimate, so nothing at execution time flags it as
needing measurement before being restated as fact. The number then gets
copied, often nearly verbatim, into a code comment, a doc, or a completion
report — an artifact whose register is "this is how it is" — and ships
wrong, sometimes wrong a second time after a later requirement change shifts
every number the estimate depended on.

Mark estimated quantities as such at the point they're written — a bare
convention like `(est.)` or "predicted, measure before relying on this" —
and name the measurement that would settle them. On the execution side: a
value carrying that mark may justify *doing* the work, but may not be
restated in code, comments, docs, or a completion report until it has
actually been measured. Either measure it and write the measured value, or
keep the justification and drop the number. Removing scope (a field, an
icon, a column) invalidates every derived estimate downstream of it and
re-arms this — a mid-execution requirement change is exactly when a stale
estimate gets carried forward unchecked.

### A trap the codebase has already documented needs a machine check, not another comment

When a fix targets a defect the codebase has already flagged — a comment, a
changelog line, a prior fix naming the same mechanism — that flag having
been written and the defect recurring anyway is evidence the chosen
countermeasure (a comment) doesn't work, not evidence that this occurrence
just needs one more comment. A comment only reaches a reader already looking
at that exact line; it cannot reach whoever adds the next occurrence
somewhere else in the file, which is precisely who reintroduces the bug.

The second occurrence of any documented trap is where "add a check" becomes
the default and "add another comment" becomes the exception that needs
justifying. When a plan's own context section cites prior occurrences of a
defect, the plan must carry an explicit enforcement task, not only the fix —
and the count of prior occurrences (found by sweeping the artifacts below)
is what justifies that enforcement over one more comment.

Don't assume the natural check (a browser test, a type system, a build
step) is unavailable just because the codebase is otherwise
dependency-light. A textual assertion over the source or config file —
grepping for the pattern that must (or must not) be present — is nearly
always available and nearly always sufficient, even when it feels like a
weaker substitute for "the real thing".

### Derive a recurring-mistakes document from artifacts, not from memory

Asked to write down "the mistakes we keep hitting" for a project, the
default move — writing from conversation memory — produces a list of the
current session's mistakes plus generic best-practice filler, which is
exactly the kind of document a later session learns to skip, because none of
it is anchored to anything verifiable.

A project's actually-repeated mistakes are already recorded, scattered
across artifact types nobody reads together. Sweep, in order:

- **Defensive comments in the source** — grep for hedge language
  (`already cost`, `used to`, `never`, `silently`, `do not`) to surface
  documented traps directly, sometimes naming an earlier victim by class.
- **Prior code-review findings**, stored or otherwise — finding classes that
  recur (an invented precedent in a comment, a load-order guarantee that
  didn't hold, stale docs) that no single session would recall unprompted.
- **Fix-commit clusters in version-control history** — a repeated `Fix
  <same area>…` pattern across months reveals a workflow trap that any one
  occurrence would look like a one-off.
- **A prior observation/lesson log's own archive**, if one exists — already
  the durable form of past lessons, and it usually maps close to
  one-to-one onto the sections a new document needs.
- **A doc that exists only because something went wrong** — its mere
  existence is the evidence.

That sweep routinely produces several times as many citable entries as
session memory alone would. And placement matters as much as content: a
reference document nobody is told to read is inert — point to it from
whatever file the harness loads automatically every session, not only from
a README index, and have the document say in its own text that new traps
get added to *it*, not left as a source comment.

### Pairing rule: prior-occurrence counts justify enforcement

The three rules above compose: an execution-time correction that only fixes
code and not the plan (above) is exactly the kind of thing that, uncaught,
becomes a "the codebase already warned about this" trap on its second
occurrence (above) — and the artifact sweep (above) is how you find out it's
the second occurrence rather than the first, before deciding whether a
comment is still enough.

---

## Supplements: systematic-debugging

### Separate a blocked endpoint from a bad credential before blaming either

When an integration call fails right after a credential is (re)configured,
two circumstantial facts make the credential look guilty almost
automatically: an unfamiliar format (missing a vendor's usual prefix,
unexpected length) and the fact that the failing call happens to be an
authentication call. Neither is evidence. A rejected credential returns a
structured error *from* the server (401/403), which requires reaching the
server in the first place — a transport failure (connection refused, TLS
handshake failure, timeout) never gets that far, and most client libraries
wrap transport and auth failures under one call, so the layer that actually
failed is invisible unless the exception *type* is read rather than its
message text.

Before touching the credential: read the exception type, not just the
message — a connect/TLS/timeout class is transport, and no amount of
credential work fixes it. Probe the exact endpoint host directly (and a
sibling host on the same domain, such as the vendor's console vs. its API
endpoint) before touching the credential at all; one hostname probe rules
out the entire credential branch for the cost of a single command. Treat any
surface oddity in the credential as *not yet evidence* until reachability
has been established — a plausible-looking culprit that arrives with its
own supporting coincidence already attached is exactly what stops a real
search early.

**Principle:** a failure at a lower layer wearing the vocabulary of a higher
one gets diagnosed at the higher layer. Ask which layer actually produced
the error before accepting a diagnosis, and be most suspicious of whichever
hypothesis showed up already looking guilty.

---

## Supplements: dispatching-parallel-agents

### Independence is a property of the whole mutable surface, not just source files

A plan can decompose work so that no two agents ever write the same source
file — disjoint components, disjoint routes — pass a "shared file / shared
interface" scan cleanly, and still be unsafe to run in parallel, because
every agent sharing one working tree also contends on:

- the build output directory (`.next/`, `dist/`, `target/`) — concurrent
  builds corrupt each other or hit platform-specific lock errors,
- a fixed dev-server port,
- the package manager lockfile,
- the git index (`index.lock`) and a blanket `git add -A` that stages a
  neighbor's half-written files.

Source-file disjointness proves only the cheap half of independence. When a
plan marks tasks as parallel-safe, require a one-line justification that
names the build/test/VCS surface explicitly, not just "these touch different
files" — and treat "yes, they each run a full build / bind a port / commit
to the same index" as disqualifying regardless of source disjointness,
unless each agent gets its own worktree, its own build directory, and its
own port. Default to serial execution when agents share one working tree;
on Windows, default to serial even harder — path-locking and file-handle
behavior make partial-write collisions in a shared build directory more
likely, not less.

### A subagent's findings and its interpretations arrive in the same register

Split what an agent returns in two. **Findings** are quoted file contents,
command output, search results — cheap to trust and cheap to re-check.
**Interpretations** are claims about what those findings mean: that two
components disagree, that something is missing, that the approach has to
change. Both come back inside one document written in the same confident
voice, and the interpretations are the part most likely to be wrong, because
cold context is exactly what makes a misreading invisible to the agent that
made it — it lacks the surrounding knowledge that would mark the claim as odd.
A subagent's authority is highest for what it *read* and lowest for what it
*concluded*.

Any interpretation that would **add or remove work** — a new task, a dropped
task, a changed approach — is verified against its primary source before it is
acted on or reported onward. The cost is usually opening one file: a docstring
one level below the summary routinely contradicts a conclusion drawn from file
names and call sites.

The integration checks a dispatch normally ends with — check for conflicts,
run the full test suite, spot check the diffs — assume agents that *changed
something*. A read-only research agent produces no artifact to test, so every
one of those checks is structurally inert while its output flows straight into
decisions. When an agent writes nothing, the primary-source check is the only
verification available; say so in the brief rather than inheriting a suite
that cannot reach the claim.
