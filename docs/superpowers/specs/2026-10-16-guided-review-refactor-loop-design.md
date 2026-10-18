# Guided JS/TS Review & Refactor Loop — Design

**Date:** 2026-10-16  
**Status:** Approved (2026-10-16)  
**Stack:** JavaScript / TypeScript (generic; adapts to whatever client code is dropped in)

## Intent

Provide a **reusable, guided agent playbook** for this repo so that when client “legacy” code is added later, an agent can:

1. Discover and catalog issues (quality, bugs, SOLID smells, security)
2. Produce an HTML findings report
3. Pause for **human approval** before changing product code
4. Fix issues with clean SOLID-oriented refactors (behavior-preserving; **no UI redesign**)
5. Add regression tests (one per issue where feasible), plus unit and e2e when the project shape allows
6. Ensure baseline tooling exists (lint, types, deps audit, CI scripts, a11y spot-check for frontend)
7. Pause again for **human approval** of the final “what / why / how to avoid” HTML report

The human partner only jumps in at approval gates or when the agent asks a short clarifying question.

## Why

This folder is prepared for a refactor exercise. The process must be repeatable, auditable, and safe: no silent rewrites, no cosmetic UI overhauls disguised as refactors, and clear evidence (reports + tests) of what was found and fixed.

## Goals

- Generic playbook that works for Node libs, APIs, CLIs, and web apps (React/Vue/etc.) once code lands under an agreed root (default: repo root or `src/` / `app/` as present).
- Guided flow with **exactly two human gates** (plus ad-hoc questions only when blocked).
- Issue-driven work: every accepted finding gets severity, fix guidance, and ideally a failing-then-passing regression test.
- Security review as a first-class pass (not an afterthought).
- SOLID used as the **refactor framing** (single responsibility, dependency inversion, etc.) without rewriting architecture for its own sake.
- HTML reports only (simpler/faster than PDF), styled with `@design.md` (Evreghen tokens) — reports are deliverables, not product UI.
- Add missing process steps when absent: baseline, severity triage, lint/types/deps, a11y spot-check (frontend), CI-ready scripts.
- **Model separation:** all *review* work must run on a **different LLM** than the one used for *development* (implementation, refactor, test authoring).

## Non-goals

- Changing product visual design, layout, or branding to match `@design.md`.
- Taking UI screenshots for design comparison / redesign.
- PDF reports (HTML only).
- Deep performance profiling or multi-browser matrices (unless a finding is clearly a functional/security bug).
- Inventing a full product when no client code exists yet — this design builds the **loop**, not a sample app.
- Replacing Superpowers; this playbook **composes** with Superpowers (brainstorming already done for the loop itself; systematic-debugging / TDD / verification during execution).

## Anti-goals

- “Drive-by” refactors that change behavior without a linked issue ID.
- Restyling the client UI under the guise of “clean code.”
- Skipping human gate 1 and refactoring immediately.
- Reports that list issues without severity, remediation, and prevention guidance.
- Same LLM reviewing its own development work (self-review on one model).

## Constraints

- Language: JS/TS only for the target codebase.
- Reports: HTML, follow `@design.md` for document chrome/tokens.
- Product UI: preserve existing look and UX unless a fix *requires* a minimal DOM/accessibility change to resolve a confirmed a11y or functional defect — then document it as tied to an issue ID, not a redesign.
- Human in the loop: gates 1 and 2 are mandatory.
- Client code arrives later; playbook must not assume a specific framework beyond detecting common ones (package.json scripts, vitest/jest, playwright/cypress, next/vite, etc.).
- **Review LLM ≠ Development LLM** (mandatory):
  - **Review roles** (discovery catalog, SOLID/security review, post-fix code review, Gate 1 dossier assembly from review findings): spawn a **subagent with an explicitly different model** than the parent/dev agent (e.g. Cursor `Task` with a non-`inherit` model, or dedicated review subagents such as security-review / bugbot when appropriate).
  - **Development roles** (refactor, implementing fixes, writing tests, scaffolding CI/lint): parent/dev agent model only.
  - The orchestrating agent must **name both models in the findings/delivery reports** (Reviewer model vs Developer model).
  - If only one model is available in the session, **stop and ask the human** which alternate model to use for review — do not proceed with same-model self-review.

## Human gates

### Gate 1 — Approve findings & plan (before any product code change)

Agent presents:

- Issue catalog (ID, severity, category, location, evidence)
- Security findings highlighted
- Proposed refactor plan (ordered by severity; SOLID angle per cluster)
- Proposed test strategy
- Tooling gaps to add (lint/types/CI/a11y) as explicit issues or setup tasks

Human may: approve all, reject some, re-prioritize, or answer questions.

**Hard stop:** no product source edits until Gate 1 is approved.

### Gate 2 — Approve final delivery report

Agent presents:

- What was done and why (mapped to issue IDs)
- What was deferred
- How to avoid each class of issue going forward
- Links to HTML reports, test commands, coverage summary

Human signs off or requests corrections to the report / residual fixes.

## End-to-end loop (phases)

### Phase 0 — Intake (automatic when code appears)

- Detect package manager, frameworks, existing test/lint/CI setup.
- Record “snapshot of as-found” tooling in the findings report.
- If nothing runnable yet, ask the human one question: how they usually start the app / tests.

### Phase 1 — Baseline

