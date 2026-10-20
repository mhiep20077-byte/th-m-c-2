import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  addExcluded,
  addHistory,
  getExcludedIds,
  getFavoriteIds,
  getHistory,
  getMealRecords,
  isExcluded,
  isFavorite,
  removeExcluded,
  saveMealRecord,
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

test('keeps only the ten most recently viewed dishes', () => {
  for (let id = 1; id <= 12; id += 1) addHistory(id, `Món ${id}`);

  const history = getHistory();
  assert.equal(history.length, 10);
  assert.equal(history[0].id, 12);
  assert.equal(history[9].id, 3);
});

test('normalizes invalid dish history records from LocalStorage', () => {
  globalThis.localStorage.setItem('bungoi-history', JSON.stringify([
    null,
    { id: 'not-a-number', name: 'Không hợp lệ', timestamp: 1 },
    { id: '4', name: '<Món 4>', timestamp: 'not-a-date' }
  ]));

  assert.deepEqual(getHistory(), [{ id: 4, name: '<Món 4>', timestamp: 0 }]);
});

test('keeps only the twenty most recently served meals', () => {
  for (let id = 1; id <= 25; id += 1) {
    saveMealRecord([{ id, name: `Món ${id}`, price: id * 1000 }], id * 1000);
  }

  const meals = getMealRecords();
  assert.equal(meals.length, 20);
  assert.equal(meals[0].dishes[0].id, 25);
  assert.equal(meals[19].dishes[0].id, 6);
});

test('trims oversized saved meal history when reading LocalStorage', () => {
  const records = Array.from({ length: 25 }, (_, index) => ({
    dishes: [{ id: index + 1, name: `Món ${index + 1}`, price: 1000 }],
    total: 1000,
    at: index
  }));
  globalThis.localStorage.setItem('bungoi-meals', JSON.stringify(records));

  const meals = getMealRecords();
  assert.equal(meals.length, 20);
  assert.equal(meals[0].dishes[0].id, 1);
  assert.equal(meals[19].dishes[0].id, 20);
  assert.equal(JSON.parse(globalThis.localStorage.getItem('bungoi-meals')).length, 20);
});
