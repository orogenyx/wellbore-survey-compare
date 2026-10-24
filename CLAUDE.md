# Survey Compare

`README.md` is the file inventory and the quick reference. `HANDOVER.md`, when present, has the reasoning behind every rule, the provider file layouts, the colour logic in the table, and integration notes. It is a private working note: it is gitignored and lives only in the owner's working copy, so a fresh clone will not have it. Read it first when it is there.

## What this folder is

A finished single-page app for MWD survey QC, built in a Claude Code session on 23 Oct 2026. It is a public portfolio repo at github.com/orogenyx/wellbore-survey-compare (default branch `main`), published with GitHub Pages at https://orogenyx.github.io/wellbore-survey-compare/.

**This repo is public.** Never commit real well names, operators, rig numbers, survey data or local machine paths. Use made-up names (the mockups use "Example State 14-22-1 3H"). `transcript/`, `HANDOVER.md` and `SETUP-GITHUB.md` stay out via `.gitignore`. `dist/` is committed on purpose so the offline file travels with the repo.

## Status and next steps

Done: repo created and pushed, real well name scrubbed, GitHub Pages live, About box and topics set, MIT license added, icons moved to `icons/`, private notes removed from the public tree.

Open:
1. **Later, reuse the comparison inside a larger application.** The piece to lift is `survey-compare-core.js`. Do not start that without being asked, and do not name the target application anywhere in this repo.

## Rules that must not change without asking

- Stations pair only on an identical MD. No match window.
- Any INC or AZM difference at all is flagged. No tolerance.
- Azimuth 0 and 360 are the same heading.
- A 0 / 0 / 0 station is a surface tie-in and is ignored everywhere.
- MWD is the reference.
- No delta columns, no charts, no "largest delta" tiles. The owner removed them deliberately.

## Working on the page

- `survey-compare.html` has no `<html>`/`<head>` because it was published through Claude's artifact system, which wraps it. Do not add those tags to it. `build-standalone.ps1` produces the complete file in `dist/`.
- The same parsing and comparison functions exist in both `survey-compare.html` and `survey-compare-core.js`. If a rule changes, change both.
- Dark mode is the instrument-panel look, light mode is the printed-report look, both driven by the `:root` token block at the top of the stylesheet. Restyle there, not in component rules.
- After any change to the page, rebuild `dist/` and commit both. `dist/` is also the handout folder for flash drives: the build copies `icons/survey-compare.ico` and the shortcut installer into it.
