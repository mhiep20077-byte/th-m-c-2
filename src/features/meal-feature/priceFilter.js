/**
 * Bốn nhóm ngân sách chính, dùng khoảng nửa mở [min, max) để không chồng lấn.
 * Dùng cho chức năng dựng bữa cơm hoàn chỉnh.
 */
export const BUDGET_GROUPS = [
    { id: 'sinh-ton', name: 'Sinh tồn (dưới 20k)', icon: '💸', min: 0, max: 20000 },
    { id: 'sinh-vien', name: 'Sinh viên (20-40k)', icon: '🎓', min: 20000, max: 40000 },
    { id: 'an-ngon', name: 'Ăn ngon (40-70k)', icon: '😋', min: 40000, max: 70000 },
    { id: 'choi-lon', name: 'Chơi lớn (70k+)', icon: '👑', min: 70000, max: Infinity }
];

export const PRICE_TIERS = [
    { id: 'tat-ca', name: 'Tất cả giá', icon: '💰', min: 0, max: Infinity },
    ...BUDGET_GROUPS
];

/**
 * Lọc danh sách món ăn theo nhóm giá
 * @param {Array} dishes 
 * @param {string} budgetId 
 * @returns {Array}
 */
export function filterByPrice(dishes, budgetId) {
    if (!dishes || !Array.isArray(dishes)) return [];
    const group = BUDGET_GROUPS.find(g => g.id === budgetId);
    if (!group) return dishes;
    return dishes.filter(dish => dish.price >= group.min && dish.price < group.max);
}
