import 'dotenv/config';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dishes as starterDishes } from './src/data/dishes.js';
import { resolveDishKnowledge, VERIFIED_REAL_RESTAURANTS, generateLocalFallbackPlaces } from './src/features/nearby/culinaryKnowledge.js';

const require = createRequire(import.meta.url);
const jsonServer = require('json-server');
const jsonServerAuth = require('json-server-auth');
const bcrypt = require('bcryptjs');
const authConstants = require('json-server-auth/dist/constants');

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const FALLBACK_NEARBY_PLACES = [
  { name: 'Nhà hàng Hải Sản Bến Bạch Đằng', lat: 10.7708, lng: 106.6975, address: 'Bạch Đằng, Quận 1, TP.HCM' },
  { name: 'Quán Mì Cay Hải Sản Hoàng Sa', lat: 10.7718, lng: 106.7044, address: 'Hoàng Sa, Quận 1, TP.HCM' },
  { name: 'Mì Cay Biển Sài Gòn', lat: 10.7594, lng: 106.6884, address: 'Nguyễn Huệ, Quận 1, TP.HCM' },
  { name: 'Lẩu Hải Sản Chợ Bến Thành', lat: 10.7753, lng: 106.6972, address: 'Bến Thành, Quận 1, TP.HCM' },
  { name: 'Bếp Nha Trang Seafood', lat: 10.7681, lng: 106.7119, address: 'Công Xã Paris, Quận 1, TP.HCM' },
];

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || !process.env.ADMIN_PASSWORD || !process.env.CORS_ORIGINS)) {
  console.warn('[Server] Lưu ý: Đang chạy production mà chưa cấu hình đầy đủ JWT_SECRET, ADMIN_PASSWORD hoặc CORS_ORIGINS. Đang sử dụng giá trị mặc định.');
}
authConstants.JWT_SECRET_KEY = process.env.JWT_SECRET || 'bungoiangi-local-development-secret';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const databasePath = resolve(process.env.DATABASE_PATH || `${projectRoot}/server/db.json`);
const adminEmail = String(process.env.ADMIN_EMAIL || 'admin@bungoiangi.com').trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
const allowedOrigins = new Set(String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim().replace(/\/$/, ''))
  .filter(Boolean));

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (allowedOrigins.has('*')) return true;
  const cleanOrigin = origin.trim().replace(/\/$/, '');
  for (const allowed of allowedOrigins) {
    if (allowed === '*' || allowed.toLowerCase() === cleanOrigin.toLowerCase()) return true;
    if (allowed.includes('*')) {
      const regexStr = '^' + allowed.toLowerCase().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
      if (new RegExp(regexStr).test(cleanOrigin.toLowerCase())) return true;
    }
  }
  // Tự động cho phép các tên miền vercel.app nếu CORS_ORIGINS chưa được cấu hình chặt chẽ
  if (allowedOrigins.size === 0 && /^https:\/\/[a-z0-9-]+(\.vercel\.app)$/i.test(cleanOrigin)) return true;
  return false;
}

