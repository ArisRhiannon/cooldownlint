'use strict';
const fs = require('fs');
const { check, RULES, fmt } = require('./check');
const { version } = require('../package.json');

const SEV = ['info', 'low', 'medium', 'high', 'critical'];
const HELP = `cooldownlint ${version} - check that every package manager in a repo waits before installing brand-new releases

Usage: cooldownlint [options] [dir]

Detects npm, pnpm, Bun, uv, pip, Renovate and Dependabot in <dir> (default: .)
and reports the effective dependency cooldown (min-release-age,
minimumReleaseAge, exclude-newer, uploaded-prior-to, cooldown.default-days).
Reads files only; never touches the network.

Options:
  --min-days <n>        policy minimum in days (default: 3)
  -f, --format <fmt>    text (default), json, sarif
  --fix                 print a config snippet for every finding
  --fail-on <sev>       exit 1 at/above info|low|medium|high (default: medium)
  --rules               list rules
  -h, --help            show help
  -v, --version         show version

Exit codes: 0 ok, 1 findings at/above --fail-on, 2 usage error.`;

function sarif(res) {
  const lvl = { high: 'error', medium: 'warning', low: 'note', info: 'note' };
  const ids = [...new Set(res.findings.map((f) => f.ruleId))];
  return JSON.stringify({ $schema: 'https://json.schemastore.org/sarif-2.1.0.json', version: '2.1.0', runs: [{
    tool: { driver: { name: 'cooldownlint', version, informationUri: 'https://github.com/ArisRhiannon/cooldownlint', rules: ids.map((id) => ({ id, name: RULES[id].name, shortDescription: { text: RULES[id].name }, fullDescription: { text: RULES[id].help } })) } },
    results: res.findings.map((f) => ({ ruleId: f.ruleId, level: lvl[f.severity], message: { text: f.message }, locations: [{ physicalLocation: { artifactLocation: { uri: f.file } } }] })),
  }] }, null, 2);
}

function main(argv, io = process) {
  const o = { dir: '.', minDays: 3, format: 'text', failOn: 'medium' };
  try {
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      const val = () => { if (argv[i + 1] === undefined) throw new Error(`${a} needs a value`); return argv[++i]; };
      if (a === '-h' || a === '--help') { io.stdout.write(`${HELP}\n`); return 0; }
      if (a === '-v' || a === '--version') { io.stdout.write(`${version}\n`); return 0; }
      if (a === '--rules') { for (const [id, r] of Object.entries(RULES)) io.stdout.write(`${id}  ${r.severity.padEnd(7)} ${r.name}\n    ${r.help}\n`); return 0; }
      if (a === '--min-days') { o.minDays = Number(val()); if (!(o.minDays >= 0)) throw new Error('--min-days must be a number'); }
      else if (a === '-f' || a === '--format') { o.format = val(); if (!['text', 'json', 'sarif'].includes(o.format)) throw new Error(`unknown format ${o.format}`); }
      else if (a === '--fail-on') { o.failOn = val(); if (!SEV.includes(o.failOn)) throw new Error(`unknown severity ${o.failOn}`); }
      else if (a === '--fix') o.fix = true;
      else if (a.startsWith('-')) throw new Error(`unknown option ${a}`);
      else o.dir = a;
    }
    if (!fs.existsSync(o.dir) || !fs.statSync(o.dir).isDirectory()) throw new Error(`not a directory: ${o.dir}`);
  } catch (e) { io.stderr.write(`cooldownlint: ${e.message}\n`); return 2; }

  const res = check(o.dir, { minDays: o.minDays });
  if (o.format === 'json') io.stdout.write(`${JSON.stringify({ tool: 'cooldownlint', version, ...res }, null, 2)}\n`);
  else if (o.format === 'sarif') io.stdout.write(`${sarif(res)}\n`);
  else {
    if (!res.managers.length) io.stdout.write('No supported package manager or update bot detected.\n');
    for (const m of res.managers) io.stdout.write(`${m.manager.padEnd(11)} ${m.fixed ? `fixed cutoff ${m.fixed}` : fmt(m.days).padEnd(12)} ${m.source || ''}\n`);
    if (res.findings.length) io.stdout.write('\n');
    for (const f of res.findings) {
      io.stdout.write(`${f.severity.toUpperCase().padEnd(7)} ${f.ruleId} ${f.message}\n`);
      if (o.fix) io.stdout.write(`${f.fix.replace(/^/gm, '        ')}\n`);
    }
    io.stdout.write(`\npolicy: >= ${o.minDays} days | ${res.findings.length} finding(s)\n`);
  }
  return res.findings.some((f) => SEV.indexOf(f.severity) >= SEV.indexOf(o.failOn)) ? 1 : 0;
}

module.exports = { main };
