import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  addExcluded,
  getExcludedIds,
  getFavoriteIds,
  isExcluded,
  isFavorite,
  removeExcluded,
  toggleFavorite
} from './storage.js';

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

let originalStorage;

beforeEach(() => {
  originalStorage = globalThis.localStorage;
  globalThis.localStorage = new MemoryStorage();
});

afterEach(() => {
  if (originalStorage === undefined) {
    delete globalThis.localStorage;
  } else {
    globalThis.localStorage = originalStorage;
  }
});

test('toggles dish favorites in LocalStorage', () => {
  assert.equal(toggleFavorite(12), true);
  assert.equal(isFavorite(12), true);
  assert.deepEqual(getFavoriteIds(), [12]);

  assert.equal(toggleFavorite(12), false);
  assert.equal(isFavorite(12), false);
  assert.deepEqual(getFavoriteIds(), []);
});

test('adds and removes excluded dishes without duplicates', () => {
  assert.equal(addExcluded(8), true);
  assert.equal(addExcluded(8), false);
  assert.equal(isExcluded(8), true);
  assert.deepEqual(getExcludedIds(), [8]);

  assert.equal(removeExcluded(8), true);
  assert.equal(removeExcluded(8), false);
  assert.equal(isExcluded(8), false);
});
