# Survey Compare

**Live:** https://orogenyx.github.io/wellbore-survey-compare/ (runs entirely in your browser; files never leave your machine)

Checks the MWD survey listing against the directional driller's and the correction provider's, station by station, on MD, inclination and azimuth. Drop in three files (CSV, XLS or XLSX), get a verdict, per-source issue counts, and a table with every disagreement marked.

Single HTML page, no framework, no build step needed to run it. Open `dist/Survey Compare.html` and it works offline. Built for MWD survey QC; the comparison logic is a standalone module so it can be reused elsewhere.

## Files

| File | What it is |
| --- | --- |
| `survey-compare.html` | The app, as published to Claude. One page, no framework. Has no `<html>`/`<head>` of its own because the Claude artifact wrapper supplies them. |
| `survey-compare-core.js` | The parsing and comparison logic lifted out of the page into a dependency-free module (UMD: `require()` it or use the `SurveyCompare` global). This is the piece to reuse in another application. |
| `build-standalone.ps1` | Builds `dist\Survey Compare.html`, a single self-contained file that opens offline from a double-click. Inlines SheetJS. |
| `vendor\xlsx.full.min.js` | SheetJS 0.18.5, used to read CSV, XLS and XLSX. Pinned; only needed for parsing, not for comparing. |
| `icons/` | `icon.svg` plus `icon-16/32/64.png`, the browser-tab icon, and `survey-compare.ico` for the desktop shortcut (amber needle, red station dot). The SVG is the source; the PNGs are what the build inlines, because Chromium ignores SVG favicons on pages opened from disk. Re-render the PNGs from the SVG if the icon changes. |
| `dist\` | Build output and the folder to copy onto a flash drive: `Survey Compare.html` (open it in any browser), the icon, and the shortcut installer. |
| `install-shortcut.ps1`, `Install desktop shortcut.cmd` | Source of the installer that `dist\` carries. Copies the page and icon to `%LOCALAPPDATA%\SurveyCompare` and puts a Survey Compare shortcut on the desktop. No admin rights needed. |
| `theme-previews.html` | The four visual directions that were mocked up before choosing the instrument-panel / printed-report pair. Reference only. |
| `index.html` | Root page for GitHub Pages; forwards to `dist/Survey Compare.html`. |
| `preview.html` | Dev helper for previewing `survey-compare.html` locally. See Development. Not needed by users. |

## Rules the comparison follows

- Stations pair only on an **identical MD**. A station at any other depth shows as missing in the files that lack it. There is no match window on purpose.
- **Any** INC or AZM difference is flagged, down to the last decimal. No tolerance.
- Azimuth differences wrap through north: 0 and 360 are the same heading.
- A **0 / 0 / 0** station is a surface tie-in. It is dropped from every file before comparing and never counts as missing.
- MWD is always the reference when loaded; otherwise the first loaded file is.

## Header detection

The survey table can sit anywhere in the first 150 rows (the correction provider's export has a header block above it). A row is the header when it has one column each matching:

- **MD**: MD, M.D., Depth, Measured Depth, Meas. Depth, Survey Depth, Survey MD, Station Depth
- **INC**: INC, Inc., Incl, Inclination (optionally prefixed True / Corrected / Survey / Final)
- **AZM**: AZM, AZ, Azi, Azim, Azimuth (optionally prefixed True / Grid / Magnetic / Corrected / Survey / Final)

Units, degree signs, parentheses, dots, underscores and line breaks in the header are ignored. Columns containing Planned, Proposed, Closure, Target, Dogleg, DLS, TVD, Vertical, Delta, Interp, Toolface or Conv are never chosen, so "Planned Inclination" next to "Inclination" is safe. If no header is found the first three numeric columns are assumed and the user is warned; the page lets the mapping be corrected by hand.

The well name shown in the masthead comes from a `WELL NAME:` style label above the table when one exists.

## Using the core module

```js
// Browser (after loading SheetJS):
const f = SurveyCompare.parseSurveyFile(await file.arrayBuffer(), file.name, XLSX);
// f.stations -> [{ md, inc, azm, row }], f.well -> 'EXAMPLE STATE 14-22-1 3H'

const result = SurveyCompare.compareSurveys({ mwd: mwdStations, dd: ddStations, cp: cpStations }, 'mwd');
result.summary.dd      // { matched, inc, azm, missing, extra, issues }
result.rows[0]         // { md, items: { mwd, dd, cp }, deltas: { dd: { dInc, dAzm, fInc, fAzm } }, missing: [], status }
```

`compareSurveys` has no dependencies at all, so it can run server-side if the host application already has the station lists.

## Design

Dark mode is an instrument-panel look (graphite seams, amber readouts, status lamps). Light mode is a printed survey report (paper, rules, typewriter figures, red pencil on discrepancies). Both come from one token set at the top of the stylesheet; nothing else in the CSS knows which theme it is in, so restyling means editing that block only.

## Putting it on a flash drive

Copy the `dist` folder onto the drive. On any Windows PC:

- Double-click `Survey Compare.html` to use it straight from the drive, or
- Double-click `Install desktop shortcut.cmd` to copy it onto that PC and get a Survey Compare icon on the desktop. It works offline afterwards and needs no admin rights.

## Development

`survey-compare.html` is the source of the page. It has no `<html>`/`<head>` of its own, so do not open it directly; preview it with `preview.html`, which fetches the page into a skeleton:

```bash
python -m http.server
```

then open http://localhost:8000/preview.html. After any change, rebuild the offline file and commit both:

```powershell
powershell -ExecutionPolicy Bypass -File .\build-standalone.ps1
```

Writes `dist\Survey Compare.html` with SheetJS and the favicons inlined, and copies the icon and installer alongside it. Fonts load from Google Fonts when online and fall back to Arial Narrow / Consolas offline; everything else is self-contained.

## License

MIT. See `LICENSE`.
