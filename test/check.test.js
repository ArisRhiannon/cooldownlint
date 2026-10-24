'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { check } = require('../src/check');

function repo(files) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cdl-'));
  for (const [f, c] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), c); }
  return d;
}
const ids = (r) => r.findings.map((f) => `${f.manager}:${f.ruleId}`).sort();
const run = (files, o = {}) => check(repo(files), { env: {}, ...o });

test('npm without cooldown -> CD001', () => assert.deepStrictEqual(ids(run({ 'package-lock.json': '{}' })), ['npm:CD001']));
test('npm with .npmrc 7 days -> clean', () => {
  const r = run({ 'package-lock.json': '{}', '.npmrc': 'min-release-age=7\n' });
  assert.deepStrictEqual(ids(r), []); assert.strictEqual(r.managers[0].days, 7);
});
test('npm env var overrides', () => assert.deepStrictEqual(ids(run({ 'package-lock.json': '{}' }, { env: { NPM_CONFIG_MIN_RELEASE_AGE: '1' } })), ['npm:CD002']));
test('npm before= fixed cutoff -> CD003', () => assert.deepStrictEqual(ids(run({ 'package-lock.json': '{}', '.npmrc': 'before=2026-01-01\n' })), ['npm:CD003']));
test('pnpm minutes converted', () => {
  const r = run({ 'pnpm-lock.yaml': '', 'pnpm-workspace.yaml': 'minimumReleaseAge: 1440\n' });
  assert.strictEqual(r.managers[0].days, 1); assert.deepStrictEqual(ids(r), ['pnpm:CD002']);
});
test('pnpm unset -> CD006 info', () => assert.deepStrictEqual(ids(run({ 'pnpm-lock.yaml': '' })), ['pnpm:CD006']));
test('bun seconds', () => assert.deepStrictEqual(ids(run({ 'bun.lock': '', 'bunfig.toml': '[install]\nminimumReleaseAge = 604800\n' })), []));
test('uv pyproject duration', () => {
  const r = run({ 'uv.lock': '', 'pyproject.toml': '[project]\nname="x"\n[tool.uv]\nexclude-newer = "1 week"\n' });
  assert.strictEqual(r.managers[0].days, 7);
});
test('uv fixed timestamp -> CD003', () => assert.deepStrictEqual(ids(run({ 'uv.lock': '', 'uv.toml': 'exclude-newer = "2026-08-05T00:00:00Z"\n' })), ['uv:CD003']));
test('pip conf ISO duration', () => assert.deepStrictEqual(ids(run({ 'requirements.txt': 'x', 'pip.conf': '[install]\nuploaded-prior-to = P7D\n' })), []));
test('pip without -> CD001', () => assert.deepStrictEqual(ids(run({ 'requirements-dev.txt': 'x' })), ['pip:CD001']));
test('renovate string and missing', () => {
  assert.deepStrictEqual(ids(run({ 'renovate.json': '{"minimumReleaseAge":"5 days"}' })), []);
  assert.deepStrictEqual(ids(run({ 'renovate.json': '{"extends":["config:recommended"]}' })), ['renovate:CD004']);
});
test('dependabot partial cooldown', () => {
  const y = 'version: 2\nupdates:\n  - package-ecosystem: npm\n    cooldown:\n      default-days: 7\n  - package-ecosystem: github-actions\n';
  assert.deepStrictEqual(ids(run({ '.github/dependabot.yml': y })), ['dependabot:CD005']);
});
test('min-days policy', () => assert.deepStrictEqual(ids(run({ 'package-lock.json': '{}', '.npmrc': 'min-release-age=7' }, { minDays: 14 })), ['npm:CD002']));
test('empty dir has no managers', () => assert.deepStrictEqual(run({}).managers, []));
