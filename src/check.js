'use strict';
const { ALL } = require('./managers');

const RULES = {
  CD001: { name: 'no-cooldown', severity: 'high', help: 'This package manager is used here but has no release-age cooldown, so a version published minutes ago can be installed.' },
  CD002: { name: 'cooldown-too-short', severity: 'medium', help: 'A cooldown is configured but is shorter than the policy minimum (--min-days).' },
  CD003: { name: 'fixed-date-cutoff', severity: 'medium', help: 'A fixed timestamp is used instead of a rolling duration. It blocks all newer releases forever and is usually forgotten.' },
  CD004: { name: 'bot-without-cooldown', severity: 'medium', help: 'An update bot (Renovate/Dependabot) opens PRs for brand-new releases with no waiting period.' },
  CD005: { name: 'partial-cooldown', severity: 'low', help: 'Only some update entries have a cooldown.' },
  CD006: { name: 'implicit-default', severity: 'info', help: 'No explicit setting; relying on a package-manager default that depends on its version.' },
};

function check(dir, opts = {}) {
  const env = opts.env || process.env;
  const minDays = opts.minDays ?? 3;
  const results = ALL.map((fn) => fn(dir, env)).filter((r) => r.inUse);
  const findings = [];
  const add = (id, r, message) => findings.push({ ruleId: id, rule: RULES[id].name, severity: RULES[id].severity, manager: r.manager, file: r.source ? r.source.split(' ')[0] : r.evidence, message, fix: r.fix });
  for (const r of results) {
    if (r.fixed) add('CD003', r, `${r.manager}: fixed cutoff ${r.fixed} (${r.source}); use a rolling duration instead`);
    else if (r.days === null) {
      if (r.manager === 'pnpm' && r.note) add('CD006', r, `pnpm: no minimumReleaseAge set; ${r.note}`);
      else add(r.bot ? 'CD004' : 'CD001', r, `${r.manager}: no cooldown configured (detected via ${r.evidence})`);
    } else if (r.days + 1e-9 < minDays) add('CD002', r, `${r.manager}: cooldown is ${fmt(r.days)}, below the ${minDays}-day minimum (${r.source})`);
    if (r.partial) add('CD005', r, `${r.manager}: ${r.note}`);
  }
  return { managers: results.map(({ manager, days, source, fixed, note }) => ({ manager, days, source, fixed: fixed || null, note: note || null })), findings, minDays };
}

function fmt(days) {
  if (days === null) return 'none';
  if (days >= 1) return `${+days.toFixed(2)} day${days === 1 ? '' : 's'}`;
  if (days * 24 >= 1) return `${+(days * 24).toFixed(2)} hours`;
  return `${+(days * 1440).toFixed(1)} minutes`;
}

module.exports = { check, RULES, fmt };
