// ============================================================
// 🎟️ BungOiAnGi - Dữ Liệu & Danh Mục Voucher Khuyến Mãi Mẫu
// ============================================================

export const DEFAULT_VOUCHERS = [
  {
    id: 1,
    code: 'BUNGNEW30',
    title: 'Ưu Đãi Bạn Mới BungOiAnGi',
    desc: 'Giảm ngay 30.000đ cho đơn từ 60.000đ khi đặt món lần đầu tiên',
    discountType: 'fixed',
    discountValue: 30000,
    minOrder: 60000,
    maxDiscount: 30000,
    usageLimit: 150,
    usedCount: 18,
    expiryDate: '2026-12-31',
    badge: '🎉 Bạn Mới',
    category: 'all',
    active: true,
    createdAt: '2026-10-26T00:00:00.000Z',
  },
  {
    id: 2,
    code: 'FREESHIP20',
    title: 'Miễn Phí Vận Chuyển Hỏa Tốc',
    desc: 'Freeship tối đa 20.000đ cho đơn hàng đồ ăn từ 80.000đ giao tận nơi',
    discountType: 'fixed',
    discountValue: 20000,
    minOrder: 80000,
    maxDiscount: 20000,
    usageLimit: 200,
    usedCount: 42,
    expiryDate: '2026-11-30',
    badge: '🛵 Freeship',
    category: 'all',
    active: true,
    createdAt: '2026-10-26T00:00:00.000Z',
  },
  {
    id: 3,
    code: 'TIECVANG50',
    title: 'Đại Tiệc Hoàng Kim VIP',
    desc: 'Giảm 50.000đ cho đơn từ 150.000đ khi chọn các món Cổ Đại & Huyền Thoại',
    discountType: 'fixed',
    discountValue: 50000,
    minOrder: 150000,
    maxDiscount: 50000,
    usageLimit: 100,
    usedCount: 9,
    expiryDate: '2026-12-31',
    badge: '💎 Đại Tiệc VIP',
    category: 'ancient',
    active: true,
    createdAt: '2026-10-26T00:00:00.000Z',
  },
  {
    id: 4,
    code: 'BUNGIAM20',
    title: 'Siêu Deal Giảm 20% Trưa Nay',
    desc: 'Giảm 20% tối đa 40.000đ cho mọi đơn đặt món từ 90.000đ',
    discountType: 'percent',
    discountValue: 20,
    minOrder: 90000,
    maxDiscount: 40000,
    usageLimit: 300,
    usedCount: 85,
    expiryDate: '2026-11-15',
    badge: '🔥 Hot Deal 20%',
    category: 'all',
    active: true,
    createdAt: '2026-10-26T00:00:00.000Z',
  },
  {
    id: 5,
    code: 'DEMKHUYA15',
    title: 'Cứu Đói Đêm Khuya 15K',
    desc: 'Giảm 15.000đ cho đơn đồ ăn đêm từ 50.000đ tiếp sức thức khuya',
    discountType: 'fixed',
    discountValue: 15000,
    minOrder: 50000,
    maxDiscount: 15000,
    usageLimit: 250,
    usedCount: 31,
    expiryDate: '2026-12-31',
    badge: '🌙 Ăn Đêm',
    category: 'all',
    active: true,
    createdAt: '2026-10-26T00:00:00.000Z',
  },
];

export function getLocalVouchers() {
  try {
    const raw = localStorage.getItem('bung_vouchers');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [...DEFAULT_VOUCHERS];
}

export function saveLocalVouchers(vouchers) {
  try {
    localStorage.setItem('bung_vouchers', JSON.stringify(vouchers));
  } catch {}
}

export function getLocalClaimedVoucherIds() {
  try {
    const raw = localStorage.getItem('bung_claimed_vouchers');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveLocalClaimedVoucherIds(ids) {
  try {
    localStorage.setItem('bung_claimed_vouchers', JSON.stringify(ids));
  } catch {}
}
