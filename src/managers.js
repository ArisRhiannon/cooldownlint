'use strict';
const fs = require('fs');
const path = require('path');
const { parseHumanDuration, isTimestamp, readIni, readTomlTable, readYamlTop } = require('./parse');

const exists = (dir, f) => fs.existsSync(path.join(dir, f));
const read = (dir, f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch { return null; } };

// Each check returns { manager, inUse, evidence, days, source, fixed, note, fix }
// days: null = not configured; number = effective cooldown in days. fixed = a fixed timestamp cutoff.

function npm(dir, env) {
  const inUse = exists(dir, 'package-lock.json') || (exists(dir, 'package.json') && !exists(dir, 'pnpm-lock.yaml') && !exists(dir, 'yarn.lock') && !exists(dir, 'bun.lock') && !exists(dir, 'bun.lockb'));
  const r = { manager: 'npm', inUse, evidence: exists(dir, 'package-lock.json') ? 'package-lock.json' : 'package.json', days: null, source: null,
    fix: '# .npmrc (npm >= 11.10)\nmin-release-age=7' };
  if (env.NPM_CONFIG_MIN_RELEASE_AGE) { r.days = Number(env.NPM_CONFIG_MIN_RELEASE_AGE); r.source = 'env NPM_CONFIG_MIN_RELEASE_AGE'; return r; }
  const t = read(dir, '.npmrc');
  if (t) {
    const ini = readIni(t);
    if (ini['min-release-age'] !== undefined) { r.days = Number(ini['min-release-age']); r.source = '.npmrc min-release-age'; }
    else if (ini.before) { r.fixed = ini.before; r.source = '.npmrc before'; }
  }
  return r;
}

function pnpm(dir) {
  const r = { manager: 'pnpm', inUse: exists(dir, 'pnpm-lock.yaml') || exists(dir, 'pnpm-workspace.yaml'), evidence: 'pnpm-lock.yaml', days: null, source: null,
    fix: '# pnpm-workspace.yaml (pnpm >= 10.16; minutes)\nminimumReleaseAge: 10080', note: null };
  const t = read(dir, 'pnpm-workspace.yaml');
  const v = t && readYamlTop(t, 'minimumReleaseAge');
  if (v !== null && v !== undefined && v !== '') { r.days = Number(v) / 1440; r.source = 'pnpm-workspace.yaml minimumReleaseAge (minutes)'; }
  else {
    const npmrc = read(dir, '.npmrc');
    const ini = npmrc ? readIni(npmrc) : {};
    if (ini['minimum-release-age'] !== undefined) { r.days = Number(ini['minimum-release-age']) / 1440; r.source = '.npmrc minimum-release-age (pnpm 10, minutes)'; }
    else r.note = 'pnpm >= 11 defaults to 1 day (1440 min) when unset; older pnpm has no default.';
  }
  return r;
}

function bun(dir) {
  const r = { manager: 'bun', inUse: exists(dir, 'bun.lock') || exists(dir, 'bun.lockb') || exists(dir, 'bunfig.toml'), evidence: 'bun.lock', days: null, source: null,
    fix: '# bunfig.toml (seconds)\n[install]\nminimumReleaseAge = 604800' };
  const t = read(dir, 'bunfig.toml');
  const v = t && readTomlTable(t, 'install').minimumReleaseAge;
  if (v) { r.days = Number(v) / 86400; r.source = 'bunfig.toml [install] minimumReleaseAge (seconds)'; }
  return r;
}

