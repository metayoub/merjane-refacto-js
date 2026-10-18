# Theodo — Agent Instructions

This repo is prepared for a **refactor exercise**: you will receive client code with many issues and refactor it.

## Superpowers (required)

This project uses **Superpowers**. Treat Superpowers skills as mandatory process, not optional tips.

1. At the start of meaningful work, follow `using-superpowers`: if a skill might apply, **read and follow it before acting**.
2. Process skills take priority:
   - New features / creative work → `brainstorming` before implementation
   - Bugs / unexpected failures → `systematic-debugging` before fixing
   - Multi-step implementation after a signed-off design → `writing-plans`, then `executing-plans` or `subagent-driven-development`
   - Before claiming done → `verification-before-completion`
3. Announce which skill you are using and why, then follow it exactly.
4. User instructions in this file and in `.cursor/rules/` override skill defaults when they conflict.

If the Superpowers plugin is missing in a session, tell the human partner to install it with `/add-plugin superpowers` (or search “superpowers” in the Cursor plugin marketplace), then start a **new** Agent chat.

## Review loop

**Trigger word:** `review-loop`

When the human says `review-loop` (or `run review-loop` / `start review-loop`), follow the playbook:

- Playbook: `docs/superpowers/playbooks/review-loop.md`
- Spec: `docs/superpowers/specs/2026-10-16-guided-review-refactor-loop-design.md`
- Report templates: `reports/templates/`

**Human gates:** Gate 1 (approve findings before any product code change) and Gate 2 (approve delivery report).  
**Review LLM ≠ Development LLM.** HTML reports only; do not redesign product UI.

## Design system (documents)

All **HTML** and **PDF** documents created or edited in this repo must follow the Evreghen Command Center design system in `@design.md`.

Do not invent alternate palettes, fonts, or layout languages for deliverable docs. Product UI is out of scope for design-system restyling during `review-loop`.
