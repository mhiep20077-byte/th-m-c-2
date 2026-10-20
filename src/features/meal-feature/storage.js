/**
 * Quản lý lưu trữ LocalStorage cho chức năng dựng bữa cơm
 */

const STORAGE_KEYS = {
  FAVORITES: 'bungoi-favorites',
  EXCLUDED: 'bungoi-excluded',
  HISTORY: 'bungoi-history',
  MEALS: 'bungoi-meals'
};

const MAX_MEAL_RECORDS = 20;
const MAX_HISTORY = 10;

function readIdList(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(Number).filter(Number.isFinite);
  } catch (error) {
    console.warn(`Không đọc được "${key}" từ localStorage:`, error);
    return [];
  }
}

function writeIdList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
    return true;
  } catch (error) {
    console.warn(`Không ghi được "${key}" vào localStorage:`, error);
    return false;
  }
}

export function getFavoriteIds() {
  return readIdList(STORAGE_KEYS.FAVORITES);
}

export function isFavorite(id) {
  return getFavoriteIds().includes(Number(id));
}

export function toggleFavorite(id) {
  const dishId = Number(id);
  if (!Number.isFinite(dishId)) return false;

  const list = getFavoriteIds();
  const index = list.indexOf(dishId);
  const exists = index !== -1;

  if (exists) {
    list.splice(index, 1);
  } else {
    list.push(dishId);
  }

  return writeIdList(STORAGE_KEYS.FAVORITES, list) && !exists;
}

export function getExcludedIds() {
  return readIdList(STORAGE_KEYS.EXCLUDED);
}

export function isExcluded(id) {
  return getExcludedIds().includes(Number(id));
}

export function addExcluded(id) {
  const dishId = Number(id);
  if (!Number.isFinite(dishId)) return false;
  const list = getExcludedIds();
  if (list.includes(dishId)) return false;
  list.push(dishId);
  return writeIdList(STORAGE_KEYS.EXCLUDED, list);
}

export function removeExcluded(id) {
  const dishId = Number(id);
  const list = getExcludedIds();
  const next = list.filter(item => item !== dishId);
  if (next.length === list.length) return false;
  return writeIdList(STORAGE_KEYS.EXCLUDED, next);
}

export function getHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(item => item && Number.isFinite(Number(item.id)))
      .map(item => ({
        id: Number(item.id),
        name: String(item.name || ''),
        timestamp: Number.isFinite(Number(item.timestamp)) ? Number(item.timestamp) : 0
      }))
      .slice(0, MAX_HISTORY);
  } catch (error) {
    console.warn(`Không đọc được "${STORAGE_KEYS.HISTORY}" từ localStorage:`, error);
    return [];
  }
}

export function addHistory(id, name) {
  const dishId = Number(id);
  if (!Number.isFinite(dishId)) return;
  const list = getHistory().filter(item => item.id !== dishId);
  const next = [{ id: dishId, name: String(name || ''), timestamp: Date.now() }, ...list].slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(next));
  } catch (error) {
    console.warn(`Không ghi được "${STORAGE_KEYS.HISTORY}" vào localStorage:`, error);
  }
}

/* ============ Sổ bữa ăn đã dọn ============ */

/**
 * Đọc sổ những bữa ăn đã dọn, mới nhất trước
 * @returns {Array<{ dishes: Array<{id: number, name: string, price: number}>, total: number, at: number }>}
 */
export function getMealRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MEALS);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(item => item && Array.isArray(item.dishes) && item.dishes.length > 0);
  } catch (error) {
    console.warn(`Không đọc được "${STORAGE_KEYS.MEALS}" từ localStorage:`, error);
    return [];
  }
}

/**
 * Ghi một bữa ăn vừa dọn vào sổ, giữ tối đa MAX_MEAL_RECORDS bữa gần nhất
 * @param {Array<Object>} dishes - Các món trong bữa
 * @param {number} total - Tổng giá của bữa
 * @returns {Array<Object>} Sổ bữa ăn sau khi cập nhật
 */
export function saveMealRecord(dishes, total) {
  const safeDishes = Array.isArray(dishes)
    ? dishes.filter(Boolean).map(dish => ({ id: dish.id, name: dish.name, price: dish.price }))
    : [];
  if (safeDishes.length === 0) return getMealRecords();

  const record = { dishes: safeDishes, total, at: Date.now() };
  const next = [record, ...getMealRecords()].slice(0, MAX_MEAL_RECORDS);

  try {
    localStorage.setItem(STORAGE_KEYS.MEALS, JSON.stringify(next));
  } catch (error) {
    console.warn(`Không ghi được "${STORAGE_KEYS.MEALS}" vào localStorage:`, error);
  }

  return next;
}
