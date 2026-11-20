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

## Rule: install to the archive, activate only on request

New skills go into `.commandcode/skills/` and stay there. Do not copy one into
this directory unless it was explicitly asked for — the active set is chosen by
the owner, not by whoever installed the skill.

## Kept in the archive on purpose

Six skills added to close gaps found by comparing the archive against the
50 skills in coreyhaines31/marketingskills:

`cro` — 857 lines. Conversion rate optimisation. The counterpart to the
traffic skills: SEO and ads bring visitors, this turns them into orders.
`marketing-psychology` points at it by name for page-level work.

`analytics` — 1,260 lines · `attribution` — 662 lines. Measurement and source
credit. `attribution` answers the question every client asks — where did this
order come from — which is also how agency work gets proven.

`emails` — 1,107 lines · `social` — 1,851 lines. Two channels with no coverage
in the archive before this.

`marketing-plan` — 4,478 lines, 15 files. The largest skill in the repo, and
the one that assembles the rest into a single plan a client can be handed.

Deliberately skipped as wrong-business-model: aso, revops, prospecting,
sales-enablement, paywalls, signup, churn-prevention, community-marketing,
marketing-council — these target SaaS, subscriptions, mobile apps and B2B
sales motions.

`ads` (coreyhaines31/marketingskills) — 2,625 lines, 16 files. Paid-media
strategy and operations: separate playbooks for Google Search, Meta (current
Andromeda-era system), LinkedIn B2B and ABM, plus conversion tracking,
payback-period maths, audience targeting, a Google Ads audit checklist, audit
guardrails, and a mandatory RSA output spec.

`ad-creative` (coreyhaines31/marketingskills) — 2,576 lines, 13 files. The
production half: a hook system, platform specs and formats, short-form and
motion video specs, static templates, generative tooling, a creative roadmap,
and an HTML template for reviewing creative with a client.

These two are the largest skills in the archive and the pair complements
rather than overlaps — `ads` decides where the budget goes, `ad-creative`
makes what runs there.

`offers` (coreyhaines31/marketingskills) — 1,560 lines on offer construction:
the value equation, offer anatomy, guarantee design, bonus stacking,
scarcity/urgency, naming, payment structure. Aimed at services and agencies,
so it fits both pricing this agency's own packages and advising clients. It
also carries "When NOT to use offer-design tactics" and a banned-vocabulary
list — worth reading before applying any of it.

`pricing` (coreyhaines31/marketingskills) — 830 lines, but SaaS-shaped: tiers,
freemium, value metrics, Van Westendorp, MaxDiff. Searching its files for
agency/retainer/consulting/project-based/hourly returns zero hits. Kept for a
future SaaS client; `offers` is the one for service pricing, and both skills
say so themselves.

`marketing-ideas` (coreyhaines31/marketingskills) — a catalogue of 139 numbered
marketing ideas across 17 categories, plus a guerrilla-marketing framework with
a named case library. Broad by design, so it competes with everything at
selection time. Activate it when scoping a new client, deactivate when the work
turns execution-side:

```bash
./bin/skill on marketing-ideas     # scoping a new client
./bin/skill off marketing-ideas    # back to execution
```

## Full archive

All 545 installed skills are kept under `.commandcode/skills/` (the
`cmd skills` CLI install location). Nothing was lost — this directory is
just the curated subset that Claude Code loads.

Sources: `github/awesome-copilot` (412), `inferen-sh/skills` (87),
`anthropics/skills` (19), `vercel-labs/skills` (1),
`intellectronica/agent-skills` (1), `refoundai/lenny-skills` (6),
`coreyhaines31/marketingskills` (16), `nexu-io/open-design` (1, a stub),
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
