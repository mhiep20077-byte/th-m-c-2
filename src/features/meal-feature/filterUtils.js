/**
 * Định nghĩa phân loại món ăn (Chay / Mặn) phục vụ chức năng dựng bữa cơm
 */
export const DISH_TYPES = [
    { id: 'chay', name: 'Chay', icon: '🌱' },
    { id: 'man', name: 'Mặn', icon: '🍖' }
];

/**
 * Lọc danh sách theo loại món (chay / mặn)
 * @param {Array} dishes 
 * @param {string} typeId 
 * @returns {Array}
 */
export function filterByDishType(dishes, typeId) {
    if (!dishes || !Array.isArray(dishes)) return [];
    if (!typeId || typeId === 'tat-ca') return dishes;
    return dishes.filter(dish => dish.type === typeId);
}
