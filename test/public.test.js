import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { page } from '../lib/admin-page.js';

test('existing generator still renders five games of six distinct sorted numbers', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const elements = Object.fromEntries(['generateBtn', 'games', 'placeholder'].map(id => [id, {}]));
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], { document: { getElementById: id => elements[id] }, Math });
  for (let i = 0; i < 100; i++) {
    elements.generateBtn.onclick();
    const values = [...elements.games.innerHTML.matchAll(/class="ball [^"]+">(\d+)</g)].map(m => Number(m[1]));
    assert.equal(values.length, 30);
    for (let j = 0; j < 30; j += 6) {
      const game = values.slice(j, j + 6);
      assert.equal(new Set(game).size, 6);
      assert.ok(game.every(n => n >= 1 && n <= 45));
      assert.deepEqual(game, [...game].sort((a, b) => a - b));
    }
  }
  assert.equal(elements.games.hidden, false);
  assert.equal(elements.placeholder.hidden, true);
  assert.doesNotMatch(html, /href=["']\/admin/);
});
test('admin inline scripts parse and telemetry failure does not throw', () => {
  for (const authenticated of [true, false]) {
    const html = page(authenticated, 'test-nonce');
    new vm.Script(html.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1]);
  }
  const telemetry = readFileSync(new URL('../telemetry.js', import.meta.url), 'utf8');
  assert.doesNotThrow(() => vm.runInNewContext(telemetry, {}));
});
