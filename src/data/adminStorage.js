// ============================================================
// 💾 BungOiAnGi – Bộ nhớ đệm Client-Side Offline CMS
// Tự động lưu & phục hồi khi chạy trên Vercel hoặc mất kết nối API
// ============================================================

import { dishes as defaultDishes, replaceDishes } from './dishes.js';
import { DEFAULT_VOUCHERS } from './vouchers.js';

const DISHES_KEY = 'bung_admin_dishes';
const USERS_KEY = 'bung_admin_users';
const ACTIVE_VOUCHER_KEY = 'bung_active_voucher';

const DEFAULT_USERS = [
  {
    id: 1,
    name: 'Quản trị viên',
    email: 'admin@bungoiangi.com',
    role: 'admin',
    adminLevel: 'root',
    status: 'active',
    createdAt: '2026-10-01T00:00:00.000Z'
  },
  {
    id: 2,
    name: 'Khách hàng thân thiết',
    email: 'khachhang@gmail.com',
    role: 'customer',
    adminLevel: 'customer',
    status: 'active',
    createdAt: '2026-10-04T00:00:00.000Z'
  },
  {
    id: 3,
    name: 'Cộng tác viên nội dung',
    email: 'ctv@bungoiangi.com',
    role: 'admin',
    adminLevel: 'ctv',
    status: 'active',
    createdAt: '2026-10-10T00:00:00.000Z'
  }
];

export function getLocalAdminDishes() {
  try {
    const raw = localStorage.getItem(DISHES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return [...defaultDishes];
}

export function saveLocalAdminDishes(dishesList) {
  try {
    if (Array.isArray(dishesList)) {
      localStorage.setItem(DISHES_KEY, JSON.stringify(dishesList));
      replaceDishes(dishesList);
    }
  } catch (_) {}
}

export function getLocalAdminUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return [...DEFAULT_USERS];
}

export function saveLocalAdminUsers(usersList) {
  try {
    if (Array.isArray(usersList)) {
      localStorage.setItem(USERS_KEY, JSON.stringify(usersList));
    }
  } catch (_) {}
}

export function computeLocalStats(dishes = [], users = [], vouchers = []) {
  const dishList = Array.isArray(dishes) ? dishes : [];
  const userList = Array.isArray(users) ? users : [];
  const voucherList = Array.isArray(vouchers) ? vouchers : [];

  return {
    totalDishes: dishList.length,
    activeDishes: dishList.filter(d => d.active !== false).length,
    sponsoredDishes: dishList.filter(d => Boolean(d.isSponsored)).length,
    bestsellerDishes: dishList.filter(d => Boolean(d.isBestseller)).length,
    totalUsers: userList.length,
    totalCustomers: userList.filter(u => u.role === 'customer').length,
    totalAdmins: userList.filter(u => u.role === 'admin').length,
    totalVouchers: voucherList.length,
    activeVouchers: voucherList.filter(v => v.active !== false).length,
    totalOrders: 128,
  };
}

// -------------------------------------------------------------
// VOUCHER ÁP DỤNG TRÊN MÓN ĂN
// -------------------------------------------------------------

export function getActiveVoucherCode() {
  try {
    return localStorage.getItem(ACTIVE_VOUCHER_KEY) || '';
  } catch (_) {
    return '';
  }
}

export function setActiveVoucherCode(code) {
  try {
    if (code) {
      localStorage.setItem(ACTIVE_VOUCHER_KEY, String(code).trim().toUpperCase());
    } else {
      localStorage.removeItem(ACTIVE_VOUCHER_KEY);
    }
  } catch (_) {}
}

export function clearActiveVoucherCode() {
  try {
    localStorage.removeItem(ACTIVE_VOUCHER_KEY);
  } catch (_) {}
}

/**
 * Tính toán mức giảm giá của voucher cho một mức giá món ăn cụ thể
 * @param {Object} voucher - Thông tin voucher
 * @param {number} dishPrice - Giá món ăn
 * @returns {Object} { isValid, discount, finalPrice, message }
 */
export function calculateVoucherDiscount(voucher, dishPrice) {
  const price = Number(dishPrice) || 0;
  if (!voucher) {
    return { isValid: false, discount: 0, finalPrice: price, message: 'Vui lòng nhập mã voucher.' };
  }

  if (voucher.active === false) {
    return { isValid: false, discount: 0, finalPrice: price, message: `Mã "${voucher.code}" hiện đang tạm ngưng phát hành.` };
  }

  if (voucher.expiryDate && new Date(voucher.expiryDate + 'T23:59:59') < new Date()) {
    return { isValid: false, discount: 0, finalPrice: price, message: `Mã "${voucher.code}" đã hết hạn sử dụng.` };
  }

  const minOrder = Number(voucher.minOrder) || 0;
  if (price < minOrder) {
    const diff = minOrder - price;
    return {
      isValid: false,
      discount: 0,
      finalPrice: price,
      message: `Đơn tối thiểu ${minOrder.toLocaleString('vi-VN')}đ để dùng mã này (Món này hiện ${price.toLocaleString('vi-VN')}đ, thiếu ${diff.toLocaleString('vi-VN')}đ).`
    };
  }

  let discount = 0;
  if (voucher.discountType === 'percent') {
    discount = Math.round((price * (Number(voucher.discountValue) || 0)) / 100);
    const maxDiscount = Number(voucher.maxDiscount);
    if (Number.isFinite(maxDiscount) && maxDiscount > 0 && discount > maxDiscount) {
      discount = maxDiscount;
    }
  } else {
    // Fixed amount (tiền mặt / freeship)
    discount = Number(voucher.discountValue) || 0;
    const maxDiscount = Number(voucher.maxDiscount);
    if (Number.isFinite(maxDiscount) && maxDiscount > 0 && discount > maxDiscount) {
      discount = maxDiscount;
    }
  }

  // Không giảm quá giá gốc
  discount = Math.min(discount, price);
  const finalPrice = Math.max(0, price - discount);

  return {
    isValid: true,
    discount,
    finalPrice,
    voucher,
    message: `Áp dụng thành công mã "${voucher.code}"! Tiết kiệm ${discount.toLocaleString('vi-VN')}đ.`
  };
}
