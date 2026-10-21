import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addExcluded, toggleFavorite } from './storage.js';

test('does not report successful persistence when LocalStorage writes fail', () => {
  const originalStorage = globalThis.localStorage;
  const originalWarn = console.warn;
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error('storage unavailable');
    }
  };
  console.warn = () => {};

  try {
    assert.equal(toggleFavorite(12), false);
    assert.equal(addExcluded(12), false);
  } finally {
    console.warn = originalWarn;
    if (originalStorage === undefined) {
      delete globalThis.localStorage;
    } else {
      globalThis.localStorage = originalStorage;
    }
  }
});
