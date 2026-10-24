/*
 * Survey Compare — core logic, no UI.
 * Mirrors the functions inside survey-compare.html so the comparison can be reused
 * (for example inside another application) without the page. Keep the two in step when the rules change.
 *
 * Rules
 *   - A station is { md, inc, azm } read from a CSV/XLS/XLSX survey listing.
 *   - The header row is found by name: MD / Depth / Measured Depth, INC / Inclination, AZM / Azimuth
 *     (with units, dots, underscores and True/Grid/Magnetic prefixes tolerated). Planned, closure,
 *     TVD, dogleg and toolface columns are never picked.
 *   - A 0 / 0 / 0 station is a surface tie-in and is dropped before comparing.
 *   - Stations pair only on an identical MD. A station at any other depth is "missing" in the
 *     files that lack it.
 *   - Any INC or AZM difference at all is a flag. Azimuth differences wrap through north, so
 *     0 and 360 are the same heading.
 *
 * Dependency: SheetJS (XLSX global, or pass it in) for parseSurveyFile. compareSurveys needs nothing.
 *
 * Usage (browser or Node with a buffer):
 *   const file = SurveyCompare.parseSurveyFile(arrayBuffer, 'surveys.csv', XLSX);
 *   const result = SurveyCompare.compareSurveys({ mwd: file.stations, dd: ddFile.stations }, 'mwd');
 *   result.rows      -> one per MD, with items per source, deltas vs the reference, status
 *   result.summary   -> per non-reference source: matched / inc / azm / missing / extra / issues
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SurveyCompare = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ROLES = ['md', 'inc', 'azm'];
  const EPS = 1e-9;

  const PAT = {
    md:  /^(md|m d|measured depth|meas depth|measured dep|survey depth|depth|survey md|station depth)\b/,
    inc: /^((true|corrected|corr|survey|final)\s+)?(inc|incl|inclination|inclin)\b/,
    azm: /^((true|grid|mag|magnetic|corrected|corr|survey|final)\s+)?(az|azm|azi|azimuth|azim)\b/,
  };
  const REJECT = /\b(plan|planned|proposed|closure|target|dogleg|dls|tvd|true vertical|vertical|delta|diff|interp|tool ?face|tf|conv)\b/;

  function num(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (v == null) return null;
    const s = String(v).trim().replace(/,/g, '');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return null;
    return parseFloat(s);
  }
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[°º]/g, '').replace(/[\s_\-.:]+/g, ' ').trim();
  }
  function classify(header) {
    const n = norm(header);
    if (!n || REJECT.test(n)) return null;
    for (const r of ROLES) if (PAT[r].test(n)) return r;
    return null;
  }
  const wrapAz = (d) => ((d + 540) % 360) - 180;

  // aoa: array of row arrays (what SheetJS sheet_to_json gives with header: 1)
  function detectHeader(aoa) {
    const limit = Math.min(aoa.length, 150);
    for (let r = 0; r < limit; r++) {
      const row = aoa[r] || [], found = {};
      row.forEach((cell, c) => {
        if (typeof cell === 'number') return;
        const role = classify(cell);
        if (role && found[role] == null) found[role] = c;
      });
      if (found.md != null && found.inc != null && found.azm != null) return { row: r, map: found, auto: true };
    }
    for (let r = 0; r < limit; r++) {
      const idx = [];
      (aoa[r] || []).forEach((cell, c) => { if (num(cell) != null) idx.push(c); });
      if (idx.length >= 3) return { row: r - 1, map: { md: idx[0], inc: idx[1], azm: idx[2] }, auto: false };
    }
    return null;
  }

  function findWellName(aoa, headerRow) {
    for (let r = 0; r < Math.max(0, headerRow); r++) {
      const row = aoa[r] || [];
      for (let c = 0; c < row.length; c++) {
        const cell = row[c]; if (typeof cell !== 'string') continue;
        const m = /^\s*(well\s*name|well)\s*[:=]?\s*(.*)$/i.exec(cell);
        if (!m) continue;
        const inline = m[2].trim();
        if (inline) return inline;
        for (let k = c + 1; k < row.length; k++) { const v = row[k]; if (v != null && String(v).trim()) return String(v).trim(); }
      }
    }
    return null;
  }

  function extractStations(aoa, headerRow, map) {
    const out = [];
    for (let r = headerRow + 1; r < aoa.length; r++) {
      const row = aoa[r]; if (!row) continue;
      const md = num(row[map.md]), inc = num(row[map.inc]), azm = num(row[map.azm]);
      if (md == null || inc == null || azm == null) continue;
      if (inc < 0 || inc > 180 || azm < -360 || azm > 360) continue;
      if (md === 0 && inc === 0 && azm === 0) continue; // surface tie-in
      out.push({ md, inc, azm, row: r + 1 });
    }
    out.sort((a, b) => a.md - b.md);
    return out;
  }

  function workbookFrom(buf, name, XLSX) {
    const lower = String(name || '').toLowerCase();
    if (/\.(csv|txt|tsv|prn)$/.test(lower) || !/\.(xls|xlsx|xlsm|xlsb|xlt|xltx|ods)$/.test(lower)) {
      const bytes = new Uint8Array(buf);
      const isOle = bytes[0] === 0xD0 && bytes[1] === 0xCF, isZip = bytes[0] === 0x50 && bytes[1] === 0x4B;
      if (!isOle && !isZip) {
        let text = new TextDecoder('utf-8').decode(bytes);
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        return XLSX.read(text, { type: 'string' });
      }
    }
    return XLSX.read(buf, { type: 'array' });
  }

  // Returns { name, sheet, headerRow, auto, map, columns, well, stations }
  function parseSurveyFile(buf, name, XLSX) {
    XLSX = XLSX || (typeof globalThis !== 'undefined' && globalThis.XLSX);
    if (!XLSX) throw new Error('SheetJS (XLSX) is required to parse files');
    const wb = workbookFrom(buf, name, XLSX);
    let best = null;
    for (const sn of wb.SheetNames) {
      const ws = wb.Sheets[sn]; if (!ws || !ws['!ref']) continue;
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
      const det = detectHeader(aoa);
      if (det && (!best || (det.auto && !best.det.auto))) best = { sheet: sn, aoa, det };
      if (best && best.det.auto) break;
    }
    if (!best) throw new Error('No survey table found. Expected columns for MD, INC and AZM.');
    const headerCells = best.det.row >= 0 ? (best.aoa[best.det.row] || []) : [];
    const columns = headerCells.map((h, c) => (h == null || h === '' ? 'Column ' + (c + 1) : String(h).replace(/\s+/g, ' ').trim()));
    return {
      name, sheet: best.sheet, headerRow: best.det.row, auto: best.det.auto, map: { ...best.det.map }, columns,
      well: findWellName(best.aoa, best.det.row),
      stations: extractStations(best.aoa, best.det.row, best.det.map),
    };
  }

  // sources: { key: stations[] }  refKey: which source is the reference (defaults to 'mwd' or the first key)
  function compareSurveys(sources, refKey) {
    const keys = Object.keys(sources).filter((k) => Array.isArray(sources[k]) && sources[k].length);
    const ref = refKey && keys.includes(refKey) ? refKey : (keys.includes('mwd') ? 'mwd' : keys[0]);
    const others = keys.filter((k) => k !== ref);

    const all = [];
    keys.forEach((k) => sources[k].forEach((st) => all.push({ src: k, ...st })));
    all.sort((a, b) => a.md - b.md || keys.indexOf(a.src) - keys.indexOf(b.src));

    const clusters = [];
    let cur = null;
    for (const st of all) {
      if (!cur || st.md - cur.anchor > EPS || cur.items[st.src]) { cur = { anchor: st.md, items: {} }; clusters.push(cur); }
      cur.items[st.src] = st;
    }

    const rows = clusters.map((c) => {
      const r = ref ? c.items[ref] : null;
      const row = { md: r ? r.md : c.anchor, items: c.items, missing: keys.filter((k) => !c.items[k]), deltas: {}, status: 'ok' };
      if (r) others.forEach((k) => {
        const o = c.items[k]; if (!o) return;
        const dInc = o.inc - r.inc, dAzm = wrapAz(o.azm - r.azm);
        row.deltas[k] = { dInc, dAzm, fInc: Math.abs(dInc) > EPS, fAzm: Math.abs(dAzm) > EPS };
      });
      const flags = Object.values(row.deltas).some((d) => d.fInc || d.fAzm);
      row.status = row.missing.length ? 'missing' : flags ? 'mismatch' : 'ok';
      return row;
    });

    const summary = {};
    others.forEach((k) => {
      const c = { matched: 0, inc: 0, azm: 0, missing: 0, extra: 0 };
      rows.forEach((row) => {
        const d = row.deltas[k];
        if (row.items[ref] && !row.items[k]) c.missing++;
        if (!row.items[ref] && row.items[k]) c.extra++;
        if (d) { c.matched++; if (d.fInc) c.inc++; if (d.fAzm) c.azm++; }
      });
      c.issues = c.inc + c.azm + c.missing + c.extra;
      summary[k] = c;
    });

    return { ref, others, rows, summary };
  }

  return { classify, detectHeader, findWellName, extractStations, parseSurveyFile, compareSurveys, wrapAz, PAT, REJECT };
});
