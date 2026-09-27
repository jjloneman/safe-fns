---
okf_version: "0.2"
---

# Decisions

_None yet._

# About this bundle

This directory is an [Open Knowledge Format v0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) bundle of the package's semantic and design decisions — one Markdown file per decision, listed above as `* [Title](file.md) - one-line description`.

Each decision opens with YAML frontmatter:

```yaml
---
type: Decision
title: What "empty" means for strings
description: Whitespace-only strings are empty; the check trims first.
status: stable
generated: { by: <agent>/<model-id>, at: 2026-09-27T12:00:00Z }
verified: { by: human:jjloneman, at: 2026-09-28T09:00:00Z }
---
```

- **`type`** — always `Decision`.
- **`status`** — the decision's lifecycle:
  - `draft` — proposed, not yet settled.
  - `stable` — in force (the default when `status` is absent).
  - `deprecated` — superseded; kept for links and history.
- **`generated`** — who or what wrote the current text, and when.
  - `by` is an actor: `<producer>/<version>` for an agent, `human:<id>` for a person.
- **`verified`** — who has reviewed the decision, and when.
  - Absent means unreviewed.
  - `human:jjloneman` means the repo owner signed off — treat it as settled, and change it only with their agreement.
  - Agents never add a `verified` entry.
