# Reports

Outputs from the guided **`review-loop`** playbook.

## Expected files

| File | Purpose |
|------|---------|
| `findings.json` | Machine-readable issue catalog (see `findings.schema.json`) |
| `findings.html` | Human findings report + Gate 1 dossier |
| `security.html` | Security-focused view of findings |
| `coverage.html` | Test coverage summary after fixes |
| `delivery.html` | What / why / how-to-avoid (Gate 2) |

## Templates

Fill shells from `templates/` into **this directory** as `findings.html`, `security.html`, etc. Keep template sources under `templates/`.

Filled reports link styles with `href="templates/report.css"` (Evreghen tokens, aligned with `/design.md`).

Agents should replace `{{PLACEHOLDER}}` values and issue rows — do not redesign product UI when creating these documents.

**Gate approval phrases:** `approve Gate 1` / `approve Gate 2`.
