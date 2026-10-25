# CLAUDE.md

This repository will hold real projects. Talk to the owner in Arabic.

## Active tooling

Loaded every session:

- Skills in `.claude/skills/`: `security-review`, `tdd-workflow`, `verification-loop`, `search-first`, `coding-standards`, `architecture-decision-records`, `codebase-onboarding`, `git-workflow`, `consciousness-council`, `claude-arabic`
- Agents in `.claude/agents/`: `planner`, `code-reviewer`, `security-reviewer`, `build-error-resolver`, `tdd-guide`
- Commands in `.claude/commands/`: `/plan`, `/code-review`, `/build-fix`
- Rule: `.claude/rules/security.md`
- Plugins (`.claude/settings.json`): `claude-mem`, `caveman`, `hojas-studio`
- The owner's claude.ai account also provides `council`, `prompt-optimizer`, `content-engine`, `brand-voice`, `market-research`, `product-lens`, `marketing-campaign`, `knowledge-ops`, `token-budget-advisor`, `cost-aware-llm-pipeline`. Do not copy these into the repo.

## ECC library (parked)

`.claude/ecc-library/` holds the rest of ECC v2.2.3: 303 skills, 66 agents, 94 commands, the language rule packs, and ECC's hooks. Claude Code does not load anything from it.

When a task would clearly benefit from a parked item:

1. Search the index: `grep -i "<keyword>" .claude/ecc-library/INDEX.md`
2. Tell the owner the item's name and, in one line, why it helps with the current task.
3. Activate it only after the owner agrees:
   - skill: `git mv .claude/ecc-library/skills/<name> .claude/skills/<name>`
   - agent: `git mv .claude/ecc-library/agents/<name>.md .claude/agents/`
   - command: `git mv .claude/ecc-library/commands/<name>.md .claude/commands/`
   - rule pack: `git mv .claude/ecc-library/rules/ecc/<lang> .claude/rules/<lang>`
4. Commit the move. The item loads from the next session.

Suggest at most one or two items per task, and only when the fit is concrete. Do not suggest items for tasks the active tooling already covers.

ECC's hooks (GateGuard, quality checks, cost tracking) are saved in `.claude/ecc-library/settings.hooks.json`. They are off. Restoring them means merging that file's `hooks` key back into `.claude/settings.json`; the hook scripts live in `.claude/ecc-library/scripts/`, so the paths inside would need updating first.
