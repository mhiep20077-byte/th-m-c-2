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