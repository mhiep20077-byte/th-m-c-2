// ============================================================
// 🎲 BungOiAnGi – Weighted Probability & Analytics Tracking Engine
// ============================================================

import { requestApi } from './apiClient.js';

const SETTINGS_STORAGE_KEY = 'bung_dynamic_settings_v1';
export const SETTINGS_UPDATED_EVENT = 'bung-settings-updated';

export const DEFAULT_DYNAMIC_SETTINGS = {
  gameRules: {
    sponsoredMultiplier: 5,
    bestsellerMultiplier: 3,
    guaranteeSponsored: false,
    mealAncientRate: 5,
    mealLegendaryRate: 15,
    airdropHotRate: 30,
    arenaSpecialRate: 25,
  },
  features: {
    mealEnabled: true,
    arenaEnabled: true,
    airdropEnabled: true,
    quizEnabled: true,
    nearbyEnabled: true,
    maintenanceMode: false,
    maintenanceNotice: 'Hệ thống đang bảo trì để nâng cấp món mới.',
  },
  announcement: {
    enabled: true,
    text: '🔥 ĐỐI TÁC HÔM NAY: Nhập mã BUNGOIANGI giảm 30k khi đặt món tài trợ!',
    link: 'https://shopee.vn',
    type: 'promo',
  },
  ads: {
    bannerEnabled: true,
    title: 'Món Ngon Đối Tác - Cơm Tấm Sườn Bì Chả Đặc Biệt',
    subtitle: 'Hương vị đỉnh chóp, ưu đãi độc quyền hôm nay cho cộng đồng BungOiAnGi!',
    badge: 'TÀI TRỢ HOT',
    img: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
    link: 'https://shopee.vn',
  },
};

let cachedSettings = null;

export function getDynamicSettings() {
  if (cachedSettings) return cachedSettings;
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      cachedSettings = {
        ...DEFAULT_DYNAMIC_SETTINGS,
        ...JSON.parse(saved),
        gameRules: { ...DEFAULT_DYNAMIC_SETTINGS.gameRules, ...(JSON.parse(saved).gameRules || {}) },
        features: { ...DEFAULT_DYNAMIC_SETTINGS.features, ...(JSON.parse(saved).features || {}) },
        announcement: { ...DEFAULT_DYNAMIC_SETTINGS.announcement, ...(JSON.parse(saved).announcement || {}) },
        ads: { ...DEFAULT_DYNAMIC_SETTINGS.ads, ...(JSON.parse(saved).ads || {}) },
      };
      return cachedSettings;
    }
  } catch (_) { }
  cachedSettings = { ...DEFAULT_DYNAMIC_SETTINGS };
  return cachedSettings;
}

export function setDynamicSettings(newSettings) {
  cachedSettings = {
    ...DEFAULT_DYNAMIC_SETTINGS,
    ...newSettings,
    gameRules: { ...DEFAULT_DYNAMIC_SETTINGS.gameRules, ...(newSettings?.gameRules || {}) },
    features: { ...DEFAULT_DYNAMIC_SETTINGS.features, ...(newSettings?.features || {}) },
    announcement: { ...DEFAULT_DYNAMIC_SETTINGS.announcement, ...(newSettings?.announcement || {}) },
    ads: { ...DEFAULT_DYNAMIC_SETTINGS.ads, ...(newSettings?.ads || {}) },
  };
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(cachedSettings));
  } catch (_) { }
  window.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT, { detail: cachedSettings }));
  return cachedSettings;
}

export async function fetchDynamicSettings() {
  try {
    const remote = await requestApi('/api/settings', { auth: false });
    if (remote && typeof remote === 'object') {
      return setDynamicSettings(remote);
    }
  } catch (error) {
    console.warn('Không thể tải cấu hình động từ máy chủ:', error.message);
  }
  return getDynamicSettings();
}

/**
 * Tính trọng số rơi món ăn dựa trên thuộc tính món và cấu hình Admin
 */