function uv(dir, env) {
  const r = { manager: 'uv', inUse: exists(dir, 'uv.lock'), evidence: 'uv.lock', days: null, source: null,
    fix: '# pyproject.toml (uv >= 0.9.17)\n[tool.uv]\nexclude-newer = "7 days"' };
  const apply = (v, src) => {
    if (isTimestamp(v)) { r.fixed = v.replace(/^["']|["']$/g, ''); r.source = src; return true; }
    const d = parseHumanDuration(v);
    if (d !== null) { r.days = d; r.source = src; return true; }
    return false;
  };
  if (env.UV_EXCLUDE_NEWER && apply(env.UV_EXCLUDE_NEWER, 'env UV_EXCLUDE_NEWER')) return r;
  const u = read(dir, 'uv.toml');
  if (u) { const top = readTomlTable(`[root]\n${u}`, 'root'); if (top['exclude-newer'] && apply(top['exclude-newer'], 'uv.toml exclude-newer')) return r; }
  const p = read(dir, 'pyproject.toml');
  if (p) { const t = readTomlTable(p, 'tool.uv'); if (t['exclude-newer']) apply(t['exclude-newer'], 'pyproject.toml [tool.uv] exclude-newer'); }
  return r;
}

function pip(dir, env) {
  const req = fs.readdirSync(dir).find((f) => /^requirements.*\.txt$/.test(f));
  const r = { manager: 'pip', inUse: Boolean(req) && !exists(dir, 'uv.lock'), evidence: req || 'requirements.txt', days: null, source: null,
    fix: '# pip.conf (pip >= 26.1)\n[install]\nuploaded-prior-to = P7D' };
  const set = (v, src) => { if (isTimestamp(v)) { r.fixed = v; r.source = src; } else { const d = parseHumanDuration(v); if (d !== null) { r.days = d; r.source = src; } } };
  if (env.PIP_UPLOADED_PRIOR_TO) { set(env.PIP_UPLOADED_PRIOR_TO, 'env PIP_UPLOADED_PRIOR_TO'); return r; }
  for (const f of ['pip.conf', 'pip.ini']) {
    const t = read(dir, f);
    if (t) { const v = readIni(t)['uploaded-prior-to']; if (v) { set(v, `${f} uploaded-prior-to`); return r; } }
  }
  if (req) { const m = /--uploaded-prior-to[= ](\S+)/.exec(read(dir, req) || ''); if (m) set(m[1], `${req} --uploaded-prior-to`); }
  return r;
}

function renovate(dir) {
  const files = ['renovate.json', 'renovate.json5', '.renovaterc', '.renovaterc.json', '.github/renovate.json', '.github/renovate.json5', '.gitlab/renovate.json'];
  const f = files.find((x) => exists(dir, x));
  const r = { manager: 'renovate', bot: true, inUse: Boolean(f), evidence: f || 'renovate.json', days: null, source: null,
    fix: '// renovate.json\n{ "minimumReleaseAge": "7 days" }' };
  if (!f) return r;
  const t = read(dir, f);
  const m = /"?minimumReleaseAge"?\s*:\s*"([^"]+)"/.exec(t) || /"?stabilityDays"?\s*:\s*(\d+)/.exec(t);
  if (m) { r.days = /^\d+$/.test(m[1]) ? Number(m[1]) : parseHumanDuration(m[1]); r.source = `${f} ${m[0].split(':')[0].replace(/"/g, '').trim()}`; }
  if (/config:best-practices/.test(t) && r.days === null) { r.days = 3; r.source = `${f} extends config:best-practices (3 days for npm)`; }
  return r;
}

function dependabot(dir) {
  const f = ['.github/dependabot.yml', '.github/dependabot.yaml'].find((x) => exists(dir, x));
  const r = { manager: 'dependabot', bot: true, inUse: Boolean(f), evidence: f || '.github/dependabot.yml', days: null, source: null,
    fix: '# .github/dependabot.yml, inside each update entry\n    cooldown:\n      default-days: 7' };
  if (!f) return r;
  const t = read(dir, f);
  const updates = (t.match(/package-ecosystem\s*:/g) || []).length;
  const cds = [...t.matchAll(/default-days\s*:\s*(\d+)/g)].map((m) => Number(m[1]));
  if (cds.length) {
    r.days = Math.min(...cds); r.source = `${f} cooldown.default-days`;
    if (cds.length < updates) r.note = `${updates - cds.length} of ${updates} update entries have no cooldown`;
    r.partial = cds.length < updates;
  }
  return r;
}

const ALL = [npm, pnpm, bun, uv, pip, renovate, dependabot];
module.exports = { ALL, npm, pnpm, bun, uv, pip, renovate, dependabot };
