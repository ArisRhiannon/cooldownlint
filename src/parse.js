'use strict';
// Duration helpers. Everything is normalised to days (floating point).

const UNIT_DAYS = { s: 1 / 86400, sec: 1 / 86400, second: 1 / 86400, m: 1 / 1440, min: 1 / 1440, minute: 1 / 1440, h: 1 / 24, hour: 1 / 24, d: 1, day: 1, w: 7, week: 7 };

/** Parse "7 days", "1 week", "3d", "72 hours", ISO-8601 "P7D"/"PT12H". Returns days or null. */
function parseHumanDuration(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/^["']|["']$/g, '');
  const iso = /^P(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(s);
  if (iso && s.length > 1) {
    const [, w, d, h, m, sec] = iso.map((x) => (x === undefined ? 0 : Number(x)));
    return w * 7 + d + h / 24 + m / 1440 + sec / 86400;
  }
  const parts = [...s.matchAll(/(\d+(?:\.\d+)?)\s*([a-z]+)/gi)];
  if (!parts.length) return null;
  let total = 0;
  for (const [, n, u] of parts) {
    const key = u.toLowerCase().replace(/s$/, '');
    if (!(key in UNIT_DAYS)) return null;
    total += Number(n) * UNIT_DAYS[key];
  }
  return total;
}

function isTimestamp(v) {
  return /^\d{4}-\d{2}-\d{2}([T ][\d:.]+)?(Z|[+-]\d{2}:?\d{2})?$/.test(String(v).trim().replace(/^["']|["']$/g, ''));
}

/** Minimal INI / .npmrc reader: key = value, ignores comments and sections. */
function readIni(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s[#;].*$/, '').trim();
    if (!line || line.startsWith('#') || line.startsWith(';') || line.startsWith('[')) continue;
    const m = /^([^=]+?)\s*=\s*(.*)$/.exec(line);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

/** Read `key = value` lines inside a TOML table such as [tool.uv] or [install]. */
function readTomlTable(text, table) {
  const out = {};
  let inTable = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s#.*$/, '').trim();
    const sec = /^\[([^\]]+)\]$/.exec(line);
    if (sec) { inTable = sec[1].trim() === table; continue; }
    if (!inTable || !line) continue;
    const m = /^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/.exec(line);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

/** Top-level scalar from simple YAML (no nesting). */
function readYamlTop(text, key) {
  const re = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^#\\n]+)`, 'm');
  const m = re.exec(text);
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
}

module.exports = { parseHumanDuration, isTimestamp, readIni, readTomlTable, readYamlTop };
