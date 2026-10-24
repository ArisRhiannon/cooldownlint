'use strict';
const test = require('node:test');
const assert = require('node:assert');
const p = require('../src/parse');

test('human durations', () => {
  assert.strictEqual(p.parseHumanDuration('7 days'), 7);
  assert.strictEqual(p.parseHumanDuration('"1 week"'), 7);
  assert.strictEqual(p.parseHumanDuration('72 hours'), 3);
  assert.strictEqual(p.parseHumanDuration('3d'), 3);
  assert.strictEqual(p.parseHumanDuration('P7D'), 7);
  assert.strictEqual(p.parseHumanDuration('PT12H'), 0.5);
  assert.strictEqual(p.parseHumanDuration('soon'), null);
});
test('timestamps', () => {
  assert.ok(p.isTimestamp('2026-08-05T00:00:00Z'));
  assert.ok(p.isTimestamp('"2026-08-05"'));
  assert.ok(!p.isTimestamp('7 days'));
});
test('ini, toml table, yaml top', () => {
  assert.deepStrictEqual(p.readIni('# c\nmin-release-age = 7 # days\n[x]\nfoo=bar'), { 'min-release-age': '7', foo: 'bar' });
  assert.deepStrictEqual(p.readTomlTable('[a]\nx = 1\n[tool.uv]\nexclude-newer = "3 days"\n[b]\ny=2', 'tool.uv'), { 'exclude-newer': '"3 days"' });
  assert.strictEqual(p.readYamlTop('packages:\n  - a\nminimumReleaseAge: 4320 # 3d\n', 'minimumReleaseAge'), '4320');
});
