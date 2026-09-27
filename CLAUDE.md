@AGENTS.md

# 🤖 CLAUDE.md

[AGENTS.md](AGENTS.md) is the single source of this repo's conventions and is imported above. This file holds only what is specific to Claude — don't restate AGENTS.md here.

## 🧠 Claude-specific notes

- **Put a convention in AGENTS.md, not here**, unless it only makes sense to Claude (an `@` import, a skill, a path-scoped rule). Other agents read AGENTS.md and never see this file.
- **In a decision's `generated.by`**, record the agent as `claude-code/<model-id>`, per the OKF actor convention (`<producer>/<version>`).

## 🗺️ Where the rest of the guidance lives

Claude loads path-scoped rules by itself when it reads a matching file; this map is for humans.

- [AGENTS.md](AGENTS.md) — every convention: design principles, code style, commits, dependencies, releases.
- [docs/decisions/](docs/decisions/index.md) — the design-decision bundle.
- `.claude/rules/` — path-scoped rules, each with a `paths:` frontmatter glob. None yet; list each one here as it is added.
