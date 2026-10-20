import { formatCurrency, getCategoryName } from './dishRender.js';
import { DISH_TYPES } from './filterUtils.js';
import { foodImageFallback } from './foodImages.js';
import { rarityOf } from './foodRarity.js';

/**
 * Tìm một món ăn theo ID
 * @param {Array} dishes - Danh sách món ăn
 * @param {number} id - ID món cần tìm
 * @returns {Object|null} Món ăn hoặc null nếu không tồn tại
 */
export function findDishById(dishes, id) {
    if (!dishes || !Array.isArray(dishes)) return null;
    const dishId = Number(id);
    return dishes.find(dish => dish.id === dishId) || null;
}

/**
 * Xếp hạng các món ăn tương tự với một món cho trước
 * Điểm = số tag chung (ưu tiên cao nhất) + cùng danh mục + cùng loại chay/mặn
 * @param {Array} dishes - Danh sách món ăn
 * @param {Object} dish - Món đang xem
 * @param {Array<number>} excludedIds - Các ID cần loại (món bị loại theo BR02)
 * @returns {Array<{dish: Object, score: number}>} Danh sách đã sắp xếp giảm dần
 */
function rankSimilarDishes(dishes, dish, excludedIds = []) {
    if (!dishes || !Array.isArray(dishes) || !dish) return [];

    const skipIds = new Set([dish.id, ...excludedIds.map(Number)]);
    const dishTags = new Set(dish.tags || []);

    return dishes
        .filter(candidate => !skipIds.has(candidate.id))
        .map(candidate => {
            const sharedTags = (candidate.tags || []).filter(tag => dishTags.has(tag)).length;
            const score =
                sharedTags * 2 +
                (candidate.category === dish.category ? 1 : 0) +
                (candidate.type === dish.type ? 0.5 : 0);
            return { dish: candidate, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);
}

/**
 * Lấy danh sách món tương tự đã sắp xếp
 * @param {Array} dishes - Danh sách món ăn
 * @param {Object} dish - Món đang xem
 * @param {Array<number>} excludedIds - Các ID cần loại
 * @param {number} limit - Số món tối đa
 * @returns {Array<Object>}
 */
export function getSimilarDishes(dishes, dish, excludedIds = [], limit = 6) {
    return rankSimilarDishes(dishes, dish, excludedIds)
        .slice(0, limit)
        .map(item => item.dish);
}