- Document install/run/test commands (create or update a short `docs/runbook.md` only if missing and Gate 1 allows — or draft it in the report first).
- Attempt install + smoke (build or start or unit tests) **without** changing product code; note failures as issues.
- Capture environment assumptions.

### Phase 2 — Discovery passes (read-only on product code)

**Must run on the Review LLM** (subagent ≠ developer model). Orchestrator may only run mechanical tooling (install, eslint, tsc, npm audit) and merge results.

Review subagent(s) cover, in parallel where possible:

1. **Static quality** — structure, duplication, dead code, error handling, async hazards.
2. **SOLID / clean-code smells** — God modules, tight coupling, missing abstractions that block testing.
3. **Security review** — injection, XSS, secrets, authz flaws, unsafe deps usage, insecure defaults, prototype pollution, SSRF, path traversal, etc. (as applicable). Prefer a dedicated security-review path when available, still on a non-dev model.
4. **Lint / types / deps** — orchestrator runs tools; Review LLM interprets failures into issues.
5. **A11y spot-check** — **only if frontend detected**; keyboard, labels, contrast of critical flows; defects as issues (**fixes must not redesign UI**).
6. **Severity triage** — P0 (security/data loss/crash), P1 (wrong behavior), P2 (maintainability), P3 (nit).

Every finding gets a stable ID: `ISSUE-001`, …

After Phase 5, run a **post-fix review** again on the Review LLM (diff vs baseline) before Gate 2.

### Phase 3 — Findings HTML report + Gate 1

Generate `reports/findings.html` (and machine-readable `reports/findings.json` for agent continuity).

Wait for Gate 1.

### Phase 4 — Tooling & tests-first (after Gate 1)

For each approved issue (P0→P3):

- Prefer **red/green**: add a failing regression test that demonstrates the issue, then fix.
- Unit tests for logic; e2e only when UI/API flows exist and a harness can be added reasonably.
- Add missing **CI-ready scripts** in `package.json` (e.g. `lint`, `typecheck`, `test`, `test:e2e`, `audit`) and a minimal CI workflow **only if none exists** and Gate 1 approved that work.

### Phase 5 — Refactor & fix

- Behavior-preserving fixes and SOLID-oriented cleanups scoped to approved issues.
- No UI redesign; a11y fixes limited to semantics/attributes/structure needed for the defect.
- Keep changes reviewable; group by issue ID in commits only if the human later asks for commits.

### Phase 6 — Verification

- Run lint, typecheck, unit, e2e (as available).
- Coverage report (tooling of the project: c8/istanbul/vitest coverage) summarized in HTML.
- Verification-before-completion discipline: do not claim done without command evidence.

### Phase 7 — Final HTML reports + Gate 2

Produce at least:

| File | Purpose |
|------|---------|
| `reports/findings.html` | Initial catalog (frozen after Gate 1; mark status after fixes) |
| `reports/security.html` | Security-focused view (or a section deep-link if merged) |
| `reports/coverage.html` | Coverage summary + how to regenerate |
| `reports/delivery.html` | What we did, why, prevention guidance per issue |

Wait for Gate 2.

## Deliverables to build now (before client code)

These are **playbook assets**, not a sample application:

1. **Cursor project rule** — guided loop always available (phases, gates, no UI redesign).
2. **Agent skill or playbook markdown** under `docs/superpowers/` — step-by-step checklist the agent follows when the user says the trigger word **`review-loop`**.
3. **HTML report template** — shared CSS tokens from `@design.md`, sections for issues, severity badges, security, coverage, delivery narrative.
4. **`reports/` placeholder** + `.gitkeep` and short README explaining outputs.
5. **AGENTS.md update** — pointer to the playbook and gates.
6. Optional: issue JSON schema for `reports/findings.json`.

## How the human starts later

1. Drop JS/TS client code into the repo (agreed location; builder default: replace/fill project root keeping `docs/`, `.cursor/`, `design.md`, `AGENTS.md`, `reports/`).
2. Tell the agent the trigger word: **`review-loop`**
3. Answer questions only if blocked (including which Review LLM to use if unset); approve Gate 1; later approve Gate 2.

## Trigger word

| Trigger | Action |
|---------|--------|
| **`review-loop`** | Start the full guided review & refactor loop from Phase 0 |

Synonyms the agent should treat the same: `run review-loop`, `start review-loop`.

## Builder calls (defaults unless human overrides)

- Report format: **HTML only**.
- Product UI: **do not redesign**; `@design.md` applies to **reports**, not the app chrome.
- A11y: spot-check + fix confirmed defects without visual redesign.
- Test runner: detect existing (Jest/Vitest/Node test); if none, add Vitest for unit and Playwright for e2e only when a web UI or HTTP surface exists and Gate 1 includes that setup.
- Package manager: detect from lockfile (`pnpm` > `yarn` > `npm`).
- CI: GitHub Actions minimal workflow if `.github/workflows` missing and Gate 1 approved.
- Severity scale: P0–P3 as above.
- Frontend detection: presence of typical UI deps or `index.html` / framework config.
- **Review model default:** if the human has not named one, ask once at loop start: “Which model should review (must differ from this chat’s model)?” Do not invent a silent default that might match the parent.

## Open for human at approval time

Confirm this design document (including model separation + trigger **`review-loop`**).
