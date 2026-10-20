/**
 * Tiện ích định dạng và hiển thị món ăn cho chức năng dựng bữa cơm
 */

export const CATEGORIES = [
  { id: 'tat-ca', name: 'Tất cả', icon: '🍽️' },
  { id: 'mon-nuoc', name: 'Món nước', icon: '🍜' },
  { id: 'mon-com', name: 'Món cơm', icon: '🍚' },
  { id: 'mon-kho', name: 'Món khô / Xào', icon: '🥢' },
  { id: 'an-vat', name: 'Ăn vặt', icon: '🍡' },
  { id: 'mon-ngot', name: 'Món ngọt', icon: '🍮' },
  { id: 'do-uong', name: 'Đồ uống', icon: '🧋' }
];

/**
 * Định dạng số tiền sang định dạng Việt Nam Đồng (VD: 45000 -> 45.000đ)
 * @param {number} amount 
 * @returns {string}
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount || 0) + 'đ';
}

/**
 * Lấy tên danh mục dựa trên ID
 * @param {string} categoryId 
 * @returns {string}
 */
export function getCategoryName(categoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  return cat ? cat.name : categoryId;
}
