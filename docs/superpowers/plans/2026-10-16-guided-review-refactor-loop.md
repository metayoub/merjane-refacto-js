# Guided Review-Loop Playbook Assets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install the reusable `review-loop` playbook (rules, checklist, HTML templates, schemas, AGENTS pointers) so agents can run the approved guided JS/TS review & refactor process when client code arrives.

**Architecture:** Documentation-and-template assets only — no sample app. A Cursor always-apply rule + playbook markdown drive agent behavior; shared CSS tokens and HTML shells under `reports/templates/` produce Evreghen-styled findings/security/coverage/delivery reports; a JSON schema pins `findings.json` shape.

**Tech Stack:** Markdown, Cursor `.mdc` rules, static HTML/CSS tokens from `design.md`, JSON Schema draft-07.

**Spec:** `docs/superpowers/specs/2026-10-16-guided-review-refactor-loop-design.md`

## Global Constraints

- Trigger word: **`review-loop`** (synonyms: `run review-loop`, `start review-loop`).
- HTML reports only; style with Evreghen tokens from `design.md` — never redesign product UI.
- Exactly two human gates; no product source edits before Gate 1.
- Review LLM ≠ Development LLM; ask human for review model if unset.
- TDD preferred (red/green per approved issue) during Phase 4–5 after Gate 1.
- Preserve `design.md`, `.cursor/`, `docs/`, `AGENTS.md`, `reports/` when client code lands later.

## Review Focus

- Agent starts product edits before Gate 1 → rule/playbook must hard-stop in bold.
- Review and develop on same model → playbook must require asking for alternate model.
- HTML report ignores design tokens → template must embed CSS variables from `design.md` colors.
- Findings JSON missing required fields → schema must require `id`, `severity`, `category`, `status`.
- Human does not know trigger → `AGENTS.md` must show `review-loop` prominently.

---

### Task 1: Issue schema + reports README

**Files:**
- Create: `reports/findings.schema.json`
- Create: `reports/README.md`
- Create: `reports/.gitkeep` (if missing)

**Interfaces:**
- Produces: JSON Schema for findings array items with required: `id` (pattern `^ISSUE-\\d{3,}$`), `severity` (`P0`|`P1`|`P2`|`P3`), `category` (string), `title` (string), `status` (`open`|`approved`|`fixed`|`deferred`|`rejected`), optional `location`, `evidence`, `remediation`, `prevention`, `solidAngle`, `security` (boolean)

- [ ] **Step 1:** Write `reports/findings.schema.json` with the fields above (draft-07).
- [ ] **Step 2:** Write `reports/README.md` listing expected outputs: `findings.html`, `findings.json`, `security.html`, `coverage.html`, `delivery.html`, and pointing at `templates/`.
- [ ] **Step 3:** Verify files exist: `test -f reports/findings.schema.json && test -f reports/README.md`

---

### Task 2: Shared report CSS + HTML templates

**Files:**
- Create: `reports/templates/report.css`
- Create: `reports/templates/findings.html`
- Create: `reports/templates/security.html`
- Create: `reports/templates/coverage.html`
- Create: `reports/templates/delivery.html`

**Interfaces:**
- Consumes: color/typography tokens from `design.md` (`#fcfaf7`, `#423d38`, `#fe6e00`, `#797067`, severity badge colors)
- Produces: linkable templates with placeholders `{{TITLE}}`, `{{GENERATED_AT}}`, `{{DEVELOPER_MODEL}}`, `{{REVIEWER_MODEL}}`, and an issues table / sections agents copy-fill

- [ ] **Step 1:** Create `report.css` with `:root` CSS variables mapped from `design.md` (background, on-background, primary, muted, outline, danger/warning/success/info, P0–P3 badge colors) and layout for report shell (max-width 1400px, 32px padding, system sans).
- [ ] **Step 2:** Create four HTML templates linking `report.css`, with header meta for models, and empty semantic sections matching each report purpose in the spec.
- [ ] **Step 3:** Verify: `rg -n "fe6e00|--color-primary" reports/templates/report.css` and each HTML references `report.css`.

---

### Task 3: Playbook checklist

**Files:**
- Create: `docs/superpowers/playbooks/review-loop.md`

**Interfaces:**
- Consumes: phases 0–7, gates, model separation from the approved spec
- Produces: ordered checklist an agent follows when trigger fires

- [ ] **Step 1:** Write playbook with: trigger, ask-for-review-model, phases 0–7 checkboxes, Gate 1/2 hard stops, TDD red/green per issue, no UI redesign, report paths, Superpowers skill pointers (`test-driven-development`, `verification-before-completion`, security-review / Task with non-inherit model).
- [ ] **Step 2:** Verify trigger string appears: `rg -n "review-loop" docs/superpowers/playbooks/review-loop.md`

---

### Task 4: Cursor rule + AGENTS.md

**Files:**
- Create: `.cursor/rules/review-loop.mdc`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: playbook path `docs/superpowers/playbooks/review-loop.md`
- Produces: always-apply (or description-triggered) rule that activates on `review-loop`

- [ ] **Step 1:** Create `.cursor/rules/review-loop.mdc` with `alwaysApply: true` (or `false` + strong description mentioning trigger `review-loop`), pointing agents to open the playbook, enforce Gate 1 hard stop, model separation, no product UI redesign.
- [ ] **Step 2:** Update `AGENTS.md` with a **Review loop** section: trigger `review-loop`, link to playbook + approved spec, note HTML reports + two gates.
- [ ] **Step 3:** Verify: `rg -n "review-loop" AGENTS.md .cursor/rules/review-loop.mdc`

---

### Task 5: Smoke verification

**Files:** none new

- [ ] **Step 1:** List required tree:

```bash
test -f docs/superpowers/playbooks/review-loop.md \
 && test -f .cursor/rules/review-loop.mdc \
 && test -f reports/templates/report.css \
 && test -f reports/templates/findings.html \
 && test -f reports/templates/security.html \
 && test -f reports/templates/coverage.html \
 && test -f reports/templates/delivery.html \
 && test -f reports/findings.schema.json \
 && test -f reports/README.md \
 && rg -q "review-loop" AGENTS.md
```

Expected: exit 0

- [ ] **Step 2:** Mark design/plan todos complete; do **not** invent client code.
