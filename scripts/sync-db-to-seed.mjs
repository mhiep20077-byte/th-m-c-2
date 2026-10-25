import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dbPath = path.join(rootDir, 'server', 'db.json');
const dishesPath = path.join(rootDir, 'src', 'data', 'dishes.js');
const vouchersPath = path.join(rootDir, 'src', 'data', 'vouchers.js');

if (!fs.existsSync(dbPath)) {
  console.log('[Sync] Không tìm thấy server/db.json, bỏ qua đồng bộ.');
  process.exit(0);
}

try {
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  // 1. Đồng bộ món ăn sang src/data/dishes.js
  if (Array.isArray(db.dishes) && db.dishes.length > 0) {
    const dishesFileContent = `// ============================================================
// 🍜 BungOiAnGi – Cơ sở dữ liệu món ăn Việt Nam (${db.dishes.length} món chuẩn hóa)
// Tự động đồng bộ từ server/db.json
// ============================================================

export const MOODS = {
  ngon:    { id: 'ngon',    emoji: '😋', label: 'Thèm ngon',       desc: 'Món đậm đà chuẩn vị' },
  luoi:    { id: 'luoi',    emoji: '😴', label: 'Lười nấu',         desc: 'Nhanh gọn, tiện lợi' },
  cay:     { id: 'cay',     emoji: '🌶️', label: 'Thèm cay',         desc: 'Cay nồng kích thích' },
  ngheo:   { id: 'ngheo',   emoji: '💸', label: 'Ví xẹp',           desc: 'Bình dân tiết kiệm' },
  healthy: { id: 'healthy', emoji: '🥗', label: 'Sống lành mạnh',   desc: 'Eat clean ít dầu mỡ' },
  party:   { id: 'party',   emoji: '🎉', label: 'Tự thưởng',        desc: 'Tiệc tùng thả ga' },
};

export const BUDGETS = [
  { id: 'all',  label: 'Tất cả',  min: 0,     max: Infinity },
  { id: 'b20',  label: '≤25K',   sublabel: 'Bình dân',    min: 0,     max: 25000  },
  { id: 'b40',  label: '25–45K', sublabel: 'Sinh viên',   min: 25001, max: 45000  },
  { id: 'b70',  label: '45–80K', sublabel: 'Vừa túi',     min: 45001, max: 80000  },
  { id: 'b150', label: '80K+',   sublabel: 'Chơi lớn',   min: 80001, max: Infinity },
];

export const CATEGORIES = [
  { id: 'all',      label: '🍽️ Tất cả',              icon: '🍽️', name: 'Tất cả' },
  { id: 'nuoc',     label: '🍜 Món nước',            icon: '🍜', name: 'Món nước' },
  { id: 'com',      label: '🍚 Cơm & Xôi',           icon: '🍚', name: 'Cơm & Xôi' },
  { id: 'xao-kho',  label: '🥢 Món xào & Nướng',     icon: '🥢', name: 'Món xào & Nướng' },
  { id: 'anvat',    label: '🍢 Ăn vặt',              icon: '🍢', name: 'Ăn vặt' },
  { id: 'ngot',     label: '🍮 Tráng miệng & Chè',   icon: '🍮', name: 'Tráng miệng & Chè' },
  { id: 'uong',     label: '🧋 Đồ uống',             icon: '🧋', name: 'Đồ uống' },
];

export let dishes = ${JSON.stringify(db.dishes, null, 2)};

export function replaceDishes(nextDishes) {
  if (Array.isArray(nextDishes)) dishes = nextDishes;
}

export const popularDishes = dishes.filter(d => d.popular);
export const newDishes = dishes.filter(d => !d.popular).slice(0, 12);
`;
    fs.writeFileSync(dishesPath, dishesFileContent, 'utf8');
    console.log(`[Sync] Đã đồng bộ ${db.dishes.length} món ăn từ server/db.json -> src/data/dishes.js`);
  }

  // 2. Đồng bộ vouchers sang src/data/vouchers.js nếu có
  if (Array.isArray(db.vouchers) && db.vouchers.length > 0) {
    const vouchersFileContent = `// ============================================================
// 🎟️ BungOiAnGi – Danh mục Voucher & Khuyến mãi mặc định
// Tự động đồng bộ từ server/db.json
// ============================================================

export const DEFAULT_VOUCHERS = ${JSON.stringify(db.vouchers, null, 2)};

const VOUCHER_STORAGE_KEY = 'bung_vouchers';
const CLAIMED_VOUCHERS_KEY = 'bung_claimed_vouchers';

export function getLocalVouchers() {
  try {
    const raw = localStorage.getItem(VOUCHER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return [...DEFAULT_VOUCHERS];
}

export function saveLocalVouchers(vouchers) {
  try {
    if (Array.isArray(vouchers)) {
      localStorage.setItem(VOUCHER_STORAGE_KEY, JSON.stringify(vouchers));
    }
  } catch (_) {}
}

export function getLocalClaimedVoucherIds() {
  try {
    const raw = localStorage.getItem(CLAIMED_VOUCHERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(Number);
    }
  } catch (_) {}
  return [];
}

export function saveLocalClaimedVoucherIds(ids) {
  try {
    if (Array.isArray(ids)) {
      localStorage.setItem(CLAIMED_VOUCHERS_KEY, JSON.stringify(ids.map(Number)));
    }
  } catch (_) {}
}
`;
    fs.writeFileSync(vouchersPath, vouchersFileContent, 'utf8');
    console.log(`[Sync] Đã đồng bộ ${db.vouchers.length} vouchers từ server/db.json -> src/data/vouchers.js`);
  }
} catch (error) {
  console.error('[Sync Error]', error);
}
