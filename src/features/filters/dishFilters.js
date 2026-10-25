// ============================================================
// 🔍 BungOiAnGi – Bộ lọc & Phân loại món ăn (Dish Filters)
// ============================================================

import { dishes as defaultDishes, BUDGETS, CATEGORIES } from '../../data/dishes.js';
import { pickWeightedDish } from '../../utils/weightEngine.js';

/**
 * Xóa dấu tiếng Việt và chuẩn hóa chuỗi để tìm kiếm không dấu
 * Vd: "Phở Bò Tái Nạm" -> "pho bo tai nam"
 */
export function removeVietnameseTones(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .trim();
}

/**
 * Kiểm tra xem giá trị có phải là "Chọn tất cả" không
 */
export function isAll(value) {
  if (!value) return true;
  const v = String(value).trim().toLowerCase();
  return v === 'all' || v === 'tat-ca' || v === '*' || v === '';
}

/**
 * Chuẩn hóa mã danh mục (hỗ trợ cả mã cũ và mới)
 */
export function normalizeCategory(cat) {
  if (isAll(cat)) return 'all';
  const c = String(cat).trim().toLowerCase();
  if (c === 'mon-nuoc' || c === 'nuoc') return 'nuoc';
  if (c === 'mon-com' || c === 'com') return 'com';
  if (c === 'mon-kho' || c === 'xao-kho' || c === 'kho') return 'xao-kho';
  if (c === 'an-vat' || c === 'anvat') return 'anvat';
  if (c === 'mon-ngot' || c === 'ngot') return 'ngot';
  if (c === 'do-uong' || c === 'uong') return 'uong';
  return c;
}

/**
 * Lấy tên hiển thị danh mục
 */
export function getCategoryLabel(catId) {
  const norm = normalizeCategory(catId);
  const found = CATEGORIES.find(c => c.id === norm);
  return found ? (found.label || found.name) : 'Món ăn';
}

/**
 * Lọc danh sách món ăn theo đa tiêu chí:
 * Hỗ trợ 2 cú pháp linh hoạt:
 * - Cách 1: filterDishes(dishesList, { moodId, budgetId, categoryId, query, diet, tags })
 * - Cách 2: filterDishes(moodId, budgetId, categoryId, query, diet, tags)
 *
 * @param {Array<Object>|string} targetOrMood
 * @param {Object|string} maybeBudgetId
 * @param {string} maybeCategoryId
 * @param {string} maybeQuery
 * @param {string} maybeDiet
 * @param {Array<string>} maybeTags
 * @returns {Array<Object>}
 */