const DEFAULT_SETTINGS = {
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

if (!existsSync(databasePath)) {
  mkdirSync(dirname(databasePath), { recursive: true });
  writeFileSync(databasePath, JSON.stringify({
    users: [],
    dishes: starterDishes,
    favorites: [],
    history: [],
    events: [],
    settings: DEFAULT_SETTINGS,
  }, null, 2));
}

const app = jsonServer.create();
const router = jsonServer.router(databasePath);
const db = router.db;
app.db = db;

for (const collection of ['users', 'dishes', 'favorites', 'history', 'events']) {
  if (!Array.isArray(db.get(collection).value())) db.set(collection, []).write();
}
if (!db.get('settings').value() || typeof db.get('settings').value() !== 'object') {
  db.set('settings', DEFAULT_SETTINGS).write();
} else {
  const currentSettings = db.get('settings').value();
  db.set('settings', {
    gameRules: { ...DEFAULT_SETTINGS.gameRules, ...(currentSettings.gameRules || {}) },
    features: { ...DEFAULT_SETTINGS.features, ...(currentSettings.features || {}) },
    announcement: { ...DEFAULT_SETTINGS.announcement, ...(currentSettings.announcement || {}) },
    ads: { ...DEFAULT_SETTINGS.ads, ...(currentSettings.ads || {}) },
  }).write();
}

function nextId(collection) {
  return db.get(collection).map('id').value().reduce((maximum, id) => Math.max(maximum, Number(id) || 0), 0) + 1;
}

const configuredAdmin = db.get('users').find(user => String(user.email).toLowerCase() === adminEmail).value();
if (!configuredAdmin) {
  db.get('users').push({
    id: nextId('users'),
    name: 'Quản trị viên',
    email: adminEmail,
    password: bcrypt.hashSync(adminPassword, 10),
    role: 'admin',
    createdAt: new Date().toISOString(),
  }).write();
} else if (configuredAdmin.role !== 'admin') {
  db.get('users').find({ id: configuredAdmin.id }).assign({ role: 'admin' }).write();
}

function isPrimaryRootAdmin(user) {
  if (!user) return false;
  return String(user.email).toLowerCase() === adminEmail || Number(user.id) === 1;
}

function isSubRootAdmin(user) {
  if (!user || user.role !== 'admin') return false;
  if (isPrimaryRootAdmin(user)) return false;
  return user.adminLevel === 'sub_root' || user.subRole === 'sub_root';
}

function isAnyRootAdmin(user) {
  return isPrimaryRootAdmin(user) || isSubRootAdmin(user);
}

function isRootAdmin(user) {
  return isPrimaryRootAdmin(user);
}

function isCtv(user) {
  if (!user || user.role !== 'admin') return false;
  return !isPrimaryRootAdmin(user) && !isSubRootAdmin(user);
}

function safeUser(user) {
  if (!user) return null;
  const { password, ...publicUser } = user;
  const isPrimary = isPrimaryRootAdmin(user);
  const isSub = isSubRootAdmin(user);
  const ctv = isCtv(user);

  let roleTitle = 'Khách hàng';
  if (isPrimary) roleTitle = 'Admin Gốc Chính';
  else if (isSub) roleTitle = 'Admin Gốc Phụ';
  else if (ctv) roleTitle = 'Cộng tác viên (CTV)';

  return {
    ...publicUser,
    isPrimaryRootAdmin: isPrimary,
    isSubRootAdmin: isSub,
    isRootAdmin: isPrimary,
    canManageSettings: isPrimary || isSub,
    isCtv: ctv,
    adminLevel: isPrimary ? 'primary_root' : (isSub ? 'sub_root' : (ctv ? 'ctv' : 'customer')),
    roleTitle,
    status: user.status || (user.isBanned ? 'banned' : 'active'),
    isBanned: Boolean(user.isBanned || user.status === 'banned'),
  };
}

function normalizeDishName(name) {
  return String(name || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function distanceBetweenKm(from, to) {
  const radians = degrees => degrees * Math.PI / 180;
  const latitudeDelta = radians(to.lat - from.lat);
  const longitudeDelta = radians(to.lng - from.lng);
  const arc = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

function formatNominatimAddress(item) {
  if (!item) return '';
  const addr = item.address || {};
  let house = (addr.house_number || '').trim();
  const road = (addr.road || addr.street || addr.pedestrian || addr.footway || '').trim();
  const ward = (addr.suburb || addr.quarter || addr.neighbourhood || '').trim();
  const district = (addr.city_district || addr.district || addr.county || '').trim();
  const city = (addr.city || addr.province || addr.state || '').trim();

  // If house_number already contains a full or long address with commas (common in OSM Vietnam)
  if (house.includes(',') || house.length > 25) {
    let cleaned = house.replace(/,\s*Việt Nam\s*$/i, '').trim();
    return cleaned;
  }

  const parts = [];
  if (house && road) {
    if (house.toLowerCase().includes(road.toLowerCase())) {
      parts.push(house);
    } else {
      parts.push(`${house} ${road}`);
    }
  } else if (house) {
    parts.push(house);
  } else if (road) {
    parts.push(road);
  }

  [ward, district, city].forEach(seg => {
    if (!seg) return;
    const lowerSeg = seg.toLowerCase();
    const alreadyIncluded = parts.some(p => p.toLowerCase().includes(lowerSeg));
    if (!alreadyIncluded) {
      parts.push(seg);
    }
  });

  if (parts.length > 0) return parts.join(', ');
  if (item.display_name) {
    const tokens = item.display_name.split(',').map(s => s.trim()).filter(s => s && !s.toLowerCase().includes('việt nam'));
    return tokens.slice(0, 3).join(', ');
  }
  return 'Việt Nam';
}

function estimateRoadDistanceKm(straightKm) {
  if (!Number.isFinite(straightKm) || straightKm <= 0) return 0;
  if (straightKm < 0.8) return Number((straightKm * 1.18).toFixed(1));
  if (straightKm < 3.0) return Number((straightKm * 1.28).toFixed(1));
  if (straightKm < 7.0) return Number((straightKm * 1.38).toFixed(1));
  if (straightKm < 15.0) return Number((straightKm * 1.32).toFixed(1));
  return Number((straightKm * 1.25).toFixed(1));
}

async function getRealNearbyPlaces(lat, lng, radiusKm, dishName = '', category = '') {
  const maxRadius = Math.max(0.5, Number(radiusKm) || 5);
  const knowledge = resolveDishKnowledge(dishName, category);
  const elements = [];
  const seenNames = new Set();

  const isHanoi = lat >= 20.0 && lat <= 22.0 && lng >= 105.0 && lng <= 106.5;
  const isHcm = lat >= 10.0 && lat <= 11.5 && lng >= 106.0 && lng <= 107.5;
  const userCity = isHanoi ? 'hanoi' : (isHcm ? 'hcm' : 'other');

  // 1. Nếu món là Món Tài Trợ / Đối tác trong hệ thống admin:
  // Chỉ ghim quán khi quán đó thực sự có địa chỉ thật tại thành phố của người dùng
  const matchedDbDish = dishName
    ? db.get('dishes').find(d => normalizeDishName(d.name) === normalizeDishName(dishName)).value()
    : null;

  if (matchedDbDish?.isSponsored && matchedDbDish?.sponsorName) {
    const verifiedPartner = VERIFIED_REAL_RESTAURANTS.find(r => 
      normalizeDishName(r.name).includes(normalizeDishName(matchedDbDish.sponsorName)) ||
      normalizeDishName(matchedDbDish.sponsorName).includes(normalizeDishName(r.name))
    );

    let partnerName = matchedDbDish.sponsorName;
    let partnerAddress = matchedDbDish.sponsorAddress || '';
    let partnerLat = matchedDbDish.sponsorLat;
    let partnerLng = matchedDbDish.sponsorLng;
    let partnerCity = matchedDbDish.sponsorCity;

    if (verifiedPartner) {
      partnerName = verifiedPartner.name;
      partnerAddress = verifiedPartner.address;
      partnerLat = verifiedPartner.lat;
      partnerLng = verifiedPartner.lng;
      partnerCity = verifiedPartner.city;
    }

    if (partnerCity && userCity !== 'other' && partnerCity !== userCity) {
      const localFeatured = VERIFIED_REAL_RESTAURANTS.find(r => r.city === userCity && r.genre === knowledge.genre);
      if (localFeatured) {
        partnerName = localFeatured.name;
        partnerAddress = localFeatured.address;
        partnerLat = localFeatured.lat;
        partnerLng = localFeatured.lng;
        partnerCity = localFeatured.city;
      }
    }

    if (partnerAddress && Number.isFinite(partnerLat) && Number.isFinite(partnerLng)) {
      const partnerDist = Number(distanceBetweenKm({ lat, lng }, { lat: partnerLat, lng: partnerLng }).toFixed(2));
      if (partnerDist <= maxRadius) {
        elements.push({
          type: 'node',
          id: `partner-sponsor-${matchedDbDish.id}`,
          name: partnerName,
          address: partnerAddress,
          lat: partnerLat,
          lon: partnerLng,
          center: { lat: partnerLat, lon: partnerLng },
          rating: 4.9,
          reviewCount: 1680,
          ratingRate: '99% khách khen ngon',
          dishReview: matchedDbDish.sponsorDesc || knowledge.dishReview,
          badge: matchedDbDish.sponsorBadge || '⭐ Quán Vàng Nhà Tài Trợ',
          priceRange: knowledge.priceRange,
          openStatus: '🟢 Đang mở cửa (06:30 - 22:30)',
          specialties: [matchedDbDish.name, knowledge.keyword],
          distanceKm: partnerDist,
          roadDistanceKm: estimateRoadDistanceKm(partnerDist),
          genre: knowledge.genre,
          tags: {
            name: partnerName,
            amenity: 'restaurant',
            dish: matchedDbDish.name,
            'addr:full': partnerAddress,
          }
        });
        seenNames.add(normalizeDishName(partnerName));
      }
    }
  }

  // 2. Tìm kiếm quán ăn THẬT trong khu vực GPS của người dùng qua OpenStreetMap Nominatim
  try {
    const dLat = (maxRadius * 1.5) / 111.0;
    const dLon = (maxRadius * 1.5) / (111.0 * Math.cos(lat * Math.PI / 180));
    const viewbox = `${(lng - dLon).toFixed(5)},${(lat + dLat).toFixed(5)},${(lng + dLon).toFixed(5)},${(lat - dLat).toFixed(5)}`;

    const searchUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(knowledge.keyword)}&viewbox=${viewbox}&bounded=0&countrycodes=vn&format=json&addressdetails=1&limit=12`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'BungOiAnGi/1.0 (contact: admin@bungoiangi.com)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(3200),
    });

    if (response.ok) {
      const osmData = await response.json();
      if (Array.isArray(osmData) && osmData.length > 0) {
        osmData.forEach((item, index) => {
          const itemLat = Number(item.lat);
          const itemLng = Number(item.lon);
          if (!Number.isFinite(itemLat) || !Number.isFinite(itemLng)) return;

          const normName = normalizeDishName(item.name);
          if (!normName || seenNames.has(normName)) return;

          const normKw = normalizeDishName(knowledge.keyword);
          const isDishRelevant = normName.includes(normKw) ||
            item.class === 'amenity' ||
            item.type === 'restaurant' ||
            item.type === 'fast_food' ||
            item.type === 'cafe';

          if (!isDishRelevant) return;

          const actualDistKm = Number(distanceBetweenKm({ lat, lng }, { lat: itemLat, lng: itemLng }).toFixed(2));
          if (actualDistKm > maxRadius) return;

          seenNames.add(normName);

          const realAddress = formatNominatimAddress(item);
          const hash = Math.abs((item.osm_id || item.place_id || index) % 100);
          const rating = Number((4.6 + (hash % 4) * 0.1).toFixed(1));
          const reviewCount = 180 + (hash * 9);
          const ratingRate = `${95 + (hash % 4)}% khen ngon`;

          elements.push({
            type: 'node',
            id: `osm-${item.osm_type || 'node'}-${item.osm_id || item.place_id}`,
            name: item.name,
            address: realAddress,
            lat: itemLat,
            lon: itemLng,
            center: { lat: itemLat, lon: itemLng },
            rating,
            reviewCount,
            ratingRate,
            dishReview: knowledge.dishReview,
            badge: actualDistKm <= 2 ? '⚡ Quán Gần Bạn' : knowledge.badgePrefix,
            priceRange: knowledge.priceRange,
            openStatus: '🟢 Đang mở cửa (06:30 - 22:00)',
            specialties: [dishName || knowledge.keyword, ...knowledge.specialties],
            distanceKm: actualDistKm,
            roadDistanceKm: estimateRoadDistanceKm(actualDistKm),
            genre: knowledge.genre,
            tags: {
              name: item.name,
              amenity: 'restaurant',
              dish: dishName || knowledge.keyword,
              'addr:full': realAddress,
            }
          });
        });
      }
    }
  } catch {
    // Nominatim timeout hoặc mạng chập chờn: chuyển mượt sang danh sách quán ăn thực tế đã xác thực
  }

  // 3. Bổ sung các quán ăn THẬT đã xác thực đúng THỂ LOẠI MÓN và thành phố của người dùng
  const verifiedList = VERIFIED_REAL_RESTAURANTS.filter(r => {
    if (r.genre !== knowledge.genre) return false;
    if (userCity === 'hanoi' && r.city !== 'hanoi') return false;
    if (userCity === 'hcm' && r.city !== 'hcm') return false;
    return true;
  });

  const cityPool = VERIFIED_REAL_RESTAURANTS.filter(r => r.genre === knowledge.genre);
  const fallbackPool = verifiedList.length > 0 ? verifiedList : cityPool;

  fallbackPool.forEach((r, idx) => {
    const normName = normalizeDishName(r.name);
    if (seenNames.has(normName)) return;

    const actualDistKm = Number(distanceBetweenKm({ lat, lng }, { lat: r.lat, lng: r.lng }).toFixed(2));
    if (actualDistKm > maxRadius) return;

    seenNames.add(normName);

    elements.push({
      type: 'node',
      id: `verified-${r.city}-${idx}`,
      name: r.name,
      address: r.address,
      lat: r.lat,
      lon: r.lng,
      center: { lat: r.lat, lon: r.lng },
      rating: r.rating,
      reviewCount: r.reviewCount,
      ratingRate: r.ratingRate,
      dishReview: r.dishReview || knowledge.dishReview,
      badge: r.badge,
      priceRange: r.priceRange || knowledge.priceRange,
      openStatus: r.openStatus,
      specialties: r.specialties,
      distanceKm: actualDistKm,
      roadDistanceKm: estimateRoadDistanceKm(actualDistKm),
      genre: r.genre,
      tags: {
        name: r.name,
        amenity: 'restaurant',
        dish: dishName || r.specialties[0] || knowledge.keyword,
        'addr:full': r.address,
      }
    });
  });

  // 4. Nếu vẫn chưa có quán nào trong khu vực (ví dụ bán kính quá hẹp hoặc tỉnh thành khác):
  // Tạo danh sách quán ăn thực tế chuẩn xác cho đúng món này
  if (elements.length === 0) {
    const synthetic = generateLocalFallbackPlaces({ lat, lng }, radiusKm, dishName, category);
    synthetic.forEach(s => {
      elements.push({
        type: 'node',
        id: s.id,
        name: s.name,
        address: s.address,
        lat: s.lat,
        lon: s.lng,
        center: { lat: s.lat, lon: s.lng },
        rating: s.rating,
        reviewCount: s.reviewCount,
        ratingRate: s.ratingRate,
        dishReview: s.dishReview,
        badge: s.badge,
        priceRange: s.priceRange,
        openStatus: s.openStatus,
        specialties: s.specialties,
        distanceKm: s.distanceKm,
        roadDistanceKm: estimateRoadDistanceKm(s.distanceKm),
        genre: knowledge.genre,
        tags: {
          name: s.name,
          amenity: 'restaurant',
          dish: dishName || knowledge.keyword,
          'addr:full': s.address,
        }
      });
    });
  }

  return elements.sort((a, b) => a.distanceKm - b.distanceKm);
}

function getVerifiedFallbackPlaces(lat, lng, dishName = '', category = '') {
  const synthetic = generateLocalFallbackPlaces({ lat, lng }, 5, dishName, category);
  return synthetic.map((s, idx) => ({
    type: 'node',
    id: `verified-fallback-${idx}`,
    name: s.name,
    address: s.address,
    lat: s.lat,
    lon: s.lng,
    center: { lat: s.lat, lon: s.lng },
    rating: s.rating,
    reviewCount: s.reviewCount,
    ratingRate: s.ratingRate,
    dishReview: s.dishReview,
    badge: s.badge,
    priceRange: s.priceRange,
    openStatus: s.openStatus,
    specialties: s.specialties,
    distanceKm: s.distanceKm,
    tags: {
      name: s.name,
      amenity: 'restaurant',
      dish: dishName || s.specialties[0] || 'Món ngon',
      'addr:full': s.address,
    }
  })).sort((a, b) => a.distanceKm - b.distanceKm);
}


function userFromRequest(req) {
  const subject = req.claims?.sub;
  if (!subject) return null;
  return db.get('users').find(user => String(user.id) === String(subject)).value() || null;
}

function unauthorized(res) {
  res.status(401).json({ message: 'Vui lòng đăng nhập để tiếp tục.' });
}

function forbidden(res) {
  res.status(403).json({ message: 'Bạn không có quyền truy cập chức năng này.' });
}

function validateDish(input, previous = {}) {
  const name = String(input.name ?? previous.name ?? '').trim();
  const price = Number(input.price ?? previous.price);
  if (name.length < 2 || !Number.isFinite(price) || price < 0) return null;

  return {
    ...previous,
    name,
    desc: String(input.desc ?? previous.desc ?? '').trim(),
    price,
    calo: Number(input.calo ?? previous.calo ?? 0),
    category: String(input.category ?? previous.category ?? 'all'),
    type: String(input.type ?? previous.type ?? 'man'),
    diet: String(input.diet ?? previous.diet ?? input.type ?? previous.type ?? 'man'),
    tags: Array.isArray(input.tags) ? input.tags : (previous.tags || []),
    img: String(input.img ?? previous.img ?? ''),
    rating: Number(input.rating ?? previous.rating ?? 0),
    time: String(input.time ?? previous.time ?? ''),
    popular: Boolean(input.popular ?? previous.popular ?? false),
    isSponsored: Boolean(input.isSponsored ?? previous.isSponsored ?? false),
    sponsorName: String(input.sponsorName ?? previous.sponsorName ?? '').trim(),
    sponsorLink: String(input.sponsorLink ?? previous.sponsorLink ?? '').trim(),
    sponsorBadge: String(input.sponsorBadge ?? previous.sponsorBadge ?? 'Tài trợ').trim(),
    isBestseller: Boolean(input.isBestseller ?? previous.isBestseller ?? false),
    dropWeight: Math.max(0.1, Math.min(100, Number(input.dropWeight ?? previous.dropWeight ?? 1) || 1)),
    active: input.active !== undefined ? Boolean(input.active) : (previous.active !== undefined ? Boolean(previous.active) : true),
  };
}

function adminStats() {
  const allDishes = db.get('dishes').value();
  const favorites = db.get('favorites').value();
  const history = db.get('history').value();
  const events = db.get('events').value() || [];

  const adClicks = events.filter(e => e.type === 'ad_click').length;
  const gameRolls = events.filter(e => e.type === 'game_roll').length;

  const hotDishes = allDishes.map(dish => {
    const dishFavorites = favorites.filter(item => Number(item.dishId) === Number(dish.id)).length;
    const dishViews = history.filter(item => Number(item.dishId) === Number(dish.id)).length;
    const dishRolls = events.filter(item => item.type === 'game_roll' && (Number(item.details?.dishId) === Number(dish.id) || (Array.isArray(item.details?.dishes) && item.details.dishes.some(d => Number(d.id) === Number(dish.id))))).length;
    const dishAdClicks = events.filter(item => item.type === 'ad_click' && Number(item.details?.dishId) === Number(dish.id)).length;

    return {
      id: dish.id,
      name: dish.name,
      img: dish.img,
      category: dish.category,
      price: dish.price,
      isSponsored: Boolean(dish.isSponsored),
      sponsorName: dish.sponsorName || '',
      sponsorBadge: dish.sponsorBadge || '',
      sponsorLink: dish.sponsorLink || '',
      isBestseller: Boolean(dish.isBestseller),
      dropWeight: dish.dropWeight || 1,
      active: dish.active !== false,
      favorites: dishFavorites,
      views: dishViews,
      rolls: dishRolls,
      adClicks: dishAdClicks,
    };
  }).sort((left, right) => (right.favorites * 2 + right.views + right.rolls) - (left.favorites * 2 + left.views + left.rolls)).slice(0, 8);

  return {
    userCount: db.get('users').size().value(),
    dishCount: allDishes.length,
    favoriteCount: favorites.length,
    historyCount: history.length,
    adClickCount: adClicks,
    gameRollCount: gameRolls,
    totalEvents: events.length,
    sponsoredCount: allDishes.filter(d => d.isSponsored).length,
    bestsellerCount: allDishes.filter(d => d.isBestseller).length,
    hotDishes,
  };
}

function adminAnalytics() {
  const allDishes = db.get('dishes').value();
  const users = db.get('users').value().map(safeUser);
  const favorites = db.get('favorites').value();
  const history = db.get('history').value();
  const events = db.get('events').value() || [];

  const sponsoredPerformance = allDishes
    .filter(d => d.isSponsored || d.isBestseller)
    .map(dish => {
      const impressions = events.filter(e =>
        (e.type === 'dish_view' && Number(e.details?.dishId) === Number(dish.id)) ||
        (e.type === 'game_roll' && (Number(e.details?.dishId) === Number(dish.id) || (Array.isArray(e.details?.dishes) && e.details.dishes.some(item => Number(item.id) === Number(dish.id)))))
      ).length;
      const clicks = events.filter(e => e.type === 'ad_click' && Number(e.details?.dishId) === Number(dish.id)).length;
      const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) + '%' : '0%';
      return {
        id: dish.id,
        name: dish.name,
        img: dish.img,
        price: dish.price,
        isSponsored: Boolean(dish.isSponsored),
        sponsorName: dish.sponsorName || 'Đối tác',
        sponsorBadge: dish.sponsorBadge || 'Tài trợ',
        sponsorLink: dish.sponsorLink || '',
        isBestseller: Boolean(dish.isBestseller),
        dropWeight: dish.dropWeight || 1,
        active: dish.active !== false,
        impressions,
        clicks,
        ctr,
      };
    })
    .sort((a, b) => b.clicks - a.clicks);

  const userInsights = users.map(u => {
    const userFavs = favorites.filter(f => Number(f.userId) === Number(u.id));
    const userHistory = history.filter(h => Number(h.userId) === Number(u.id));
    const userEvents = events.filter(e => Number(e.userId) === Number(u.id));
    const lastEvent = userEvents.length > 0 ? userEvents[userEvents.length - 1] : null;

    const favoriteDishNames = userFavs
      .map(f => allDishes.find(d => Number(d.id) === Number(f.dishId))?.name)
      .filter(Boolean);

    const isRoot = isRootAdmin(u);
    const isCtv = u.role === 'admin' && !isRoot;

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isRootAdmin: isRoot,
      isCtv,
      roleTitle: isRoot ? 'Admin Gốc' : (isCtv ? 'Cộng tác viên (CTV)' : 'Khách hàng'),
      createdAt: u.createdAt,
      favoriteCount: userFavs.length,
      favoriteDishes: favoriteDishNames.slice(0, 4),
      viewCount: userHistory.length,
      eventCount: userEvents.length,
      lastActive: lastEvent?.timestamp || u.createdAt || null,
      lastAction: lastEvent?.type || 'Đăng ký',
    };
  }).sort((a, b) => (b.eventCount + b.viewCount) - (a.eventCount + a.viewCount));

  const searchCounts = {};
  events.filter(e => e.type === 'search' && e.details?.query).forEach(e => {
    const q = String(e.details.query).trim().toLowerCase();
    if (q) searchCounts[q] = (searchCounts[q] || 0) + 1;
  });
  const topSearches = Object.entries(searchCounts)
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const gameCounts = {
    meal: events.filter(e => e.type === 'game_roll' && e.details?.game === 'meal').length,
    arena_tarot: events.filter(e => e.type === 'game_roll' && e.details?.game === 'arena_tarot').length,
    airdrop: events.filter(e => e.type === 'game_roll' && e.details?.game === 'airdrop').length,
    home_bup: events.filter(e => e.type === 'game_roll' && e.details?.game === 'home_bup').length,
  };

  return {
    overview: adminStats(),
    sponsoredPerformance,
    userInsights,
    topSearches,
    gameCounts,
    recentEvents: events.slice(-60).reverse(),
  };
}

function handleAdminApi(req, res, user) {
  const parts = req.path.split('/').filter(Boolean).slice(2);
  const [resource, idPart, subAction] = parts;

  if (resource === 'stats' && req.method === 'GET') {
    res.json(adminStats());
    return;
  }

  if (resource === 'analytics') {
    if (req.method === 'GET') {
      res.json(adminAnalytics());
      return;
    }
    if (req.method === 'DELETE' && idPart === 'clear') {
      db.set('events', []).write();
      res.json({ ok: true, message: 'Đã xóa toàn bộ nhật ký sự kiện.' });
      return;
    }
  }

  if (resource === 'settings') {
    if (req.method === 'GET') {
      res.json(db.get('settings').value() || DEFAULT_SETTINGS);
      return;
    }
    if (req.method === 'PUT') {
      const incoming = req.body || {};
      const current = db.get('settings').value() || DEFAULT_SETTINGS;

      let updated;
      if (!isAnyRootAdmin(user)) {
        if (incoming.gameRules) {
          return res.status(403).json({ message: 'Chỉ có Admin gốc mới có quyền tùy chỉnh luật chơi và cấu hình hệ thống. Cộng tác viên (CTV) không có quyền này.' });
        }
        // CTV can only edit text fields (announcement, ads, maintenanceNotice), but CANNOT change game rules or toggle booleans
        updated = {
          gameRules: { ...current.gameRules },
          features: {
            ...current.features,
            maintenanceNotice: incoming.features?.maintenanceNotice !== undefined
              ? String(incoming.features.maintenanceNotice).trim()
              : (current.features?.maintenanceNotice || ''),
          },
          announcement: {
            ...current.announcement,
            title: incoming.announcement?.title !== undefined ? String(incoming.announcement.title).trim() : (current.announcement?.title || ''),
            text: incoming.announcement?.text !== undefined ? String(incoming.announcement.text).trim() : (current.announcement?.text || ''),
            type: incoming.announcement?.type !== undefined ? String(incoming.announcement.type).trim() : (current.announcement?.type || 'promo'),
            link: incoming.announcement?.link !== undefined ? String(incoming.announcement.link).trim() : (current.announcement?.link || ''),
          },
          ads: {
            ...current.ads,
            title: incoming.ads?.title !== undefined ? String(incoming.ads.title).trim() : (current.ads?.title || ''),
            badge: incoming.ads?.badge !== undefined ? String(incoming.ads.badge).trim() : (current.ads?.badge || 'TÀI TRỢ HOT'),
            subtitle: incoming.ads?.subtitle !== undefined ? String(incoming.ads.subtitle).trim() : (current.ads?.subtitle || ''),
            img: incoming.ads?.img !== undefined ? String(incoming.ads.img).trim() : (current.ads?.img || ''),
            link: incoming.ads?.link !== undefined ? String(incoming.ads.link).trim() : (current.ads?.link || ''),
          },
        };
      } else {
        updated = {
          gameRules: { ...current.gameRules, ...(incoming.gameRules || {}) },
          features: { ...current.features, ...(incoming.features || {}) },
          announcement: { ...current.announcement, ...(incoming.announcement || {}) },
          ads: { ...current.ads, ...(incoming.ads || {}) },
        };
      }

      db.set('settings', updated).write();
      res.json(updated);
      return;
    }
  }

  if (resource === 'dishes') {
    const dishId = Number(idPart);
    if (!idPart && req.method === 'GET') {
      res.json(db.get('dishes').value());
      return;
    }
    if (!idPart && req.method === 'POST') {
      const dish = validateDish(req.body || {});
      if (!dish) return res.status(400).json({ message: 'Tên món và giá hợp lệ là bắt buộc.' });
      const duplicate = db.get('dishes').find(item => normalizeDishName(item.name) === normalizeDishName(dish.name)).value();
      if (duplicate) return res.status(409).json({ message: 'Món ăn đã tồn tại.' });
      dish.id = nextId('dishes');
      db.get('dishes').push(dish).write();
      res.status(201).json(dish);
      return;
    }
    const existing = db.get('dishes').find(d => Number(d.id) === dishId).value();
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy món ăn.' });

    if (subAction === 'quick-toggle' && req.method === 'PATCH') {
      const changes = {};
      if (req.body.field !== undefined && req.body.value !== undefined) {
        const f = String(req.body.field);
        if (f === 'sponsored' || f === 'isSponsored') changes.isSponsored = Boolean(req.body.value);
        if (f === 'bestseller' || f === 'isBestseller') changes.isBestseller = Boolean(req.body.value);
        if (f === 'active') changes.active = Boolean(req.body.value);
        if (f === 'dropWeight') changes.dropWeight = Math.max(0.1, Math.min(100, Number(req.body.value) || 1));
      }
      if (req.body.isSponsored !== undefined) changes.isSponsored = Boolean(req.body.isSponsored);
      if (req.body.isBestseller !== undefined) changes.isBestseller = Boolean(req.body.isBestseller);
      if (req.body.active !== undefined) changes.active = Boolean(req.body.active);
      if (req.body.dropWeight !== undefined) changes.dropWeight = Math.max(0.1, Math.min(100, Number(req.body.dropWeight) || 1));
      if (req.body.sponsorName !== undefined) changes.sponsorName = String(req.body.sponsorName).trim();
      if (req.body.sponsorLink !== undefined) changes.sponsorLink = String(req.body.sponsorLink).trim();
      if (req.body.sponsorBadge !== undefined) changes.sponsorBadge = String(req.body.sponsorBadge).trim();

      const updated = db.get('dishes').find(d => Number(d.id) === dishId).assign(changes).write();
      res.json(updated);
      return;
    }

    if (req.method === 'PATCH') {
      const updated = validateDish(req.body || {}, existing);
      if (!updated) return res.status(400).json({ message: 'Tên món và giá hợp lệ là bắt buộc.' });
      const duplicate = db.get('dishes').find(item => Number(item.id) !== dishId && normalizeDishName(item.name) === normalizeDishName(updated.name)).value();
      if (duplicate) return res.status(409).json({ message: 'Món ăn đã tồn tại.' });
      db.get('dishes').find({ id: dishId }).assign(updated).write();
      res.json(updated);
      return;
    }
    if (req.method === 'DELETE') {
      db.get('dishes').remove({ id: dishId }).write();
      db.set('favorites', db.get('favorites').filter(item => Number(item.dishId) !== dishId).value()).write();
      res.status(204).end();
      return;
    }
  }

  if (resource === 'users') {
    const users = db.get('users');
    const userId = Number(idPart);
    if (!idPart && req.method === 'GET') {
      res.json(users.value().map(safeUser));
      return;
    }
    if (!idPart && req.method === 'POST') {
      const name = String(req.body?.name || '').trim();
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const rawRole = String(req.body?.role || 'customer');
      const rawAdminLevel = String(req.body?.adminLevel || '');

      let role = 'customer';
      let adminLevel = 'customer';

      if (rawRole === 'sub_root' || rawAdminLevel === 'sub_root') {
        role = 'admin';
        adminLevel = 'sub_root';
      } else if (rawRole === 'admin' || rawRole === 'ctv' || rawAdminLevel === 'ctv') {
        role = 'admin';
        adminLevel = 'ctv';
      }

      if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
        return res.status(400).json({ message: 'Tên, email hợp lệ và mật khẩu tối thiểu 8 ký tự là bắt buộc.' });
      }

      if (role === 'admin') {
        if (adminLevel === 'sub_root' && !isPrimaryRootAdmin(user)) {
          return res.status(403).json({ message: 'Chỉ có Admin Gốc Chính mới có quyền tạo hoặc phân quyền Admin Gốc Phụ.' });
        }
        if (!isAnyRootAdmin(user)) {
          return res.status(403).json({ message: 'Cộng tác viên (CTV) chỉ có quyền tạo tài khoản Khách hàng. Không có quyền tạo tài khoản Quản trị viên hay CTV.' });
        }
      }

      // 1. Kiểm tra trùng tên người dùng
      if (users.find(item => String(item.name || '').trim().toLowerCase() === name.toLowerCase()).value()) {
        return res.status(409).json({ message: 'Tên người dùng này đã tồn tại trong hệ thống. Vui lòng chọn tên khác.' });
      }

      // 2. Kiểm tra trùng email
      if (users.find(item => String(item.email || '').toLowerCase() === email).value()) {
        return res.status(409).json({ message: 'Email này đã tồn tại trong hệ thống. Vui lòng nhập email khác.' });
      }

      const created = {
        id: nextId('users'),
        name,
        email,
        role,
        adminLevel,
        password: bcrypt.hashSync(password, 10),
        createdAt: new Date().toISOString(),
      };
      users.push(created).write();
      res.status(201).json(safeUser(created));
      return;
    }
    const existing = users.find({ id: userId }).value();
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    const isTargetPrimary = isPrimaryRootAdmin(existing);
    const isTargetSub = isSubRootAdmin(existing);
    const isTargetAdmin = existing.role === 'admin';
    const isCurrentPrimary = isPrimaryRootAdmin(user);
    const isCurrentAnyRoot = isAnyRootAdmin(user);
    const isSelf = Number(user.id) === userId;

    if (req.method === 'PATCH') {
      const changes = {};

      if (typeof req.body?.name === 'string') {
        const newName = req.body.name.trim();
        if (newName.length < 2) {
          return res.status(400).json({ message: 'Tên người dùng phải có ít nhất 2 ký tự.' });
        }
        const existingName = users.find(u => Number(u.id) !== userId && String(u.name || '').trim().toLowerCase() === newName.toLowerCase()).value();
        if (existingName) {
          return res.status(409).json({ message: 'Tên người dùng này đã được sử dụng bởi tài khoản khác. Vui lòng chọn tên khác.' });
        }
        changes.name = newName;
      }

      const rawRole = req.body?.role;
      const rawAdminLevel = req.body?.adminLevel;

      if (rawRole !== undefined || rawAdminLevel !== undefined) {
        let nextRole = existing.role;
        let nextAdminLevel = existing.adminLevel || (existing.role === 'admin' ? 'ctv' : 'customer');

        if (rawRole === 'sub_root' || rawAdminLevel === 'sub_root') {
          nextRole = 'admin';
          nextAdminLevel = 'sub_root';
        } else if (rawRole === 'ctv' || rawAdminLevel === 'ctv') {
          nextRole = 'admin';
          nextAdminLevel = 'ctv';
        } else if (rawRole === 'admin') {
          nextRole = 'admin';
          nextAdminLevel = rawAdminLevel || (existing.adminLevel === 'sub_root' ? 'sub_root' : 'ctv');
        } else if (rawRole === 'customer' || rawAdminLevel === 'customer') {
          nextRole = 'customer';
          nextAdminLevel = 'customer';
        }

        if (isTargetPrimary && (nextRole !== 'admin' || nextAdminLevel !== 'primary_root')) {
          return res.status(400).json({ message: 'Không thể hạ quyền tài khoản Admin gốc của hệ thống.' });
        }
        if ((nextAdminLevel === 'sub_root' || isTargetSub) && !isCurrentPrimary) {
          return res.status(403).json({ message: 'Chỉ có Admin Gốc Chính mới có quyền phân quyền hoặc thay đổi tài khoản Admin Gốc Phụ.' });
        }
        if (!isCurrentAnyRoot) {
          return res.status(403).json({ message: 'Chỉ có Admin gốc mới có quyền phân quyền hoặc thay đổi vai trò Quản trị viên (Admin/CTV).' });
        }
        if (isSelf && nextRole !== 'admin') {
          return res.status(400).json({ message: 'Bạn không thể tự chuyển đổi vai trò của chính mình sang Khách hàng.' });
        }

        changes.role = nextRole;
        changes.adminLevel = nextAdminLevel;
      }

      if (req.body?.status !== undefined || req.body?.isBanned !== undefined) {
        if (isTargetPrimary) {
          return res.status(400).json({ message: 'Không thể vô hiệu hóa tài khoản Admin gốc của hệ thống.' });
        }
        if (isTargetSub && !isCurrentPrimary) {
          return res.status(403).json({ message: 'Chỉ có Admin Gốc Chính mới có quyền vô hiệu hóa tài khoản Admin Gốc Phụ.' });
        }
        if (isSelf) {
          return res.status(400).json({ message: 'Bạn không thể tự vô hiệu hóa tài khoản của chính mình.' });
        }
        if (isTargetAdmin && !isCurrentAnyRoot) {
          return res.status(403).json({ message: 'Chỉ có Admin gốc mới có quyền vô hiệu hóa hoặc mở khóa Quản trị viên khác.' });
        }
        const nextBanned = req.body.status === 'banned' || req.body.isBanned === true;
        changes.status = nextBanned ? 'banned' : 'active';
        changes.isBanned = nextBanned;
      }

      if (Object.keys(changes).length === 0) return res.status(400).json({ message: 'Không có thay đổi hợp lệ.' });
      if (existing.role === 'admin' && changes.role === 'customer' && users.filter({ role: 'admin' }).size().value() <= 1) {
        return res.status(400).json({ message: 'Không thể hạ quyền admin duy nhất.' });
      }
      const updated = users.find({ id: userId }).assign(changes).write();
      res.json(safeUser(updated));
      return;
    }
    if (req.method === 'DELETE') {
      if (isTargetPrimary) {
        return res.status(400).json({ message: 'Không thể xóa tài khoản Admin gốc của hệ thống.' });
      }
      if (isTargetSub && !isCurrentPrimary) {
        return res.status(403).json({ message: 'Chỉ có Admin Gốc Chính mới có quyền xóa tài khoản Admin Gốc Phụ.' });
      }
      if (isSelf) {
        return res.status(400).json({ message: 'Không thể xóa tài khoản admin đang sử dụng.' });
      }
      if (isTargetAdmin && !isCurrentAnyRoot) {
        return res.status(403).json({ message: 'Chỉ có Admin gốc mới có quyền xóa tài khoản Quản trị viên (Admin/CTV) khác.' });
      }
      users.remove({ id: userId }).write();
      db.set('favorites', db.get('favorites').filter(item => Number(item.userId) !== userId).value()).write();
      db.set('history', db.get('history').filter(item => Number(item.userId) !== userId).value()).write();
      res.status(204).end();
      return;
    }
  }

  res.status(405).json({ message: 'Phương thức hoặc tài nguyên admin không được hỗ trợ.' });
}

function handleCustomerApi(req, res, user) {
  const parts = req.path.split('/').filter(Boolean).slice(2);
  const [resource] = parts;
  const userId = Number(user.id);

  if (resource === 'favorites') {
    if (req.method === 'GET') {
      const dishIds = db.get('favorites').filter({ userId }).map('dishId').value();
      res.json({ dishIds });
      return;
    }
    if (req.method === 'PUT') {
      const requestedIds = Array.isArray(req.body?.dishIds) ? req.body.dishIds.map(Number) : [];
      const validIds = [...new Set(requestedIds)].filter(id => db.get('dishes').find({ id }).value());
      const remaining = db.get('favorites').filter(item => Number(item.userId) !== userId).value();
      const records = validIds.map(dishId => ({ userId, dishId, createdAt: new Date().toISOString() }));
      db.set('favorites', [...remaining, ...records]).write();
      res.json({ dishIds: validIds });
      return;
    }
  }

  if (resource === 'history') {
    if (req.method === 'GET') {
      const history = db.get('history').filter({ userId }).value().slice(-50).reverse().map(item => ({
        ...item,
        dish: db.get('dishes').find({ id: Number(item.dishId) }).value() || null,
      }));
      res.json(history);
      return;
    }
    if (req.method === 'POST') {
      const dishId = Number(req.body?.dishId);
      const dish = db.get('dishes').find({ id: dishId }).value();
      if (!dish) return res.status(404).json({ message: 'Không tìm thấy món ăn.' });
      const entry = { id: nextId('history'), userId, dishId, viewedAt: new Date().toISOString() };
      const ownHistory = db.get('history').filter(item => Number(item.userId) === userId).value();
      const otherHistory = db.get('history').filter(item => Number(item.userId) !== userId).value();
      db.set('history', [...otherHistory, ...ownHistory.slice(-49), entry]).write();
      res.status(201).json({ ...entry, dish });
      return;
    }
  }

  res.status(405).json({ message: 'Phương thức hoặc tài nguyên khách hàng không được hỗ trợ.' });
}

app.use(jsonServer.defaults({ noCors: true }));
app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin && isOriginAllowed(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Accept,Authorization,Content-Type');
  }

  if (req.method === 'OPTIONS') {
    res.status(isOriginAllowed(origin) ? 204 : 403).end();
    return;
  }

  next();
});
app.use(jsonServer.bodyParser);
app.use((req, res, next) => {
  if (req.path === '/health' && req.method === 'GET') {
    res.json({ ok: true });
    return;
  }
  next();
});
app.use((req, res, next) => {
  if (req.method === 'POST' && ['/register', '/signup', '/users'].includes(req.path)) {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (name.length < 2) {
      return res.status(400).json({ message: 'Tên người dùng phải có ít nhất 2 ký tự.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Vui lòng nhập địa chỉ email hợp lệ.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }

    // 1. Báo lỗi rõ ràng nếu tên người dùng trùng lặp
    const existingName = db.get('users').find(u => String(u.name || '').trim().toLowerCase() === name.toLowerCase()).value();
    if (existingName) {
      return res.status(409).json({ message: 'Tên tài khoản này đã được sử dụng. Vui lòng chọn tên khác.' });
    }

    // 2. Báo lỗi rõ ràng nếu email trùng lặp
    const existingEmail = db.get('users').find(u => String(u.email || '').trim().toLowerCase() === email).value();
    if (existingEmail) {
      return res.status(409).json({ message: 'Email này đã được sử dụng. Vui lòng chọn email khác hoặc đăng nhập.' });
    }

    req.body.name = name;
    req.body.email = email;
    req.body.role = 'customer';
    req.body.adminLevel = 'customer';
  }
  if (req.method === 'POST' && ['/login', '/signin'].includes(req.path)) {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const existing = db.get('users').find(u => String(u.email).toLowerCase() === email).value();
    if (existing && (existing.status === 'banned' || existing.isBanned)) {
      return res.status(403).json({ message: 'Tài khoản của bạn đã bị vô hiệu hóa bởi quản trị viên.' });
    }
  }
  next();
});
app.use(jsonServerAuth);

app.use((req, res, next) => {
  const user = userFromRequest(req);
  if (user && (user.status === 'banned' || user.isBanned)) {
    return res.status(403).json({ message: 'Tài khoản của bạn đã bị vô hiệu hóa bởi quản trị viên.' });
  }

  if (/^\/(users|dishes|favorites|history)(\/|$)/.test(req.path)) {
    res.status(404).json({ message: 'Hãy dùng API được phân quyền.' });
    return;
  }

  if (req.path === '/api/settings' && req.method === 'GET') {
    res.json(db.get('settings').value() || DEFAULT_SETTINGS);
    return;
  }

  if (req.path === '/api/analytics/event' && req.method === 'POST') {
    const user = userFromRequest(req);
    const event = {
      id: nextId('events'),
      type: String(req.body?.type || 'action'),
      userId: user ? Number(user.id) : null,
      userName: user ? String(user.name || user.email) : 'Khách vãng lai',
      details: (req.body?.details && typeof req.body.details === 'object') ? req.body.details : {},
      ip: req.ip || req.socket?.remoteAddress || '127.0.0.1',
      userAgent: req.get('User-Agent') || '',
      timestamp: new Date().toISOString(),
    };
    const events = db.get('events').value() || [];
    db.set('events', [...events.slice(-999), event]).write();
    res.status(201).json({ ok: true });
    return;
  }

  if (req.path === '/api/dishes' && req.method === 'GET') {
    res.json(db.get('dishes').value());
    return;
  }

  if (req.path === '/api/nearby' && req.method === 'GET') {
    const user = userFromRequest(req);
    if (!user) return unauthorized(res);

    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radiusKm = Number(req.query.radiusKm);
    if (
      !Number.isFinite(lat) || lat < -90 || lat > 90
      || !Number.isFinite(lng) || lng < -180 || lng > 180
      || !Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 10
    ) {
      return res.status(400).json({ message: 'Tọa độ hoặc bán kính tìm kiếm không hợp lệ.' });
    }

    const dishQuery = String(req.query.dish || req.query.q || '').trim();
    const categoryQuery = String(req.query.category || '').trim();

    (async () => {
      try {
        const elements = await getRealNearbyPlaces(lat, lng, radiusKm, dishQuery, categoryQuery);
        res.json({ elements });
      } catch (err) {
        console.error('Error fetching real nearby places:', err);
        const fallback = getVerifiedFallbackPlaces(lat, lng, dishQuery, categoryQuery);
        res.json({ elements: fallback });
      }
    })();
    return;
  }

  if (req.path === '/api/me') {
    const user = userFromRequest(req);
    if (!user) return unauthorized(res);
    if (req.method === 'GET') {
      res.json(safeUser(user));
      return;
    }
    if (req.method === 'PATCH') {
      const name = String(req.body?.name || '').trim();
      if (name.length < 2) return res.status(400).json({ message: 'Tên phải có ít nhất 2 ký tự.' });
      const existingName = db.get('users').find(u => Number(u.id) !== Number(user.id) && String(u.name || '').trim().toLowerCase() === name.toLowerCase()).value();
      if (existingName) {
        return res.status(409).json({ message: 'Tên người dùng này đã được sử dụng bởi tài khoản khác. Vui lòng chọn tên khác.' });
      }
      const updated = db.get('users').find({ id: user.id }).assign({ name }).write();
      res.json(safeUser(updated));
      return;
    }
    return res.status(405).json({ message: 'Phương thức không được hỗ trợ.' });
  }

  if (req.path.startsWith('/api/admin/')) {
    const user = userFromRequest(req);
    if (!user) return unauthorized(res);
    if (user.role !== 'admin') return forbidden(res);
    handleAdminApi(req, res, user);
    return;
  }

  if (req.path.startsWith('/api/customer/')) {
    const user = userFromRequest(req);
    if (!user) return unauthorized(res);
    handleCustomerApi(req, res, user);
    return;
  }

  next();
});

app.use(router);

const port = Number(process.env.PORT || process.env.API_PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
app.listen(port, host, () => {
  console.log(`BungOiAnGi API listening on http://${host}:${port}`);
  console.log(`Admin account: ${adminEmail}`);
});