export function getDishWeight(dish, customSettings = null) {
  if (!dish || dish.active === false) return 0;
  const settings = customSettings || getDynamicSettings();
  const rules = settings?.gameRules || {};

  let weight = Number(dish.dropWeight);
  if (!Number.isFinite(weight) || weight <= 0) weight = 1;

  if (dish.isSponsored) {
    const spMult = Number(rules.sponsoredMultiplier);
    weight *= (Number.isFinite(spMult) && spMult > 0 ? spMult : 5);
  }

  if (dish.isBestseller) {
    const bsMult = Number(rules.bestsellerMultiplier);
    weight *= (Number.isFinite(bsMult) && bsMult > 0 ? bsMult : 3);
  }

  return Math.max(0.1, weight);
}

/**
 * Chọn ngẫu nhiên có trọng số 1 món ăn từ pool
 */
export function pickWeightedDish(pool, customSettings = null) {
  if (!Array.isArray(pool) || pool.length === 0) return null;
  const activePool = pool.filter(d => d.active !== false);
  const candidates = activePool.length > 0 ? activePool : pool;
  if (candidates.length === 1) return candidates[0];

  const settings = customSettings || getDynamicSettings();
  const rules = settings?.gameRules || {};

  // Nếu bật chế độ ép ra món tài trợ và pool có món tài trợ:
  // Ưu tiên cực cao (75% bốc từ món tài trợ), nhưng vẫn chừa 25% cho các món khác để web không bị biến thành chỉ ra 1 món duy nhất
  if (rules.guaranteeSponsored) {
    const sponsored = candidates.filter(d => d.isSponsored);
    if (sponsored.length > 0 && Math.random() < 0.75) {
      return pickWeightedDish(sponsored, { ...settings, gameRules: { ...rules, guaranteeSponsored: false } });
    }
  }

  const weights = candidates.map(d => getDishWeight(d, settings));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  if (totalWeight <= 0) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  let randomVal = Math.random() * totalWeight;
  for (let i = 0; i < candidates.length; i++) {
    randomVal -= weights[i];
    if (randomVal <= 0) {
      return candidates[i];
    }
  }
  return candidates[candidates.length - 1];
}

/**
 * Chọn ngẫu nhiên có trọng số nhiều món không trùng nhau (VD: trải bài Tarot)
 */
export function pickWeightedDishes(pool, count, customSettings = null) {
  if (!Array.isArray(pool) || pool.length === 0) return [];
  const settings = customSettings || getDynamicSettings();
  const selected = [];
  const remaining = [...pool.filter(d => d.active !== false)];
  const guarantee = settings?.gameRules?.guaranteeSponsored;

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const isFirstAndGuarantee = guarantee && i === 0;
    const currentSettings = isFirstAndGuarantee
      ? settings
      : { ...settings, gameRules: { ...settings?.gameRules, guaranteeSponsored: false } };

    const picked = pickWeightedDish(remaining, currentSettings);
    if (picked) {
      selected.push(picked);
      const idx = remaining.findIndex(d => d.id === picked.id);
      if (idx !== -1) remaining.splice(idx, 1);
    }
  }
  return selected;
}

/**
 * Mô phỏng xác suất % rơi ra của từng món trong pool để Admin xem trực quan
 */
export function simulateDropProbabilities(pool, customSettings = null) {
  if (!Array.isArray(pool) || pool.length === 0) return [];
  const settings = customSettings || getDynamicSettings();
  const activePool = pool.filter(d => d.active !== false);
  const candidates = activePool.length > 0 ? activePool : pool;

  const weights = candidates.map(d => ({
    dish: d,
    weight: getDishWeight(d, settings),
  }));

  const total = weights.reduce((sum, item) => sum + item.weight, 0);

  return weights.map(item => ({
    ...item.dish,
    calculatedWeight: Number(item.weight.toFixed(2)),
    percentage: total > 0 ? Number(((item.weight / total) * 100).toFixed(2)) : 0,
  })).sort((a, b) => b.percentage - a.percentage);
}

/**
 * Gửi log dữ liệu người dùng lên máy chủ để Admin thống kê và nắm bắt
 */
export function trackAnalyticsEvent(type, details = {}) {
  try {
    requestApi('/api/analytics/event', {
      method: 'POST',
      body: { type, details },
      auth: true,
    }).catch(() => { });
  } catch (_) { }
}
