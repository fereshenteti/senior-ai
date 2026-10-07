---
name: visual-check
description: Pixel-compare a component's Storybook AllStates story against its reference state-sheet image and fix differences until it matches. Use after implementing or changing a UI component that has a reference design image.
user-invocable: true
---

# Visual check

Compares the rendered `AllStates` story of a component with its reference image (one image per component containing all its states).

## Conventions (override them in the project AGENTS.md)
- Reference image: `design/screens/<component>.png` (kebab-case component name).
- Story: `<Component>/AllStates`; story id e.g. `components-button--all-states`.
- Reference scale: 1x unless the project says 2x.
- Output: `.visual-check/` in the project root (add it to `.gitignore`).

## Setup (once per project)
1. The project needs `playwright`, `pixelmatch` and `pngjs` as dev dependencies. If missing, **ask the user** before running:
   `npm i -D playwright pixelmatch pngjs && npx playwright install chromium`
2. Storybook must be running (`npm run storybook`, default `http://localhost:6006`). Start it in the background if it is not running.

## Run
The script is in this skill's folder at `scripts/visual-check.mjs`. In Claude Code the folder is the base directory shown when the skill loads;
in Vibe it is `~/.vibe/skills/visual-check/`. Run it **from the project root**:
```bash
node <skill-dir>/scripts/visual-check.mjs \
  --story components-button--all-states \
  --ref design/screens/button.png \
  --scale 1
```
Useful options: `--url` (Storybook URL), `--selector '.sheet'` (capture one element), `--max-mismatch 0.5` (pass limit in %), `--threshold 0.1` (color tolerance).
Exit code 0 = pass, 1 = differences above the limit, 2 = setup problem.

## Fix loop
1. Run the check. Read the summary: mismatch %, size difference and the regions with the most differences.
2. Look at `<name>.diff.png` (red = different pixels) and `<name>.actual.png` next to the reference, if you can view images. If you cannot, use the region coordinates to know which part of the sheet to inspect in code.
3. Fix the **cause**, in this order: canvas size and layout of the AllStates story, then spacing, typography (font family, size, weight, line-height), colors, borders and radius, shadows, icons.
4. Fix with tokens (see `design-fidelity`); never tweak values just to make pixels match when a token says otherwise. Report such conflicts instead.
5. Re-run. Stop when it passes, or after 5 iterations, and report what remains.

## Interpreting results
- **Font rendering noise** (anti-aliasing at glyph edges) is normal; that is what `--threshold` and `--max-mismatch` absorb. Do not lower the threshold to chase it.
- **Size differs**: the AllStates canvas does not match the reference dimensions. Fix that first; everything else shifts with it.
- **Whole-image mismatch with correct shapes**: usually wrong background color, missing global styles in Storybook, or wrong scale (`--scale 2` for @2x references).
- **Images and fonts not loaded**: make sure fonts are loaded in Storybook's preview (the script waits for `document.fonts.ready`).

## Report
End with: PASS/FAIL, final mismatch %, remaining differences and their likely cause, and any design-vs-token conflicts.
