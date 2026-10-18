# Playbook: `review-loop`

**Trigger:** `review-loop` (also: `run review-loop`, `start review-loop`)

**Spec:** `docs/superpowers/specs/2026-10-16-guided-review-refactor-loop-design.md`

**Reports:** fill shells from `reports/templates/` into **`reports/*.html`** (keep templates in place). Stylesheet path from filled reports: `templates/report.css`. Style with Evreghen tokens / `@design.md`. **Do not redesign product UI.**

---

## Severity scale (required)

| Sev | Meaning |
|-----|---------|
| **P0** | Security, data loss, or crash |
| **P1** | Wrong behavior |
| **P2** | Maintainability / SOLID / tooling that blocks safe change |
| **P3** | Nit |

---

## Before Phase 0

- [ ] Confirm JS/TS client code is present (or ask where it was dropped). JS/TS only.
- [ ] Ask once if unset: **Which model should review (must differ from this chat’s model)?**
- [ ] Record **Developer model** (this session) and **Reviewer model** for all reports.
- [ ] If no alternate review model is available → **STOP** and ask the human. Never same-model self-review.

Use Superpowers: `test-driven-development` during fixes; `verification-before-completion` before claiming done; spawn review via `Task` with a **non-`inherit`** model (or security-review / bugbot when appropriate). Gate 1 dossier assembly (catalog interpretation) runs on the **Reviewer** model; orchestrator merges tooling output.

---

## Phase 0 — Intake

- [ ] Detect package manager (lockfile: pnpm > yarn > npm).
- [ ] Detect frameworks, existing test/lint/CI. Frontend if typical UI deps or `index.html` / framework config.
- [ ] Snapshot as-found tooling for the findings report.
- [ ] **Baseline snapshot for later diff:** if git exists, note `HEAD` (or create an uncommitted stash note). If **no git**, either ask the human to allow `git init` + an initial commit of as-found code, **or** copy a read-only tree to `reports/baseline-snapshot/` (exclude `node_modules`). Record which method was used.
- [ ] If nothing runnable → ask human one question: how they start app/tests.

## Phase 1 — Baseline

- [ ] Draft install/run/test commands (report first; `docs/runbook.md` only after Gate 1 if missing).
- [ ] Attempt install + smoke **without product source edits**; failures → issues. (`node_modules` / lockfile from install are OK.)
- [ ] Note environment assumptions.

## Phase 2 — Discovery (Review LLM only)

Orchestrator may run mechanical tools (eslint, tsc, npm audit). Interpretation and cataloguing → **Reviewer model** subagent(s), in parallel where possible.

- [ ] Static quality
- [ ] SOLID / clean-code smells
- [ ] Security review
- [ ] Lint / types / deps → issues or setup tasks
- [ ] A11y spot-check **if frontend** (no UI redesign when fixing later)
- [ ] Severity triage using the scale above
- [ ] Assign IDs: `ISSUE-001`, … — set `security: true` for security-relevant rows (those drive `security.html`; `category: security` alone is not enough)

## Phase 3 — Findings report + Gate 1

- [ ] Write `reports/findings.json` (required fields per `reports/findings.schema.json`; include remediation + prevention text even though schema allows omit — playbook anti-pattern otherwise).
- [ ] Validate JSON shape (e.g. `npx --yes ajv-cli validate -s reports/findings.schema.json -d reports/findings.json` when network/tools allow; otherwise manual required-field check).
- [ ] Write `reports/findings.html` and `reports/security.html` from templates (href already points at `templates/report.css`).
- [ ] Present Gate 1 dossier: catalog, security highlights, refactor plan, test strategy, tooling gaps.
- [ ] Tell the human: reply with **`approve Gate 1`** (optionally listing rejects / re-priorities). Clarifying answers are **not** approval.

### HARD STOP — Gate 1

**No product source edits until the human explicitly approves Gate 1.**

After approval:

- [ ] Set approved issues to `status: approved`; rejected → `rejected`; deferred → `deferred`.
- [ ] Freeze the Gate 1 narrative in `findings.html` (keep a dated copy if needed); later status updates go in `findings.json` + delivery report.

---

## Phase 4 — Tooling & tests-first (after Gate 1)

Only issues with `status: approved`, order P0 → P3:

- [ ] **TDD:** failing regression test that demonstrates the issue → then fix (red/green).
- [ ] Unit tests for logic; e2e when UI/API surface + harness justified.
- [ ] If no test runner: add **Vitest** for unit; **Playwright** for e2e only when a web UI or HTTP surface exists **and** Gate 1 included that setup.
- [ ] Add missing CI-ready scripts (`lint`, `typecheck`, `test`, `test:e2e`, `audit`) and minimal GitHub Actions **only if Gate 1 approved** and none exist.
- [ ] Commits only if the human asks.

## Phase 5 — Refactor & fix

- [ ] Behavior-preserving SOLID-oriented fixes scoped to approved issue IDs.
- [ ] No product UI redesign; a11y fixes limited to semantics needed for the defect.

## Phase 6 — Verification

- [ ] Run lint, typecheck, unit, e2e as available — read real output.
- [ ] Produce coverage summary → `reports/coverage.html` (include issue → test file map).
- [ ] Post-fix review on **Reviewer model** using diff vs Phase 0 baseline (git diff or snapshot dir diff).

## Phase 7 — Delivery + Gate 2

- [ ] Update `findings.json` statuses (`fixed` / still `deferred`); refresh status column in findings if needed; write `reports/delivery.html` (what / why / avoid per issue).
- [ ] Present Gate 2; ask for explicit **`approve Gate 2`**.

### HARD STOP — Gate 2

Treat delivery as final only after **`approve Gate 2`** (or apply requested corrections, then ask again).

---

## Anti-patterns

- Editing product source before Gate 1
- Treating a clarifying answer as Gate approval
- Same LLM for review and development
- Restyling the client app to match `design.md`
- Claiming done without command evidence
- Issues without severity, remediation, and prevention guidance
- Leaving filled HTML in `templates/` (always write to `reports/*.html`)
