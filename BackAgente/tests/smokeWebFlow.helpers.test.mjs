import test from 'node:test';
import assert from 'node:assert/strict';

function normalizeBaseUrl(raw) {
  return String(raw || '')
    .trim()
    .replace(/\/+$/, '');
}

test('normalizeBaseUrl recorta espacios y slash final', () => {
  assert.equal(normalizeBaseUrl(' http://localhost:3000/ '), 'http://localhost:3000');
  assert.equal(normalizeBaseUrl('https://demo.com///'), 'https://demo.com');
});

