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
| `nano-banana-pro` | intellectronica/agent-skills | Same model, called directly on Google's API — needs `uv` + `GEMINI_API_KEY` |
| `marketing-psychology` | coreyhaines31/marketingskills | Mental models and cognitive biases applied to marketing — no dependencies |
| `frontend-design-direction` | affaan-m/ECC | Design-direction checklist for UI work — anti-patterns and a review pass |
| `ui-ux-pro-max` | nextlevelbuilder/ui-ux-pro-max-skill | Searchable UI/UX data — styles, palettes, font pairings, UX rules, 22 stacks. Ships a Python search tool (stdlib only) |
| `seo-audit` | coreyhaines31/marketingskills | Technical, on-page and content SEO audit framework — includes international/hreflang guidance |
| `content-strategy` | coreyhaines31/marketingskills | Planning what content to make and why — pillars, clusters, keyword research by buyer stage |
| `copywriting` | coreyhaines31/marketingskills | Writing marketing copy — page structure, CTA guidelines, voice and tone |
| `copy-editing` | coreyhaines31/marketingskills | Editing existing copy — a seven-sweep framework and plain-English alternatives |
| `seo-strategy` | refoundai/lenny-skills | SEO strategy — technical health, programmatic scaling, AI-driven discovery |
| `positioning` | refoundai/lenny-skills | Competitive alternatives, value drivers, target segments |
| `acquisition-channels` | refoundai/lenny-skills | Finding and mastering distribution channels |
| `marketing-org-and-stack` | refoundai/lenny-skills | Marketing team structure and tooling |
| `personal-brand-network` | refoundai/lenny-skills | Building a professional network and audience |
| `pr-and-press` | refoundai/lenny-skills | Press strategy tied to business goals, not vanity metrics |
| `gtm-positioning-strategy` | github/awesome-copilot | Positioning, longer and more prescriptive than the lenny one |
| `press-release-writing` | github/awesome-copilot | AP-style press releases — the execution to pr-and-press's strategy |
| `seo-content-brief` | github/awesome-copilot | Per-article SEO briefs — SERP analysis, headings, word counts |

## Full archive

All 534 installed skills are kept under `.commandcode/skills/` (the
`cmd skills` CLI install location). Nothing was lost — this directory is
just the curated subset that Claude Code loads.

Sources: `github/awesome-copilot` (412), `inferen-sh/skills` (87),
`anthropics/skills` (19), `vercel-labs/skills` (1),
`intellectronica/agent-skills` (1), `refoundai/lenny-skills` (6),
`coreyhaines31/marketingskills` (5), `nexu-io/open-design` (1, a stub),
`affaan-m/ECC` (1), `nextlevelbuilder/ui-ux-pro-max-skill` (1).

## Activate a skill from the archive

Use `bin/skill` from the repo root:

```bash
./bin/skill ls                # what is active
./bin/skill find diagram      # search the archive by name and description
./bin/skill info drawio       # frontmatter, files, required env vars
./bin/skill on pptx drawio    # activate
./bin/skill off drawio        # deactivate
```

Or copy by hand — activation is nothing more than this:

```bash
cp -r .commandcode/skills/<name> .claude/skills/
```

Claude Code picks up a newly activated skill during the session; it does not
need a restart.

Skills named `docx`, `pdf`, `pptx`, `xlsx` and `skill-creator` also ship with
Claude Code itself, so copying those in duplicates an existing entry.

## Install a new skill

Use the path form for a single skill out of a large repo — `--skill` falls
back to a bulk install (capped at 100) when the name does not match:

```bash
npx cmd skills add <owner>/<repo>/skills/<skill-name>
```