export function filterDishes(targetOrMood, maybeBudgetId = 'all', maybeCategoryId = 'all', maybeQuery = '', maybeDiet = 'all', maybeTags = []) {
  let list = defaultDishes;
  let moodId = null;
  let budgetId = 'all';
  let categoryId = 'all';
  let query = '';
  let diet = 'all';
  let tags = [];

  if (Array.isArray(targetOrMood)) {
    list = targetOrMood;
    if (typeof maybeBudgetId === 'object' && maybeBudgetId !== null) {
      const opts = maybeBudgetId;
      moodId = opts.moodId || null;
      budgetId = opts.budgetId || 'all';
      categoryId = opts.categoryId || 'all';
      query = opts.query || '';
      diet = opts.diet || opts.type || 'all';
      tags = opts.tags || [];
    }
  } else {
    moodId = targetOrMood;
    budgetId = maybeBudgetId;
    categoryId = maybeCategoryId;
    query = maybeQuery;
    diet = maybeDiet;
    tags = maybeTags;
  }

  const cleanQuery = removeVietnameseTones(query);
  const normCategory = normalizeCategory(categoryId);

  return list.filter(dish => {
    // 0. Bỏ qua món bị Admin ẩn/tắt
    if (dish.active === false) return false;

    // 1. Lọc theo tâm trạng (mood)
    if (moodId && !isAll(moodId)) {
      if (!dish.moods || !dish.moods.includes(moodId)) {
        return false;
      }
    }

    // 2. Lọc theo ngân sách (budget)
    if (!isAll(budgetId)) {
      const b = BUDGETS.find(x => x.id === budgetId);
      if (b) {
        if (dish.price < b.min || dish.price > b.max) {
          return false;
        }
      } else if (dish.budget !== budgetId) {
        return false;
      }
    }

    // 3. Lọc theo danh mục (category)
    if (!isAll(normCategory)) {
      const dishCat = normalizeCategory(dish.category);
      if (dishCat !== normCategory) {
        return false;
      }
    }

    // 4. Lọc theo loại món: Chay / Mặn (diet / type)
    if (!isAll(diet)) {
      const targetDiet = String(diet).toLowerCase();
      const dishDiet = String(dish.type || dish.diet || '').toLowerCase();
      if (dishDiet !== targetDiet) {
        return false;
      }
    }

    // 5. Lọc theo từ khóa tìm kiếm (bỏ dấu tiếng Việt, tìm theo tên và mô tả)
    if (cleanQuery) {
      const nameMatch = removeVietnameseTones(dish.name).includes(cleanQuery);
      const descMatch = removeVietnameseTones(dish.desc || '').includes(cleanQuery);
      if (!nameMatch && !descMatch) {
        return false;
      }
    }

    // 6. Lọc theo danh sách tags (nếu chọn nhiều tag, hiển thị món có ít nhất 1 tag trong số đó)
    if (Array.isArray(tags) && tags.length > 0) {
      const dishTags = dish.tags || [];
      const hasAnyTag = tags.some(tag => dishTags.includes(tag));
      if (!hasAnyTag) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Sắp xếp danh sách món ăn
 * @param {Array<Object>} list
 * @param {string} sortMode 'price-asc' | 'price-desc' | 'rating' | 'calo' | 'default'
 * @returns {Array<Object>}
 */
export function sortDishes(list, sortMode = 'default') {
  if (!Array.isArray(list)) return [];
  const result = [...list];
  switch (sortMode) {
    case 'price-asc':
      return result.sort((a, b) => a.price - b.price);
    case 'price-desc':
      return result.sort((a, b) => b.price - a.price);
    case 'rating':
      return result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case 'calo':
      return result.sort((a, b) => (a.calo || 0) - (b.calo || 0));
    default:
      return result.sort((a, b) => {
        // 1. Món tài trợ (Sponsored) luôn nổi bật ghim lên đầu tiên
        if (Boolean(b.isSponsored) !== Boolean(a.isSponsored)) return b.isSponsored ? 1 : -1;
        // 2. Món Bestseller (Hot) lên tiếp theo
        if (Boolean(b.isBestseller) !== Boolean(a.isBestseller)) return b.isBestseller ? 1 : -1;
        // 3. Trọng số rơi cao hơn lên trước
        const weightDiff = (b.dropWeight || 1) - (a.dropWeight || 1);
        if (weightDiff !== 0) return weightDiff;
        // 4. Món phổ biến (popular)
        if (Boolean(b.popular) !== Boolean(a.popular)) return b.popular ? 1 : -1;
        return Number(b.id) - Number(a.id);
      });
  }
}

/**
 * Chọn ngẫu nhiên 1 món ăn từ danh sách đã lọc (có hỗ trợ chống lặp liên tiếp)
 */
export function getRandomDish(targetOrMood, maybeMoodOrBudget, maybeBudget, excludeDishId = null) {
  let pool = [];
  let moodId = null;
  let budgetId = 'all';

  if (Array.isArray(targetOrMood)) {
    if (typeof maybeMoodOrBudget === 'object' && maybeMoodOrBudget !== null) {
      moodId = maybeMoodOrBudget.moodId || null;
      budgetId = maybeMoodOrBudget.budgetId || 'all';
    } else {
      moodId = typeof maybeMoodOrBudget === 'string' ? maybeMoodOrBudget : null;
      budgetId = typeof maybeBudget === 'string' ? maybeBudget : (maybeMoodOrBudget?.budgetId || 'all');
    }
    pool = filterDishes(targetOrMood, { moodId, budgetId });
  } else {
    moodId = targetOrMood;
    budgetId = maybeMoodOrBudget;
    pool = filterDishes(defaultDishes, { moodId, budgetId });
  }

  const baseCandidates = pool.length > 0 ? pool : (Array.isArray(targetOrMood) ? targetOrMood : defaultDishes);

  // Anti-repeat: nếu pool có nhiều hơn 1 món, loại bỏ món vừa ra ở lượt trước để người dùng quay liên tục không bị kẹt 1 món
  if (excludeDishId && baseCandidates.length > 1) {
    const candidatesWithoutPrev = baseCandidates.filter(d => Number(d.id) !== Number(excludeDishId));
    if (candidatesWithoutPrev.length > 0) {
      return pickWeightedDish(candidatesWithoutPrev) || candidatesWithoutPrev[0];
    }
  }

  return pickWeightedDish(baseCandidates) || baseCandidates[0];
}
