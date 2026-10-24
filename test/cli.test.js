'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { main } = require('../src/cli');

function run(args) { let out = '', err = ''; const code = main(args, { stdout: { write: (s) => { out += s; } }, stderr: { write: (s) => { err += s; } } }); return { code, out, err }; }
const dir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cdl-cli-'));

test('help/version/rules', () => {
  assert.match(run(['--help']).out, /Usage:/);
  assert.match(run(['-v']).out, /^\d+\.\d+\.\d+/);
  assert.match(run(['--rules']).out, /CD001/);
});
test('usage errors exit 2', () => {
  assert.strictEqual(run(['--bogus']).code, 2);
  assert.strictEqual(run(['/nope/nope']).code, 2);
  assert.strictEqual(run(['--min-days', 'x']).code, 2);
});
test('finding exits 1, json + sarif, --fix', () => {
  const d = dir(); fs.writeFileSync(path.join(d, 'package-lock.json'), '{}');
  const t = run([d, '--fix']); assert.strictEqual(t.code, 1); assert.match(t.out, /min-release-age=7/);
  assert.strictEqual(JSON.parse(run([d, '-f', 'json']).out).findings[0].ruleId, 'CD001');
  const s = JSON.parse(run([d, '-f', 'sarif']).out); assert.strictEqual(s.runs[0].results[0].ruleId, 'CD001');
});
test('clean repo exits 0', () => {
  const d = dir(); fs.writeFileSync(path.join(d, 'package-lock.json'), '{}'); fs.writeFileSync(path.join(d, '.npmrc'), 'min-release-age=7');
  assert.strictEqual(run([d]).code, 0);
});
