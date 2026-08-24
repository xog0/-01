# Active skills

Only skills that are actually in use live here. Claude Code loads every
`SKILL.md` under this directory into its skill list at session start, so
keeping the list small keeps skill selection accurate.

| Skill | Source | Notes |
|---|---|---|
| `find-skills` | vercel-labs/skills | Search and install skills from the ecosystem |
| `agent-tools` | inferen-sh/skills | inference.sh via the `belt` CLI — needs `belt` installed + a network that allows `*.inference.sh` |
| `skill-creator` | anthropics/skills | Create, eval and benchmark skills — runs fully locally |
| `nano-banana-pro-openrouter` | github/awesome-copilot | Image gen/edit via OpenRouter — needs `uv` + `OPENROUTER_API_KEY` |

## Full archive

All 519 installed skills are kept under `.commandcode/skills/` (the
`cmd skills` CLI install location). Nothing was lost — this directory is
just the curated subset that Claude Code loads.

Sources: `github/awesome-copilot` (412), `inferen-sh/skills` (87),
`anthropics/skills` (19), `vercel-labs/skills` (1).

## Activate a skill from the archive

```bash
cp -r .commandcode/skills/<name> .claude/skills/
```

Skills named `docx`, `pdf`, `pptx`, `xlsx` and `skill-creator` also ship with
Claude Code itself, so copying those in duplicates an existing entry.

## Install a new skill

Use the path form for a single skill out of a large repo — `--skill` falls
back to a bulk install (capped at 100) when the name does not match:

```bash
npx cmd skills add <owner>/<repo>/skills/<skill-name>
```
