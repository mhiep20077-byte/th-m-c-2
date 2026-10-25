// ============================================================
// 🍜 BungOiAnGi – Ứng Dụng Gợi Ý Món Ăn (Main App Shell)
// ============================================================

import './styles/main.css';
import './features/airdrop/airdrop.css';
import './features/auth/auth.css';
import './features/portals/portals.css';
import './features/culinary-arena/arena.css';

import { dishes, MOODS, BUDGETS, CATEGORIES, replaceDishes } from './data/dishes.js';
import { DEFAULT_VOUCHERS, getLocalVouchers, saveLocalVouchers, getLocalClaimedVoucherIds, saveLocalClaimedVoucherIds } from './data/vouchers.js';
import {
  getLocalAdminDishes,
  saveLocalAdminDishes,
  getLocalAdminUsers,
  saveLocalAdminUsers,
  computeLocalStats,
  getActiveVoucherCode,
  setActiveVoucherCode,
  clearActiveVoucherCode,
  calculateVoucherDiscount,
} from './data/adminStorage.js';
import { filterDishes, sortDishes, getRandomDish, getCategoryLabel, removeVietnameseTones } from './features/filters/dishFilters.js';
import { rarityOf, rarityLabel, RARITY_TIERS } from './features/meal-feature/foodRarity.js';
import { QUIZ_QUESTIONS, resolveQuizMood } from './features/quiz/quizData.js';
import { initAirdropManager } from './features/airdrop/airdropManager.js';
import { playClick, playSelect, playBup, playWin } from './utils/uiAudio.js';
import { burst, megaBurst } from './utils/confetti.js';
import { formatCurrency } from './utils/formatCurrency.js';
import { recordServiceClick } from './utils/serviceClickStats.js';
import {
  findNearbyPlaces,
  getCurrentPosition,
  googleMapsDirectionsUrl,
  renderNearbyMap,
  serviceSearchUrl,
  estimateRoadDistanceKm
} from './features/nearby/nearbyPlaces.js';
import { AUTH_SESSION_EXPIRED_EVENT, apiRegister, apiLogin, apiForgotPassword, getAuthSession, setAuthSession, initializeAuth, isAuthenticated, logout, updateProfileName } from './utils/auth.js';
import { requestApi, uploadImageToCloudinary } from './utils/apiClient.js';
import { initMealFeature, populateMealFromDishes, closeDishDetail } from './features/meal-feature/main.js';
import { initCulinaryOracle } from './features/culinary-arena/arena.js';
import {
  getDynamicSettings,
  setDynamicSettings,
  fetchDynamicSettings,
  SETTINGS_UPDATED_EVENT,
  DEFAULT_DYNAMIC_SETTINGS,
  simulateDropProbabilities,
  trackAnalyticsEvent,
  getDishWeight
} from './utils/weightEngine.js';

// ============================================================
// STATE QUẢN LÝ ỨNG DỤNG
// ============================================================
const state = {
  activePage: 'home',
  activeVoucherCode: getActiveVoucherCode(),
  mood: null,
  budget: 'all',
  exploreDiet: 'all',
  exploreSort: 'default',
  favorites: JSON.parse(localStorage.getItem('bung_favs') || '[]'),
  quizAnswers: {},
  quizStep: 0,
  quizAdvancing: false,
  authMode: 'login',
  authMessage: '',
  authMessageType: '',
  authReturnPage: null,
  profile: null,
  profileFavorites: [],
  profileHistory: [],
  profileMessage: '',
  profileMessageType: '',
  vouchers: getLocalVouchers(),
  claimedVoucherIds: getLocalClaimedVoucherIds(),
  voucherFilter: 'all',
  adminTab: 'dishes',
  adminDishes: getLocalAdminDishes(),
  adminUsers: getLocalAdminUsers(),
  adminVouchers: getLocalVouchers(),
  adminStats: null,
  adminAnalytics: null,
  adminSettings: null,
  adminMessage: '',
  adminMessageType: '',
  adminEditDishId: null,
  adminDishDraft: null,
  adminDishSearch: '',
  adminDishFilter: 'all',
  adminEditVoucherId: null,
  adminVoucherDraft: null,
  announcementDismissed: typeof sessionStorage !== 'undefined' && sessionStorage.getItem('bung_ann_dismissed') === 'true',
};

const PAGE_PATHS = {
  home: '/',
  explore: '/explore',
  quiz: '/quiz',
  meal: '/meal',
  airdrop: '/airdrop',
  arena: '/arena',
  'culinary-arena': '/culinary-arena',
  auth: '/auth',
  favs: '/favs',
  vouchers: '/vouchers',
  profile: '/profile',
  admin: '/admin',
};

function pageForPath(pathname) {
  return Object.entries(PAGE_PATHS).find(([, path]) => path === pathname)?.[0] || 'home';
}

// ============================================================
// RENDER: APP SHELL & HEADER & PAGES
// ============================================================
function renderApp() {
  document.getElementById('app').innerHTML = `
    ${renderHeader()}
    ${renderPages()}
    ${renderModal()}
    ${renderAnnouncementPopup()}
  `;
  bindAll();
  if (state.activePage === 'meal') initializeMealPage();
  if (state.activePage === 'arena' || state.activePage === 'culinary-arena') initializeArenaPage();
}

const MEAL_CATEGORY_MAP = {
  nuoc: 'mon-nuoc',
  com: 'mon-com',
  'xao-kho': 'mon-kho',
  anvat: 'an-vat',
  ngot: 'mon-ngot',
  uong: 'do-uong'
};

function getMealFeatureDishes() {
  return dishes.map(dish => ({
    ...dish,
    category: MEAL_CATEGORY_MAP[dish.category] || dish.category,
    description: dish.description || dish.desc || '',
    image: dish.image || dish.img || '',
    type: dish.type || dish.diet || ((dish.tags || []).includes('chay') ? 'chay' : 'man')
  }));
}

function initializeMealPage() {
  const container = document.getElementById('meal-container');
  const detailModalContainer = document.getElementById('dish-detail-container');
  if (!container || !detailModalContainer) return;

  void initMealFeature({
    container,
    detailModalContainer,
    dishes: getMealFeatureDishes()
  });
}

function initializeArenaPage() {
  const ritualContainer = document.getElementById('ritual-panel-container');
  const altarContainer = document.getElementById('altar-container');
  if (!ritualContainer || !altarContainer) return;

  void initCulinaryOracle({
    dishes: getMealFeatureDishes(),
    onToggleFav: (dishId) => {
      const id = Number(dishId);
      toggleFav(id);
      updateFavBadge();
      if (state.favorites.includes(id)) {
        burst(window.innerWidth / 2, window.innerHeight / 2, 25);
      }
    },
    isFav: (dishId) => state.favorites.includes(Number(dishId)),
    onGoToMeal: (dishesFromOracle) => {
      navigateTo('meal');
      if (Array.isArray(dishesFromOracle) && dishesFromOracle.length > 0) {
        populateMealFromDishes(dishesFromOracle, true);
        burst(window.innerWidth / 2, window.innerHeight / 3, 35);
      }
    }
  });
}

function renderAnnouncementBar() {
  const settings = getDynamicSettings();
  const ann = settings?.announcement;
  if (!ann?.enabled || state.announcementDismissed || !ann?.text) return '';
  return `
    <aside class="announcement-bar ${ann.type || 'promo'}" id="announcement-bar">
      <span>${escapeHTML(ann.text)}</span>
      ${ann.link ? `<a href="${escapeHTML(ann.link)}" target="_blank" rel="noopener noreferrer" class="announcement-link" data-sponsor-click="announcement" data-sponsor-name="Thanh thông báo">Khám phá ngay ↗</a>` : ''}
      <button type="button" class="announcement-close" id="announcement-close" aria-label="Đóng thông báo">×</button>
    </aside>
  `;
}

function renderAnnouncementPopup() {
  const settings = getDynamicSettings();
  const ann = settings?.announcement;
  if (!ann?.enabled || state.announcementDismissed || !ann?.text) return '';
  return `
    <div class="announcement-modal-backdrop" id="announcement-modal-backdrop" role="dialog" aria-modal="true">
      <div class="announcement-modal-card ${ann.type || 'promo'}">
        <div class="announcement-modal-header">
          <div class="announcement-modal-badge">
            <span class="announcement-pulse-dot"></span>
            ${ann.type === 'alert' ? '⚠️ THÔNG BÁO QUAN TRỌNG' : ann.type === 'info' ? 'ℹ️ TIN TỨC MỚI' : '🎁 ƯU ĐÃI NỔI BẬT HÔM NAY'}
          </div>
          <button type="button" class="announcement-modal-close" id="announcement-modal-close" aria-label="Đóng thông báo">✕</button>
        </div>
        <div class="announcement-modal-body">
          <div class="announcement-modal-icon">
            ${ann.type === 'alert' ? '📢' : ann.type === 'info' ? '✨' : '🎉'}
          </div>
          <div class="announcement-modal-content">
            <h3 class="announcement-modal-title">${escapeHTML(ann.title || 'Ưu Đãi Đặc Biệt Từ BungOiAnGi ✨')}</h3>
            <p class="announcement-modal-desc">${escapeHTML(ann.text)}</p>
          </div>
        </div>
        <div class="announcement-modal-actions">
          ${ann.link ? `
            <a href="${escapeHTML(ann.link)}" target="_blank" rel="noopener noreferrer" class="announcement-modal-cta" data-sponsor-click="announcement_popup" data-sponsor-name="${escapeHTML(ann.title || 'Thông báo nổi')}">
              🚀 Nhận Ưu Đãi Ngay
            </a>
          ` : ''}
          <button type="button" class="announcement-modal-dismiss" id="announcement-modal-dismiss">
            Đã hiểu & Khám phá
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderHeroAdsBanner() {
  const settings = getDynamicSettings();
  const ad = settings?.ads;
  if (!ad?.bannerEnabled || !ad?.title) return '';
  return `
    <section class="hero-ads-banner" id="hero-ads-banner">
      <div class="hero-ads-inner">
        <div class="hero-ads-left">
          <div class="hero-ads-media-wrap">
            ${ad.img ? `
              <img src="${escapeHTML(ad.img)}" alt="${escapeHTML(ad.title)}" class="hero-ads-img" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80'" />
            ` : `
              <div class="hero-ads-img-fallback">🔥</div>
            `}
            <span class="hero-ads-shine-effect"></span>
          </div>
          <div class="hero-ads-body">
            <div class="hero-ads-badge-row">
              <span class="hero-ads-badge">
                <span class="hero-ads-ping-dot"></span>
                ${escapeHTML(ad.badge || 'ĐỐI TÁC VÀNG')}
              </span>
              <span class="hero-ads-tag-pill">⭐ Đề Xuất Quán Hot Hôm Nay</span>
            </div>
            <h3 class="hero-ads-title">${escapeHTML(ad.title)}</h3>
            ${ad.subtitle ? `<p class="hero-ads-sub">${escapeHTML(ad.subtitle)}</p>` : ''}
            <div class="hero-ads-perks">
              <span class="hero-perk-item">⚡ Nóng hổi tức thì</span>
              <span class="hero-perk-item">🛵 Giao hỏa tốc 20p</span>
              <span class="hero-perk-item">🎁 Deal độc quyền BungOiAnGi</span>
            </div>
          </div>
        </div>
        <div class="hero-ads-cta-wrap">
          ${ad.link ? `
            <a href="${escapeHTML(ad.link)}" target="_blank" rel="noopener noreferrer" class="hero-ads-btn" data-sponsor-click="hero_banner" data-sponsor-name="${escapeHTML(ad.title)}">
              <span>ĐẶT MÓN NGAY</span>
              <span class="hero-ads-arrow">➔</span>
            </a>
          ` : ''}
        </div>
      </div>
    </section>
  `;
}

function renderHeader() {
  const favCount = state.favorites.length;
  const session = getAuthSession();
  const isLoggedIn = Boolean(session?.user);
  const isAdmin = session?.user?.role === 'admin';
  const authLabel = isLoggedIn ? 'Tài khoản' : 'Đăng nhập';
  const settings = getDynamicSettings();
  const feat = settings?.features || {};

  return `
  ${renderAnnouncementBar()}
  <header class="header" id="header">
    <div class="header-inner">
      <a href="#" class="logo" id="logo-link">
        <span class="logo-icon">🍜</span>
        <span class="logo-text">
          <span class="logo-title">BUNGOIANGI</span>
          <span class="logo-sub">Bụng đói có món ngay ✨</span>
        </span>
      </a>
      <nav class="nav" id="main-nav">
        <button class="nav-btn ${state.activePage === 'home' ? 'active' : ''}" data-page="home" id="nav-home">🏠 Trang chủ</button>
        <button class="nav-btn ${state.activePage === 'explore' ? 'active' : ''}" data-page="explore" id="nav-explore">🔍 Khám phá</button>
        ${feat.quizEnabled !== false ? `<button class="nav-btn ${state.activePage === 'quiz' ? 'active' : ''}" data-page="quiz" id="nav-quiz">🤔 Hôm nay ăn gì?</button>` : ''}
        ${feat.mealEnabled !== false ? `<button class="nav-btn ${state.activePage === 'meal' ? 'active' : ''}" data-page="meal" id="nav-meal" title="Dựng mâm cơm 4 món chuẩn vị">🍽️ Dựng bữa <span class="nav-badge-pill">Mâm cơm</span></button>` : ''}
        ${feat.airdropEnabled !== false ? `<button class="nav-btn ${state.activePage === 'airdrop' ? 'active' : ''}" data-page="airdrop" id="nav-airdrop" title="Thả hòm thính cứu đói">🎁 Hòm thính <span class="nav-badge-pill">Loot</span></button>` : ''}
        ${feat.arenaEnabled !== false ? `<button class="nav-btn ${state.activePage === 'arena' ? 'active' : ''}" data-page="arena" id="nav-arena" title="Chiêm tinh ẩm thực & Food Tarot (Culinary Arena)">🔮 Chiêm tinh ẩm thực <span class="nav-badge-pill">Tarot 3D</span></button>` : ''}
        <button class="nav-btn ${state.activePage === 'vouchers' ? 'active' : ''}" data-page="vouchers" id="nav-vouchers" title="Kho Voucher & Ưu Đãi Độc Quyền">🎟️ Kho Voucher <span class="nav-badge-pill">Hot Deal</span></button>
      </nav>
      <div class="header-actions">
        <button class="fav-btn" id="fav-nav-btn">
          ❤️ Gu của tôi
          ${favCount > 0 ? `<span class="fav-badge" id="fav-badge">${favCount}</span>` : `<span class="fav-badge hidden" id="fav-badge">0</span>`}
        </button>
        <div class="header-menu">
          <button class="header-menu-trigger" id="header-menu-trigger" aria-label="Mở menu" title="Menu">☰</button>
          <div class="header-menu-popup hidden" id="header-menu-popup">
            <div class="header-menu-header">
              <span>Menu</span>
              <button type="button" class="header-menu-close" id="header-menu-close" aria-label="Đóng menu">×</button>
            </div>
            <div class="header-menu-grid">
              <button type="button" class="header-menu-item" data-header-action="auth">
                <span class="header-menu-icon">☰</span>
                <span class="header-menu-label">${authLabel}</span>
              </button>
              <button type="button" class="header-menu-item" data-header-action="volume">
                <span class="header-menu-icon">🔊</span>
                <span class="header-menu-label">Âm lượng</span>
              </button>
              <button type="button" class="header-menu-item" data-header-action="vouchers">
                <span class="header-menu-icon">🎟️</span>
                <span class="header-menu-label">Kho Voucher</span>
              </button>
              ${isLoggedIn ? `<button type="button" class="header-menu-item" data-header-action="profile">
                <span class="header-menu-icon">👤</span>
                <span class="header-menu-label">Cá nhân</span>
              </button>` : ''}
              ${isAdmin ? `<button type="button" class="header-menu-item" data-header-action="admin">
                <span class="header-menu-icon">🛠️</span>
                <span class="header-menu-label">Quản trị</span>
              </button>` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>`;
}

function renderPages() {
  const settings = getDynamicSettings();
  const feat = settings?.features || {};
  const isAdmin = getAuthSession()?.user?.role === 'admin';
  if (feat.maintenanceMode && !isAdmin && state.activePage !== 'auth') {
    return `
      <main class="portal-page" style="text-align:center;padding:5rem 1rem;max-width:600px;margin:0 auto">
        <div style="font-size:3.5rem;margin-bottom:1rem">🛠️</div>
        <h1 style="font-size:1.8rem;margin-bottom:0.75rem;color:var(--text-main)">Hệ Thống Đang Bảo Trì</h1>
        <p style="font-size:1.05rem;color:var(--text-sub);line-height:1.6;margin-bottom:1.5rem">
          ${escapeHTML(feat.maintenanceNotice || 'Hệ thống đang bảo trì ít phút để nâng cấp các món ăn mới. Quý khách vui lòng quay lại sau ít phút nhé!')}
        </p>
        <button type="button" class="portal-button" onclick="window.location.reload()">↻ Tải lại trang</button>
      </main>
    `;
  }

  return `
    <main>
      <div id="page-home" class="page ${state.activePage === 'home' ? 'active' : ''}">${renderHome()}</div>
      <div id="page-explore" class="page ${state.activePage === 'explore' ? 'active' : ''}">${renderExplore()}</div>
      <div id="page-quiz" class="page ${state.activePage === 'quiz' ? 'active' : ''}">${renderQuiz()}</div>
      <div id="page-meal" class="page ${state.activePage === 'meal' ? 'active' : ''}">
        <div class="meal-feature-page">
          <div id="meal-container"></div>
          <div id="dish-detail-container"></div>
        </div>
      </div>
      <div id="page-airdrop" class="page ${state.activePage === 'airdrop' ? 'active' : ''}"><div id="airdrop-container"></div></div>
      <div id="page-arena" class="page ${state.activePage === 'arena' ? 'active' : ''}">
        <div class="culinary-arena-page">
          <div class="oracle-sub-header">
            <div class="oracle-sub-brand">
              <span class="oracle-logo-badge">🔮</span>
              <div>
                <h2 class="oracle-sub-title">CULINARY ORACLE</h2>
                <span class="oracle-sub-desc">Chiêm Tinh Ẩm Thực & Food Tarot</span>
              </div>
            </div>
            <div class="oracle-nav-actions">
              <button id="arena-journal-btn" class="btn-mystic-link" type="button" title="Xem các quẻ chiêm tinh đã lưu">
                📖 Sổ Quẻ Đã Gieo
              </button>
              <button id="arena-sound-toggle-btn" class="btn-sound-toggle" type="button" aria-label="Bật/Tắt âm thanh" title="Bật/Tắt âm thanh">
                🔊
              </button>
            </div>
          </div>

          <div class="oracle-wrapper">
            <div class="oracle-hero">
              <div class="hero-pill">🔮 Chiêm Tinh Bữa Ăn & Food Tarot</div>
              <h2>Gieo Quẻ Vị Giác Hôm Nay</h2>
              <p>Hít một hơi thật sâu, kết nối với cảm giác của chiếc bụng đói và lật từng lá bài Tarot để lắng nghe định mệnh ẩm thực dành riêng cho bạn.</p>
            </div>

            <!-- Khung chọn Kiểu trải bài & Bắt mạch cảm xúc -->
            <div id="ritual-panel-container"></div>

            <!-- Bàn thờ hiển thị các lá bài Tarot 3D -->
            <div id="altar-container"></div>
          </div>

          <!-- Modal Sổ Tay Quẻ Chiêm Tinh (Lịch Sử) -->
          <div id="journal-modal-backdrop" class="journal-modal-backdrop">
            <div class="journal-modal">
              <div class="journal-header">
                <h3>📖 SỔ TAY QUẺ CHIÊM TINH</h3>
                <button id="journal-close-btn" class="journal-close-btn" aria-label="Đóng">&times;</button>
              </div>
              <div id="journal-entries-container" class="journal-body">
                <!-- Danh sách quẻ đã lưu sẽ được nạp vào đây -->
              </div>
            </div>
          </div>
        </div>
      </div>
      <div id="page-auth" class="page ${state.activePage === 'auth' ? 'active' : ''}">${renderAuthPage()}</div>
      <div id="page-favs" class="page ${state.activePage === 'favs' ? 'active' : ''}">${renderFavs()}</div>
      <div id="page-vouchers" class="page ${state.activePage === 'vouchers' ? 'active' : ''}">${renderVouchersPage()}</div>
      <div id="page-profile" class="page ${state.activePage === 'profile' ? 'active' : ''}">${renderProfilePage()}</div>
      <div id="page-admin" class="page ${state.activePage === 'admin' ? 'active' : ''}">${renderAdminPage()}</div>
    </main>`;
}

function getUserRoleInfo(user) {
  if (!user) return { level: 'customer', title: 'Khách hàng', icon: '👤', badgeClass: 'badge-customer' };
  const isPrimary = Boolean(user.isPrimaryRootAdmin || user.adminLevel === 'primary_root' || (!user.adminLevel && (Number(user.id) === 1 || String(user.email).toLowerCase() === 'admin@bungoiangi.com')));
  if (isPrimary) {
    return { level: 'primary_root', title: 'Admin Gốc Chính', icon: '👑', badgeClass: 'badge-root' };
  }
  const isSub = !isPrimary && Boolean(user.isSubRootAdmin || user.adminLevel === 'sub_root' || user.subRole === 'sub_root');
  if (isSub) {
    return { level: 'sub_root', title: 'Admin Gốc Phụ', icon: '⭐', badgeClass: 'badge-sub-root' };
  }
  if (user.role === 'admin' || user.adminLevel === 'ctv' || user.isCtv) {
    return { level: 'ctv', title: 'Cộng tác viên (CTV)', icon: '🛡️', badgeClass: 'badge-ctv' };
  }
  return { level: 'customer', title: 'Khách hàng', icon: '👤', badgeClass: 'badge-customer' };
}

function renderAuthPage() {
  const session = getAuthSession();
  if (session?.user) {
    const roleInfo = getUserRoleInfo(session.user);
    return `
      <div class="auth-shell">
        <div class="auth-account-box">
          <div class="avatar">👋</div>
          <h3>Xin chào, ${session.user.name}</h3>
          <p>${session.user.email}</p>
          <div class="meta">🔐 Đã đăng nhập • ${roleInfo.icon} ${roleInfo.title}</div>
          <button class="btn-primary" id="auth-logout-btn" style="width:100%; max-width:220px;">Đăng xuất</button>
        </div>
      </div>`;
  }

  const safeMode = ['login', 'register', 'forgot'].includes(state.authMode) ? state.authMode : 'login';
  const mode = safeMode;
  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';

  return `
    <div class="auth-shell">
      <div class="auth-card">
        <div class="auth-hero">
          <span class="eyebrow">BungOiAnGi</span>
          <h2>Trải nghiệm đặt món dễ dàng hơn.</h2>
          <p>Đăng nhập để lưu gu món yêu thích, giữ trạng thái cá nhân và đặt hàng nhanh qua ShopeeFood / GrabFood.</p>
          <div class="hero-badges">
            <span class="hero-badge">⚡ Tự động lưu token</span>
            <span class="hero-badge">🔒 Bảo mật đơn giản</span>
            <span class="hero-badge">📦 Quản lý tài khoản</span>
          </div>
        </div>

        <div class="auth-panel">
          <div class="auth-header">
            <h3>${isForgot ? 'Quên mật khẩu' : isRegister ? 'Đăng ký' : 'Đăng nhập'}</h3>
            <div class="auth-switcher">
              <button type="button" class="auth-tab ${mode === 'login' ? 'active' : ''}" data-auth-mode="login">Đăng nhập</button>
              <button type="button" class="auth-tab ${mode === 'register' ? 'active' : ''}" data-auth-mode="register">Đăng ký</button>
              <button type="button" class="auth-tab ${mode === 'forgot' ? 'active' : ''}" data-auth-mode="forgot">Quên MK</button>
            </div>
          </div>

          <div class="auth-message info" style="margin-bottom: 1rem;">📌 Tài khoản đăng ký mới có quyền khách hàng.</div>

          <form class="auth-form" id="auth-form">
            ${isRegister ? `
              <div class="form-row">
                <label for="auth-name">Họ và tên</label>
                <input id="auth-name" name="name" type="text" placeholder="Nhập họ và tên" minlength="2" required />
              </div>
            ` : ''}
            <div class="form-row">
              <label for="auth-email">Email</label>
              <input id="auth-email" name="email" type="email" placeholder="name@example.com" required />
            </div>

            ${!isForgot ? `
              <div class="form-row">
                <label for="auth-password">Mật khẩu</label>
                <div class="password-input-wrap">
                  <input id="auth-password" name="password" type="password" placeholder="Nhập mật khẩu" required />
                  <button type="button" class="password-toggle" data-target="auth-password" aria-label="Hiện mật khẩu">👁</button>
                </div>
              </div>
            ` : `
              <div class="form-row">
                <label for="auth-new-password">Mật khẩu mới</label>
                <div class="password-input-wrap">
                  <input id="auth-new-password" name="newPassword" type="password" placeholder="Tạo mật khẩu mới" required />
                  <button type="button" class="password-toggle" data-target="auth-new-password" aria-label="Hiện mật khẩu">👁</button>
                </div>
              </div>
            `}

            <button type="submit" class="auth-submit">
              ${isForgot ? 'Đặt lại mật khẩu' : isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}
            </button>
          </form>

          <div id="auth-message" class="auth-message ${state.authMessageType}">${state.authMessage}</div>
        </div>
      </div>
    </div>`;
}

function renderVouchersPage() {
  const allVouchers = state.vouchers || [];
  const claimedSet = new Set((state.claimedVoucherIds || []).map(Number));

  // Counts for filter chips
  const totalCount = allVouchers.length;
  const claimedCount = allVouchers.filter(v => claimedSet.has(Number(v.id))).length;
  const fixedCount = allVouchers.filter(v => v.discountType === 'fixed').length;
  const percentCount = allVouchers.filter(v => v.discountType === 'percent').length;
  const freeshipCount = allVouchers.filter(v => 
    String(v.code).includes('SHIP') || 
    String(v.title).toLowerCase().includes('vận chuyển') || 
    String(v.badge).toLowerCase().includes('freeship')
  ).length;

  // Filtered list
  const currentFilter = state.voucherFilter || 'all';
  let filtered = allVouchers;
  if (currentFilter === 'claimed') {
    filtered = allVouchers.filter(v => claimedSet.has(Number(v.id)));
  } else if (currentFilter === 'fixed') {
    filtered = allVouchers.filter(v => v.discountType === 'fixed');
  } else if (currentFilter === 'percent') {
    filtered = allVouchers.filter(v => v.discountType === 'percent');
  } else if (currentFilter === 'freeship') {
    filtered = allVouchers.filter(v => 
      String(v.code).includes('SHIP') || 
      String(v.title).toLowerCase().includes('vận chuyển') || 
      String(v.badge).toLowerCase().includes('freeship')
    );
  }

  return `
    <div class="voucher-page">
      <section class="voucher-hero">
        <div class="voucher-hero-badge">🎟️ BungOiAnGi Rewards & Deals</div>
        <h1 class="voucher-hero-title">Kho Voucher & Ưu Đãi Độc Quyền</h1>
        <p class="voucher-hero-sub">
          Thu thập mã giảm giá và mã vận chuyển hỏa tốc để thưởng thức hàng trăm món ngon với mức giá tiết kiệm nhất mỗi ngày!
        </p>
      </section>

      <div class="voucher-container">
        <!-- BỘ LỌC VOUCHER -->
        <div class="voucher-filter-bar" role="tablist" aria-label="Bộ lọc voucher">
          <button type="button" class="voucher-chip ${currentFilter === 'all' ? 'active' : ''}" data-voucher-filter="all">
            🎁 Tất Cả Ưu Đãi <span class="voucher-chip-count">${totalCount}</span>
          </button>
          <button type="button" class="voucher-chip ${currentFilter === 'claimed' ? 'active' : ''}" data-voucher-filter="claimed">
            ⭐ Voucher Của Tôi <span class="voucher-chip-count">${claimedCount}</span>
          </button>
          <button type="button" class="voucher-chip ${currentFilter === 'fixed' ? 'active' : ''}" data-voucher-filter="fixed">
            💵 Giảm Tiền Mặt <span class="voucher-chip-count">${fixedCount}</span>
          </button>
          <button type="button" class="voucher-chip ${currentFilter === 'percent' ? 'active' : ''}" data-voucher-filter="percent">
            ⚡ Giảm % <span class="voucher-chip-count">${percentCount}</span>
          </button>
          <button type="button" class="voucher-chip ${currentFilter === 'freeship' ? 'active' : ''}" data-voucher-filter="freeship">
            🛵 Freeship <span class="voucher-chip-count">${freeshipCount}</span>
          </button>
        </div>

        <!-- DANH SÁCH THẺ VOUCHER -->
        ${filtered.length > 0 ? `
          <div class="vouchers-grid">
            ${filtered.map(voucher => {
              const isClaimed = claimedSet.has(Number(voucher.id));
              const isPercent = voucher.discountType === 'percent';
              const isFreeship = String(voucher.code).includes('SHIP') || String(voucher.badge).toLowerCase().includes('freeship');
              const isAncient = voucher.category === 'ancient' || Number(voucher.discountValue) >= 50000;
              
              let typeClass = 'type-fixed';
              if (isPercent) typeClass = 'type-percent';
              else if (isFreeship) typeClass = 'type-freeship';
              else if (isAncient) typeClass = 'type-ancient';

              let discountDisplay = '';
              let unitDisplay = 'GIẢM';
              if (isPercent) {
                discountDisplay = `${voucher.discountValue}%`;
                unitDisplay = 'GIẢM GIÁ';
              } else {
                const kVal = voucher.discountValue >= 1000 ? Math.round(voucher.discountValue / 1000) : voucher.discountValue;
                discountDisplay = `${kVal}K`;
                unitDisplay = 'TIỀN MẶT';
              }

              const used = Number(voucher.usedCount || 0);
              const limit = Number(voucher.usageLimit || 100);
              const percentUsed = Math.min(100, Math.round((used / limit) * 100));

              return `
                <article class="voucher-card ${typeClass} ${isClaimed ? 'is-claimed' : ''}" data-voucher-card="${voucher.id}">
                  <!-- PHẦN CUỐNG VÉ TRÁI -->
                  <div class="voucher-stub">
                    <div class="voucher-stub-icon">${isFreeship ? '🛵' : isPercent ? '⚡' : isAncient ? '💎' : '🎁'}</div>
                    <div class="voucher-stub-val">${discountDisplay}</div>
                    <div class="voucher-stub-unit">${unitDisplay}</div>
                    <div class="voucher-stub-tag">${escapeHTML(voucher.badge || 'Deal Hot')}</div>
                  </div>

                  <!-- RÃNH XÉ RĂNG CƯA -->
                  <div class="voucher-divider"></div>

                  <!-- PHẦN NỘI DUNG PHẢI -->
                  <div class="voucher-main">
                    <div>
                      <div class="voucher-header">
                        <span class="voucher-badge">${escapeHTML(voucher.badge || 'Ưu đãi')}</span>
                        ${isClaimed ? `<span class="voucher-status-tag">✓ Đã trong ví</span>` : ''}
                      </div>

                      <h3 class="voucher-title">${escapeHTML(voucher.title)}</h3>
                      <p class="voucher-desc">${escapeHTML(voucher.desc)}</p>

                      <div class="voucher-code-row">
                        <div class="voucher-code-box">
                          <span>🎟️</span>
                          <strong>${escapeHTML(voucher.code)}</strong>
                        </div>
                        <button type="button" class="voucher-code-copy" data-copy-voucher="${escapeHTML(voucher.code)}" title="Sao chép mã vào khay nhớ tạm">
                          <span>📋</span> Chép mã
                        </button>
                      </div>

                      <div class="voucher-meta-row">
                        <span>Đơn tối thiểu: <strong>${voucher.minOrder ? formatCurrency(voucher.minOrder) : '0đ'}</strong></span>
                        <div class="voucher-expiry" title="Hạn sử dụng">
                          <span>⏳</span>
                          <span>HSD: ${escapeHTML(voucher.expiryDate || 'Vô thời hạn')}</span>
                        </div>
                      </div>

                      <div class="voucher-progress-wrap">
                        <div class="voucher-progress-label">
                          <span>Đã dùng ${percentUsed}%</span>
                          <span>${used}/${limit} lượt</span>
                        </div>
                        <div class="voucher-progress-track">
                          <div class="voucher-progress-fill" style="width: ${percentUsed}%"></div>
                        </div>
                      </div>
                    </div>

                    <div class="voucher-actions">
                      <button type="button" class="voucher-btn-claim ${isClaimed ? 'is-claimed' : ''}" data-claim-voucher="${voucher.id}" ${isClaimed ? 'disabled' : ''}>
                        ${isClaimed ? '✓ Đã trong kho' : '＋ Lưu vào kho'}
                      </button>
                      <button type="button" class="voucher-btn-use" data-use-voucher="${escapeHTML(voucher.code)}">
                        Dùng ngay ➔
                      </button>
                    </div>
                  </div>
                </article>
              `;
            }).join('')}
          </div>
        ` : `
          <div style="text-align:center;padding:3.5rem 1rem;background:#ffffff;border-radius:16px;border:1px dashed #cbd5e1;max-width:500px;margin:2rem auto">
            <div style="font-size:3rem;margin-bottom:0.75rem">🎟️</div>
            <h3 style="font-size:1.2rem;font-weight:800;color:var(--text-main);margin-bottom:0.4rem">Chưa có voucher nào trong mục này</h3>
            <p style="font-size:0.88rem;color:var(--text-sub);margin-bottom:1.25rem">
              ${currentFilter === 'claimed' ? 'Bạn chưa lưu voucher nào vào kho. Hãy bấm "Tất cả ưu đãi" để chọn và thu thập mã giảm giá nhé!' : 'Các ưu đãi mới sẽ sớm được cập nhật.'}
            </p>
            ${currentFilter === 'claimed' ? `
              <button type="button" class="portal-button portal-button--primary" data-voucher-filter="all">
                Xem toàn bộ voucher ngay
              </button>
            ` : ''}
          </div>
        `}
      </div>
    </div>
  `;
}

function renderProfilePage() {
  const user = state.profile || getAuthSession()?.user;
  if (!user) return '<section class="portal-page"><p class="portal-empty">Đang tải hồ sơ…</p></section>';

  const claimedVouchersList = state.vouchers.filter(v => state.claimedVoucherIds.includes(Number(v.id)));

  return `
    <section class="portal-page">
      <header class="portal-heading">
        <div><h1>Hồ sơ cá nhân</h1><p>Thông tin, món yêu thích và lịch sử xem của bạn.</p></div>
        <button type="button" class="portal-button portal-button--danger" id="profile-logout-btn">Đăng xuất</button>
      </header>
      <p class="portal-message ${state.profileMessageType === 'error' ? 'is-error' : state.profileMessageType === 'success' ? 'is-success' : ''}" id="profile-message" role="status">${escapeHTML(state.profileMessage)}</p>
      <div class="portal-profile-summary">
        <div class="portal-metric"><span>Tài khoản</span><strong>${getUserRoleInfo(user).icon} ${escapeHTML(getUserRoleInfo(user).title)}</strong></div>
        <div class="portal-metric"><span>Voucher trong kho</span><strong>${state.claimedVoucherIds.length}</strong></div>
        <div class="portal-metric"><span>Món yêu thích</span><strong>${state.profileFavorites.length}</strong></div>
        <div class="portal-metric"><span>Lượt xem gần đây</span><strong>${state.profileHistory.length}</strong></div>
      </div>
      <section class="portal-panel">
        <h2>Thông tin tài khoản</h2>
        <form id="profile-form" class="portal-form-grid">
          <div class="portal-field"><label for="profile-name">Họ và tên</label><input id="profile-name" name="name" value="${escapeHTML(user.name || '')}" required minlength="2" /></div>
          <div class="portal-field"><label for="profile-email">Email</label><input id="profile-email" value="${escapeHTML(user.email || '')}" readonly /></div>
          <div class="portal-actions portal-field--wide"><button class="portal-button portal-button--primary" type="submit">Lưu hồ sơ</button></div>
        </form>
      </section>

      <!-- KHO VOUCHER CỦA BẠN -->
      <section class="portal-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem">
          <h2 style="margin:0">🎟️ Kho Voucher Của Bạn (${claimedVouchersList.length})</h2>
          <button type="button" class="portal-button" data-nav-to-vouchers="true">Khám phá thêm ưu đãi ↗</button>
        </div>
        ${claimedVouchersList.length > 0 ? `
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:0.75rem">
            ${claimedVouchersList.map(v => {
              const isPercent = v.discountType === 'percent';
              const discountText = isPercent ? `${v.discountValue}%` : formatCurrency(v.discountValue);
              return `
              <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:0.85rem 1rem;display:flex;justify-content:space-between;align-items:center;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
                <div>
                  <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.25rem">
                    <span class="admin-code-badge" style="font-size:0.85rem">${escapeHTML(v.code)}</span>
                    <span class="voucher-badge" style="font-size:0.68rem;padding:1px 5px">${escapeHTML(v.badge || 'Ưu đãi')}</span>
                  </div>
                  <div style="font-size:0.85rem;font-weight:750;color:var(--text-main)">${escapeHTML(v.title)}</div>
                  <div style="font-size:0.75rem;color:var(--orange-dark);font-weight:700">Giảm ${discountText} • Đơn từ ${v.minOrder ? formatCurrency(v.minOrder) : '0đ'}</div>
                </div>
                <button type="button" class="voucher-code-copy" data-copy-voucher="${escapeHTML(v.code)}" style="padding:0.35rem 0.65rem">
                  Chép mã
                </button>
              </div>`;
            }).join('')}
          </div>
        ` : '<p class="portal-empty">Bạn chưa lưu voucher nào vào kho cá nhân. <button type="button" class="portal-button portal-button--primary" data-nav-to-vouchers="true" style="margin-left:0.5rem;display:inline-block">Nhận voucher ngay ➔</button></p>'}
      </section>

      <section class="portal-panel">
        <h2>Món yêu thích đồng bộ</h2>
        ${state.profileFavorites.length
      ? `<div class="dishes-grid">${renderDishCards(dishes.filter(dish => state.profileFavorites.includes(Number(dish.id))))}</div>`
      : '<p class="portal-empty">Bạn chưa lưu món nào.</p>'}
      </section>
      <section class="portal-panel">
        <h2>Lịch sử xem gần đây</h2>
        ${state.profileHistory.length ? `<div class="portal-table-wrap"><table class="portal-table"><thead><tr><th>Món</th><th>Thời gian</th></tr></thead><tbody>${state.profileHistory.map(item => `<tr><td>${escapeHTML(item.dish?.name || 'Món đã xóa')}</td><td>${escapeHTML(new Date(item.viewedAt).toLocaleString('vi-VN'))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="portal-empty">Chưa có lịch sử xem.</p>'}
      </section>
    </section>`;
}

function renderAdminPage() {
  const session = getAuthSession();
  const sessionUser = session?.user;
  if (sessionUser?.role !== 'admin') return '<section class="portal-page"><p class="portal-empty">Bạn không có quyền truy cập trang quản trị.</p></section>';

  // Luôn đồng bộ vai trò mới nhất từ danh sách quản trị nếu có
  const dbUser = state.adminUsers.find(u => String(u.id) === String(sessionUser?.id) || String(u.email).toLowerCase() === String(sessionUser?.email).toLowerCase());
  const user = dbUser ? { ...sessionUser, ...dbUser } : sessionUser;
  if (dbUser && session?.token && (sessionUser.adminLevel !== dbUser.adminLevel || sessionUser.isSubRootAdmin !== dbUser.isSubRootAdmin)) {
    setAuthSession(user, session.token);
  }

  const roleInfo = getUserRoleInfo(user);
  const isCurrentPrimaryRoot = roleInfo.level === 'primary_root';
  const isCurrentSubRoot = roleInfo.level === 'sub_root';
  const isCurrentCtv = roleInfo.level === 'ctv';
  const canManageSettings = isCurrentPrimaryRoot || isCurrentSubRoot;
  const isCurrentRootAdmin = canManageSettings;

  const stats = state.adminStats;
  const analytics = state.adminAnalytics;
  const settings = state.adminSettings || getDynamicSettings();
  const rules = settings?.gameRules || DEFAULT_DYNAMIC_SETTINGS.gameRules;
  const features = settings?.features || DEFAULT_DYNAMIC_SETTINGS.features;
  const announcement = settings?.announcement || DEFAULT_DYNAMIC_SETTINGS.announcement;
  const ads = settings?.ads || DEFAULT_DYNAMIC_SETTINGS.ads;

  const editingDish = state.adminDishes.find(dish => Number(dish.id) === Number(state.adminEditDishId));
  const draftValues = state.adminDishDraft?.dishId === (editingDish ? Number(editingDish.id) : null)
    ? state.adminDishDraft.values
    : null;
  const selectedCategory = draftValues?.category ?? editingDish?.category;
  const selectedType = draftValues?.type ?? editingDish?.type ?? 'man';
  const selectedRarity = draftValues?.rarity ?? editingDish?.rarity ?? '';

  const isEditingSponsored = draftValues?.isSponsored !== undefined
    ? (draftValues.isSponsored === 'true' || draftValues.isSponsored === true || draftValues.isSponsored === 'on')
    : Boolean(editingDish?.isSponsored);

  const isEditingBestseller = draftValues?.isBestseller !== undefined
    ? (draftValues.isBestseller === 'true' || draftValues.isBestseller === true || draftValues.isBestseller === 'on')
    : Boolean(editingDish?.isBestseller);

  const isEditingActive = draftValues?.active !== undefined
    ? (draftValues.active === 'true' || draftValues.active === true || draftValues.active === 'on')
    : (editingDish?.active !== undefined ? Boolean(editingDish.active) : true);

  // Filtered dishes for Tab 1
  let filteredAdminDishes = [...state.adminDishes];
  if (state.adminDishFilter === 'sponsored') {
    filteredAdminDishes = filteredAdminDishes.filter(d => d.isSponsored);
  } else if (state.adminDishFilter === 'bestseller') {
    filteredAdminDishes = filteredAdminDishes.filter(d => d.isBestseller);
  } else if (state.adminDishFilter === 'hidden') {
    filteredAdminDishes = filteredAdminDishes.filter(d => d.active === false);
  }

  // TỰ ĐỘNG GHIM MÓN QUẢNG CÁO & TÀI TRỢ LÊN ĐẦU DANH SÁCH
  filteredAdminDishes.sort((a, b) => {
    // 1. Món có cấu hình nhận quảng cáo/tài trợ luôn ở trên cùng
    if (Boolean(b.isSponsored) !== Boolean(a.isSponsored)) {
      return b.isSponsored ? 1 : -1;
    }
    // 2. Trọng số rơi cao hơn
    if ((b.dropWeight || 1) !== (a.dropWeight || 1)) {
      return (b.dropWeight || 1) - (a.dropWeight || 1);
    }
    // 3. Món bestseller
    if (Boolean(b.isBestseller) !== Boolean(a.isBestseller)) {
      return b.isBestseller ? 1 : -1;
    }
    // 4. Món mới thêm theo ID
    return Number(b.id) - Number(a.id);
  });

  const sponsoredCount = state.adminDishes.filter(d => d.isSponsored).length;
  const bestsellerCount = state.adminDishes.filter(d => d.isBestseller).length;
  const hiddenCount = state.adminDishes.filter(d => d.active === false).length;

  // Simulator probabilities
  const simulatedDishes = simulateDropProbabilities(state.adminDishes, settings).slice(0, 10);

  const editingVoucher = state.adminVouchers.find(v => Number(v.id) === Number(state.adminEditVoucherId));
  const voucherDraftValues = state.adminVoucherDraft?.voucherId === (editingVoucher ? Number(editingVoucher.id) : null)
    ? state.adminVoucherDraft.values
    : null;
  const voucherSelectedType = voucherDraftValues?.discountType ?? editingVoucher?.discountType ?? 'fixed';
  const voucherSelectedCategory = voucherDraftValues?.category ?? editingVoucher?.category ?? 'all';
  const isEditingVoucherActive = voucherDraftValues?.active !== undefined
    ? (voucherDraftValues.active === 'true' || voucherDraftValues.active === true || voucherDraftValues.active === 'on')
    : (editingVoucher?.active !== undefined ? Boolean(editingVoucher.active) : true);

  return `
    <section class="portal-page">
      <header class="portal-heading">
        <div>
          <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
            <h1>Trung Tâm Điều Khiển Quản Trị</h1>
            <span class="portal-role-indicator ${isCurrentPrimaryRoot ? 'is-root' : isCurrentSubRoot ? 'is-sub-root' : 'is-ctv'}">
              ${isCurrentPrimaryRoot ? '👑 Admin Gốc Chính (Toàn Quyền Cao Nhất)' : isCurrentSubRoot ? '⭐ Admin Gốc Phụ (Toàn Quyền Dưới Gốc Chính)' : '🛡️ Cộng Tác Viên (CTV) · Quyền Hạn Chế'}
            </span>
          </div>
          <p>Tùy chỉnh toàn bộ tính năng, quản lý luật chơi, tỉ lệ ra món & dữ liệu người dùng.</p>
        </div>
        <div class="portal-actions">
          ${state.adminTab === 'dishes' ? '<button type="button" class="portal-button portal-button--primary" id="admin-add-dish">＋ Thêm món mới</button>' : ''}
          ${state.adminTab === 'users' ? '<button type="button" class="portal-button portal-button--primary" id="admin-add-user">＋ Tạo tài khoản</button>' : ''}
          ${state.adminTab === 'vouchers' ? '<button type="button" class="portal-button portal-button--primary" id="admin-add-voucher">＋ Tạo voucher mới</button>' : ''}
          <button type="button" class="portal-button" id="admin-refresh">↻ Làm mới dữ liệu</button>
        </div>
      </header>

      <p class="portal-message ${state.adminMessageType === 'error' ? 'is-error' : state.adminMessageType === 'success' ? 'is-success' : ''}" id="admin-message" role="status">${escapeHTML(state.adminMessage)}</p>

      <!-- 6 TABS NAVIGATION -->
      <div class="portal-segmented" role="group" aria-label="Khu vực quản trị">
        <button type="button" data-admin-tab="dishes" aria-pressed="${state.adminTab === 'dishes'}">🍲 Món ăn & Menu (${state.adminDishes.length})</button>
        <button type="button" data-admin-tab="rules" aria-pressed="${state.adminTab === 'rules'}">🎲 Luật chơi & Tỉ lệ</button>
        <button type="button" data-admin-tab="analytics" aria-pressed="${state.adminTab === 'analytics'}">📊 Dữ liệu & Báo cáo</button>
        <button type="button" data-admin-tab="settings" aria-pressed="${state.adminTab === 'settings'}">⚙️ Cài đặt Web & CMS</button>
        <button type="button" data-admin-tab="users" aria-pressed="${state.adminTab === 'users'}">👥 Người dùng (${state.adminUsers.length})</button>
        <button type="button" data-admin-tab="vouchers" aria-pressed="${state.adminTab === 'vouchers'}">🎟️ Quản lý Voucher (${state.adminVouchers.length})</button>
      </div>

      <!-- TAB 1: DISHES & MENU -->
      ${state.adminTab === 'dishes' ? `
        <section class="portal-panel">
          <h2>${editingDish ? `Sửa món: ${escapeHTML(editingDish.name)}` : 'Thêm món ăn mới vào thực đơn'}</h2>
          <form id="admin-dish-form" class="portal-form-grid">
            <div class="portal-field">
              <label for="admin-dish-name">Tên món *</label>
              <input id="admin-dish-name" name="name" value="${escapeHTML(draftValues?.name ?? editingDish?.name ?? '')}" required minlength="2" placeholder="Ví dụ: Phở Bò Tái Nạm" />
              <span class="portal-message" id="admin-dish-name-feedback" role="status" aria-live="polite"></span>
            </div>
            <div class="portal-field">
              <label for="admin-dish-price">Giá (VNĐ) *</label>
              <input id="admin-dish-price" name="price" type="number" min="0" value="${draftValues?.price ?? editingDish?.price ?? ''}" required placeholder="Ví dụ: 45000" />
            </div>
            <div class="portal-field portal-field--wide">
              <label for="admin-dish-desc">Mô tả món ăn</label>
              <textarea id="admin-dish-desc" name="desc" placeholder="Hương vị, thành phần chính, đặc trưng...">${escapeHTML(draftValues?.desc ?? editingDish?.desc ?? '')}</textarea>
            </div>
            <div class="portal-field">
              <label for="admin-dish-category">Danh mục</label>
              <select id="admin-dish-category" name="category">
                ${CATEGORIES.filter(c => c.id !== 'all').map(c => `<option value="${c.id}" ${selectedCategory === c.id ? 'selected' : ''}>${escapeHTML(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="portal-field">
              <label for="admin-dish-type">Loại món</label>
              <select id="admin-dish-type" name="type">
                <option value="man" ${selectedType !== 'chay' ? 'selected' : ''}>Mặn</option>
                <option value="chay" ${selectedType === 'chay' ? 'selected' : ''}>Chay</option>
              </select>
            </div>
            <div class="portal-field">
              <label for="admin-dish-calo">Lượng Calo (kcal)</label>
              <input id="admin-dish-calo" name="calo" type="number" min="0" value="${draftValues?.calo ?? editingDish?.calo ?? 0}" />
            </div>
            <div class="portal-field">
              <label for="admin-dish-weight">Trọng số rơi cơ bản (Drop Weight: 1 - 50)</label>
              <input id="admin-dish-weight" name="dropWeight" type="number" step="0.5" min="0.1" max="50" value="${draftValues?.dropWeight ?? editingDish?.dropWeight ?? 1}" title="Trọng số càng cao món càng dễ ra" />
            </div>
            <div class="portal-field">
              <label for="admin-dish-rarity">Độ Hiếm Minigame (Rarity Tier)</label>
              <select id="admin-dish-rarity" name="rarity">
                <option value="" ${!selectedRarity ? 'selected' : ''}>⚡ Tự động theo giá (${editingDish ? rarityLabel(editingDish) : '>=100k là Cổ đại 💎, 55k-99k là Huyền thoại 🔶'})</option>
                <option value="ancient" ${selectedRarity === 'ancient' ? 'selected' : ''}>💎 Cổ đại (Ancient - Giá >100k, mâm cơm hoàng kim)</option>
                <option value="legendary" ${selectedRarity === 'legendary' ? 'selected' : ''}>🔶 Huyền thoại (Legendary - Giá 55k-99k)</option>
                <option value="mythical" ${selectedRarity === 'mythical' ? 'selected' : ''}>💠 Thần thoại (Mythical - Giá 35k-54k)</option>
                <option value="rare" ${selectedRarity === 'rare' ? 'selected' : ''}>🔹 Hiếm (Rare - Giá 20k-34k)</option>
                <option value="common" ${selectedRarity === 'common' ? 'selected' : ''}>🥄 Phổ thông (Common - Bình dân)</option>
              </select>
            </div>
            <div class="portal-field portal-field--wide">
              <label for="admin-dish-img">Ảnh món ăn (URL hoặc Tải lên từ máy)</label>
              <input id="admin-dish-img" name="img" value="${escapeHTML(draftValues?.img ?? editingDish?.img ?? '')}" placeholder="https://..." />
              <input id="admin-dish-image-file" type="file" accept="image/*" />
              <span class="portal-message" id="image-upload-message" role="status"></span>
            </div>

            <!-- MỤC QUẢNG CÁO & ĐỐI TÁC -->
            <div class="portal-field portal-field--wide" style="background:#fffaf4;padding:1rem;border:1.5px dashed #f59e0b;border-radius:8px">
              <h3 style="font-size:0.95rem;color:#b45309;margin-bottom:0.75rem">📢 Cấu Hình Quảng Cáo & Nhà Tài Trợ (Sponsor Partnership)</h3>
              <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:0.75rem">
                <label class="admin-switch-label">
                  <input type="checkbox" name="isSponsored" id="admin-dish-sponsored" ${isEditingSponsored ? 'checked' : ''} />
                  <span>Kích hoạt Nhận Quảng Cáo (Ưu tiên ra món)</span>
                </label>
                <label class="admin-switch-label">
                  <input type="checkbox" name="isBestseller" id="admin-dish-bestseller" ${isEditingBestseller ? 'checked' : ''} />
                  <span>Gắn nhãn Món Bestseller (Bán chạy)</span>
                </label>
                <label class="admin-switch-label">
                  <input type="checkbox" name="active" id="admin-dish-active" ${isEditingActive ? 'checked' : ''} />
                  <span>Hiển thị trên website (Đang bán)</span>
                </label>
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:0.75rem;margin-top:0.75rem">
                <div>
                  <label style="font-size:0.78rem;font-weight:700;color:var(--text-sub)">Tên Quán Đối Tác / Nhà Tài Trợ</label>
                  <input name="sponsorName" value="${escapeHTML(draftValues?.sponsorName ?? editingDish?.sponsorName ?? '')}" placeholder="Ví dụ: Phở Thìn Lò Đúc" />
                </div>
                <div>
                  <label style="font-size:0.78rem;font-weight:700;color:var(--text-sub)">Huy Hiệu Hiển Thị</label>
                  <input name="sponsorBadge" value="${escapeHTML(draftValues?.sponsorBadge ?? editingDish?.sponsorBadge ?? 'Tài trợ')}" placeholder="Ví dụ: Deal 20%, Quán Vàng" />
                </div>
                <div style="grid-column:1/-1">
                  <label style="font-size:0.78rem;font-weight:700;color:var(--text-sub)">Đường Dẫn Đặt Món / Fanpage Đối Tác (Link chuyển hướng khi click)</label>
                  <input name="sponsorLink" value="${escapeHTML(draftValues?.sponsorLink ?? editingDish?.sponsorLink ?? '')}" placeholder="https://shopee.vn/..." />
                </div>
              </div>
            </div>

            <div class="portal-actions portal-field--wide">
              <button type="submit" class="portal-button portal-button--primary">${editingDish ? 'Lưu thay đổi món' : 'Thêm món vào hệ thống'}</button>
              ${editingDish ? '<button type="button" class="portal-button" id="admin-cancel-edit">Hủy sửa</button>' : ''}
            </div>
          </form>
        </section>

        <section class="portal-panel">
          <h2>Danh Sách Món Ăn (${filteredAdminDishes.length} / ${state.adminDishes.length})</h2>
          <div class="admin-filter-bar">
            <button type="button" class="admin-chip ${state.adminDishFilter === 'all' ? 'active' : ''}" data-admin-filter="all">Tất cả (${state.adminDishes.length})</button>
            <button type="button" class="admin-chip ${state.adminDishFilter === 'sponsored' ? 'active' : ''}" data-admin-filter="sponsored">📢 Đang tài trợ (${sponsoredCount})</button>
            <button type="button" class="admin-chip ${state.adminDishFilter === 'bestseller' ? 'active' : ''}" data-admin-filter="bestseller">⭐ Bestseller (${bestsellerCount})</button>
            <button type="button" class="admin-chip ${state.adminDishFilter === 'hidden' ? 'active' : ''}" data-admin-filter="hidden">👁️ Đang ẩn (${hiddenCount})</button>
          </div>
          <label class="portal-field" for="admin-dish-search">
            Tìm kiếm món theo tên
            <input id="admin-dish-search" type="search" value="${escapeHTML(state.adminDishSearch)}" placeholder="Nhập tên món cần tìm..." />
          </label>
          <div class="admin-pinned-note">
            📢 <strong>Lưu ý:</strong> Các món có cấu hình <em>Nhận quảng cáo & Nhà tài trợ</em> hoặc <em>Bestseller</em> luôn được tự động ghim hiển thị lên đầu danh sách để bạn dễ dàng quản lý và theo dõi!
          </div>
          <div class="portal-table-wrap">
            <table class="portal-table">
              <thead>
                <tr>
                  <th>Món Ăn</th>
                  <th>Danh Mục</th>
                  <th>Giá & Độ Hiếm</th>
                  <th>Trọng Số</th>
                  <th>Bật/Tắt Nhanh</th>
                  <th>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                ${filteredAdminDishes.map(dish => {
                  const rarity = rarityOf(dish);
                  return `
                  <tr data-admin-dish-row data-search="${escapeHTML(removeVietnameseTones(dish.name))}" class="${dish.isSponsored ? 'row-sponsored' : ''}">
                    <td>
                      <div class="portal-dish-cell">
                        ${dish.img ? `<img src="${escapeHTML(dish.img)}" alt="" loading="lazy" />` : ''}
                        <div>
                          <strong>${escapeHTML(dish.name)}</strong>
                          <div style="display:flex;gap:0.3rem;margin-top:0.2rem;flex-wrap:wrap">
                            ${dish.isSponsored ? `<span class="admin-badge badge-sponsored">📢 ${escapeHTML(dish.sponsorName || 'Tài trợ')}</span>` : ''}
                            ${dish.isBestseller ? `<span class="admin-badge badge-bestseller">⭐ Hot</span>` : ''}
                            ${dish.active === false ? `<span class="admin-badge badge-hidden">Ẩn</span>` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>${escapeHTML(getCategoryLabel(dish.category))}</td>
                    <td>
                      <div style="font-weight:700">${formatCurrency(dish.price)}</div>
                      <div style="margin-top:0.25rem">
                        <span class="admin-badge badge-rarity badge-rarity-${rarity.id}" title="Độ hiếm minigame: ${rarity.label}">
                          ${rarity.icon} ${rarity.label}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style="display:flex;align-items:center;gap:0.3rem">
                        <input type="number" step="0.5" min="0.1" max="50" style="width:60px;min-height:30px;padding:2px 4px" value="${dish.dropWeight || 1}" data-quick-weight="${dish.id}" title="Chỉnh trọng số rơi và Enter" />
                        <span style="font-size:0.75rem;color:var(--text-sub)">x</span>
                      </div>
                    </td>
                    <td>
                      <div style="display:flex;gap:0.3rem;flex-wrap:wrap">
                        <button type="button" class="admin-chip ${dish.isSponsored ? 'active' : ''}" data-quick-toggle="sponsored" data-id="${dish.id}" title="Bật/Tắt tài trợ">
                          ${dish.isSponsored ? '📢 Tài trợ: Bật' : '📢 Tắt'}
                        </button>
                        <button type="button" class="admin-chip ${dish.isBestseller ? 'active' : ''}" data-quick-toggle="bestseller" data-id="${dish.id}" title="Bật/Tắt Bestseller">
                          ${dish.isBestseller ? '⭐ Hot: Bật' : '⭐ Tắt'}
                        </button>
                        <button type="button" class="admin-chip ${dish.active !== false ? 'active' : ''}" data-quick-toggle="active" data-id="${dish.id}" title="Hiện hoặc ẩn món">
                          ${dish.active !== false ? '👁️ Hiện' : '👁️ Ẩn'}
                        </button>
                      </div>
                    </td>
                    <td>
                      <div class="portal-actions">
                        <button class="portal-button" type="button" data-view-dish="${dish.id}">Xem</button>
                        <button class="portal-button" type="button" data-edit-dish="${dish.id}">Sửa</button>
                        <button class="portal-button portal-button--danger" type="button" data-delete-dish="${dish.id}">Xóa</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
                <tr id="admin-dish-search-empty" hidden><td colspan="6" class="portal-empty">Không tìm thấy món phù hợp.</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      ` : ''}

      <!-- TAB 2: RULES & DROP RATE ENGINE -->
      ${state.adminTab === 'rules' ? `
        <section class="portal-panel">
          <h2>Điều Khiển Luật Chơi & Tỉ Lệ Xuất Hiện Món Ăn</h2>
          <p style="color:var(--text-sub);margin-bottom:1rem">
            Tùy biến xác suất rơi món của toàn bộ website trong thời gian thực. Giúp bạn nhận tài trợ, đẩy quảng cáo quán đối tác lên trang nhất và điều phối minigame mà không cần chạm vào code!
          </p>

          ${!canManageSettings ? `
            <div class="admin-ctv-notice">
              <span class="admin-ctv-notice-icon">🔒</span>
              <div>
                <strong>Chế độ Xem (Dành cho Cộng Tác Viên - CTV)</strong>
                <p>Chỉ có Admin gốc mới có quyền điều chỉnh luật chơi và tỉ lệ rơi món của hệ thống. Bạn đang xem với quyền Cộng tác viên (CTV).</p>
              </div>
            </div>
          ` : ''}

          <form id="admin-rules-form">
            <fieldset class="admin-readonly-fieldset" ${!canManageSettings ? 'disabled' : ''}>
            <div class="admin-rules-grid">
              <!-- KHỐI 1: TỈ LỆ QUẢNG CÁO & BESTSELLER -->
              <div class="admin-rule-card">
                <h3><span>📢</span> Hệ Số Nhân Món Tài Trợ & Bestseller</h3>
                <p class="admin-rule-desc">Món được gắn nhãn Tài trợ hoặc Bestseller sẽ được nhân xác suất lên theo hệ số này khi người dùng bốc món.</p>
                
                <div class="admin-control-group">
                  <div>
                    <label style="font-size:0.84rem;font-weight:700">Hệ số nhân Món Tài Trợ / Quảng Cáo: <strong id="lbl-sponsored-multiplier">${rules.sponsoredMultiplier}x</strong></label>
                    <div class="admin-slider-row">
                      <input type="range" name="sponsoredMultiplier" id="slider-sponsored-multiplier" min="1" max="20" step="1" value="${rules.sponsoredMultiplier}" ${!canManageSettings ? 'disabled' : ''} />
                      <span class="admin-slider-badge" id="badge-sponsored-multiplier">${rules.sponsoredMultiplier}x</span>
                    </div>
                  </div>

                  <div>
                    <label style="font-size:0.84rem;font-weight:700">Hệ số nhân Món Bestseller (Bán chạy): <strong id="lbl-bestseller-multiplier">${rules.bestsellerMultiplier}x</strong></label>
                    <div class="admin-slider-row">
                      <input type="range" name="bestsellerMultiplier" id="slider-bestseller-multiplier" min="1" max="10" step="1" value="${rules.bestsellerMultiplier}" ${!canManageSettings ? 'disabled' : ''} />
                      <span class="admin-slider-badge" id="badge-bestseller-multiplier">${rules.bestsellerMultiplier}x</span>
                    </div>
                  </div>

                  <div style="margin-top:0.5rem;padding:0.75rem;background:#fff8ee;border-radius:6px;border:1px solid #fed7aa">
                    <label class="admin-switch-label">
                      <input type="checkbox" name="guaranteeSponsored" ${rules.guaranteeSponsored ? 'checked' : ''} ${!canManageSettings ? 'disabled' : ''} />
                      <span>✨ Chế độ Ưu Tiên Tài Trợ Tuyệt Đối (Luôn ra ít nhất 1 món tài trợ trong quẻ/mâm cơm)</span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- KHỐI 2: LUẬT CÁC MINIGAME -->
              <div class="admin-rule-card">
                <h3><span>🎮</span> Cấu Hình Luật Minigame</h3>
                <p class="admin-rule-desc">Thiết lập tỉ lệ nổ món hiếm, món hot trong Bữa Cơm, Hòm Thính và Chiêm Tinh Tarot.</p>

                <div class="admin-control-group">
                  <div>
                    <label style="font-size:0.84rem;font-weight:700">Tỉ lệ ra món Cổ Đại (Meal Ancient): <strong id="lbl-ancient-rate">${rules.mealAncientRate}%</strong></label>
                    <div class="admin-slider-row">
                      <input type="range" name="mealAncientRate" id="slider-ancient-rate" min="1" max="30" step="1" value="${rules.mealAncientRate}" ${!canManageSettings ? 'disabled' : ''} />
                      <span class="admin-slider-badge" id="badge-ancient-rate">${rules.mealAncientRate}%</span>
                    </div>
                  </div>

                  <div>
                    <label style="font-size:0.84rem;font-weight:700">Tỉ lệ ra món Huyền Thoại (Meal Legendary): <strong id="lbl-legendary-rate">${rules.mealLegendaryRate}%</strong></label>
                    <div class="admin-slider-row">
                      <input type="range" name="mealLegendaryRate" id="slider-legendary-rate" min="5" max="50" step="1" value="${rules.mealLegendaryRate}" ${!canManageSettings ? 'disabled' : ''} />
                      <span class="admin-slider-badge" id="badge-legendary-rate">${rules.mealLegendaryRate}%</span>
                    </div>
                  </div>

                  <div>
                    <label style="font-size:0.84rem;font-weight:700">Tỉ lệ nổ món Hot trong Hòm Thính (Airdrop): <strong id="lbl-airdrop-rate">${rules.airdropHotRate}%</strong></label>
                    <div class="admin-slider-row">
                      <input type="range" name="airdropHotRate" id="slider-airdrop-rate" min="10" max="60" step="1" value="${rules.airdropHotRate}" ${!canManageSettings ? 'disabled' : ''} />
                      <span class="admin-slider-badge" id="badge-airdrop-rate">${rules.airdropHotRate}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </fieldset>

            <div class="portal-actions">
              <button type="submit" class="portal-button portal-button--primary" ${!canManageSettings ? 'disabled title="Chỉ Admin gốc mới có quyền lưu cấu hình luật chơi"' : ''}>💾 Lưu Cấu Hình Luật Chơi & Tỉ Lệ</button>
            </div>
          </form>

          <!-- BẢNG MÔ PHỎNG XÁC SUẤT TRỰC TIẾP -->
          <div style="margin-top:1.5rem">
            <h3>🎯 Bảng Mô Phỏng Xác Suất Xuất Hiện Món (Live Probability Simulator)</h3>
            <p style="font-size:0.8rem;color:var(--text-sub);margin-bottom:0.75rem">Tỉ lệ % cơ hội rơi thực tế của từng món dựa theo trọng số và hệ số nhân hiện hành:</p>
            <div class="portal-table-wrap">
              <table class="portal-table">
                <thead>
                  <tr>
                    <th>Món Ăn</th>
                    <th>Thuộc Tính</th>
                    <th>Trọng Số Tính Toán</th>
                    <th>Xác Suất Xuất Hiện (%)</th>
                  </tr>
                </thead>
                <tbody id="sim-prob-tbody">
                  ${simulatedDishes.map(d => `
                    <tr>
                      <td><strong>${escapeHTML(d.name)}</strong></td>
                      <td>
                        ${d.isSponsored ? '<span class="admin-badge badge-sponsored">📢 Tài trợ</span>' : ''}
                        ${d.isBestseller ? '<span class="admin-badge badge-bestseller">⭐ Hot</span>' : ''}
                        ${!d.isSponsored && !d.isBestseller ? '<span style="color:var(--text-sub);font-size:0.75rem">Thường</span>' : ''}
                      </td>
                      <td><strong>${d.calculatedWeight}</strong></td>
                      <td>
                        <div style="display:flex;align-items:center;gap:0.6rem">
                          <div class="admin-prob-meter" style="width:140px">
                            <div class="admin-prob-fill ${d.isSponsored ? 'is-sponsored' : ''}" style="width:${Math.min(100, Math.max(3, d.percentage * 4))}%"></div>
                          </div>
                          <strong>${d.percentage}%</strong>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ` : ''}

      <!-- TAB 3: USER DATA & ANALYTICS -->
      ${state.adminTab === 'analytics' ? `
        <!-- 4 GOLDEN KPI CARDS -->
        <div class="admin-kpi-grid">
          <div class="admin-kpi-card">
            <div class="admin-kpi-header">
              <span class="admin-kpi-label">Người Dùng Đăng Ký</span>
              <span class="admin-kpi-icon">👥</span>
            </div>
            <div class="admin-kpi-value">${stats?.userCount ?? state.adminUsers.length}</div>
            <span class="admin-kpi-note">Tài khoản quản lý trong hệ thống</span>
          </div>

          <div class="admin-kpi-card kpi-accent-purple">
            <div class="admin-kpi-header">
              <span class="admin-kpi-label">Click Link Tài Trợ (Ad Clicks)</span>
              <span class="admin-kpi-icon">📢</span>
            </div>
            <div class="admin-kpi-value">${analytics?.overview?.adClickCount ?? stats?.adClickCount ?? 0}</div>
            <span class="admin-kpi-note">Số lượt khách click vào quán đối tác</span>
          </div>

          <div class="admin-kpi-card kpi-accent-green">
            <div class="admin-kpi-header">
              <span class="admin-kpi-label">Lượt Chơi Minigame</span>
              <span class="admin-kpi-icon">🎲</span>
            </div>
            <div class="admin-kpi-value">${analytics?.overview?.gameRollCount ?? stats?.gameRollCount ?? 0}</div>
            <span class="admin-kpi-note">Lượt bốc mâm cơm, tarot & airdrop</span>
          </div>

          <div class="admin-kpi-card kpi-accent-blue">
            <div class="admin-kpi-header">
              <span class="admin-kpi-label">Tổng Lượt Xem Món</span>
              <span class="admin-kpi-icon">👁️</span>
            </div>
            <div class="admin-kpi-value">${stats?.historyCount ?? 0}</div>
            <span class="admin-kpi-note">Số lần mở chi tiết món ăn</span>
          </div>
        </div>

        <!-- BÁO CÁO CHIẾN DỊCH QUẢNG CÁO & ĐỐI TÁC -->
        <section class="portal-panel">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem">
            <h2>📢 Báo Cáo Hiệu Quả Quảng Cáo Đối Tác (Sponsor ROI & Conversion)</h2>
            <span style="font-size:0.8rem;color:var(--text-sub)">Dữ liệu thực tế gửi cho đối tác tài trợ</span>
          </div>
          ${(analytics?.sponsoredPerformance && analytics.sponsoredPerformance.length > 0) ? `
            <div class="portal-table-wrap">
              <table class="portal-table">
                <thead>
                  <tr>
                    <th>Món Ăn</th>
                    <th>Quán Đối Tác / Huy Hiệu</th>
                    <th>Lượt Xuất Hiện</th>
                    <th>Lượt Click Quán</th>
                    <th>Tỉ Lệ Chuyển Đổi CTR</th>
                    <th>Trọng Số</th>
                  </tr>
                </thead>
                <tbody>
                  ${analytics.sponsoredPerformance.map(p => `
                    <tr>
                      <td>
                        <div class="portal-dish-cell">
                          ${p.img ? `<img src="${escapeHTML(p.img)}" alt="" />` : ''}
                          <strong>${escapeHTML(p.name)}</strong>
                        </div>
                      </td>
                      <td>
                        <span class="admin-badge badge-sponsored">${escapeHTML(p.sponsorName)}</span>
                        ${p.sponsorLink ? `<a href="${escapeHTML(p.sponsorLink)}" target="_blank" rel="noopener noreferrer" style="margin-left:0.3rem;font-size:0.78rem">🔗 Link</a>` : ''}
                      </td>
                      <td><strong>${p.impressions}</strong> lần</td>
                      <td><strong style="color:var(--orange-dark);font-size:1.05rem">${p.clicks}</strong> clicks</td>
                      <td><span class="admin-badge badge-active">${p.ctr}</span></td>
                      <td>${p.dropWeight}x</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<p class="portal-empty">Chưa có món nào được bật chế độ Quảng Cáo hoặc chưa phát sinh lượt tương tác.</p>'}
        </section>

        <!-- THỊ HIẾU KHÁCH HÀNG & TỪ KHÓA TÌM KIẾM -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:1rem;margin-top:1rem">
          <section class="portal-panel">
            <h2>🔍 Nắm Bắt Nhu Cầu: Top Từ Khóa Khách Tìm Kiếm</h2>
            ${(analytics?.topSearches && analytics.topSearches.length > 0) ? `
              <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.5rem">
                ${analytics.topSearches.map(s => `
                  <span class="admin-chip active" style="font-size:0.85rem">
                    #${escapeHTML(s.query)} <strong style="margin-left:0.3rem;background:rgba(0,0,0,0.15);padding:1px 6px;border-radius:10px">${s.count}</strong>
                  </span>
                `).join('')}
              </div>
            ` : '<p class="portal-empty">Chưa có dữ liệu tìm kiếm.</p>'}
          </section>

          <section class="portal-panel">
            <h2>🎮 Phân Bổ Tương Tác Giữa Các Minigame</h2>
            <div style="display:grid;gap:0.6rem;margin-top:0.5rem">
              <div>
                <div style="display:flex;justify-content:space-between;font-size:0.82rem;font-weight:700">
                  <span>🍽️ Dựng Bữa Cơm:</span>
                  <strong>${analytics?.gameCounts?.meal ?? 0} lượt</strong>
                </div>
                <div class="portal-chart-track"><div class="portal-chart-bar" style="width:${Math.min(100, (analytics?.gameCounts?.meal ?? 0) * 10)}%"></div></div>
              </div>
              <div>
                <div style="display:flex;justify-content:space-between;font-size:0.82rem;font-weight:700">
                  <span>🔮 Chiêm Tinh Tarot Ẩm Thực:</span>
                  <strong>${analytics?.gameCounts?.arena_tarot ?? 0} lượt</strong>
                </div>
                <div class="portal-chart-track"><div class="portal-chart-bar" style="background:#8e44ad;width:${Math.min(100, (analytics?.gameCounts?.arena_tarot ?? 0) * 10)}%"></div></div>
              </div>
              <div>
                <div style="display:flex;justify-content:space-between;font-size:0.82rem;font-weight:700">
                  <span>🎁 Hòm Thính Tiếp Tế (Airdrop):</span>
                  <strong>${analytics?.gameCounts?.airdrop ?? 0} lượt</strong>
                </div>
                <div class="portal-chart-track"><div class="portal-chart-bar" style="background:#27ae60;width:${Math.min(100, (analytics?.gameCounts?.airdrop ?? 0) * 10)}%"></div></div>
              </div>
              <div>
                <div style="display:flex;justify-content:space-between;font-size:0.82rem;font-weight:700">
                  <span>🎲 BỤP! Ăn Gì Trang Chủ:</span>
                  <strong>${analytics?.gameCounts?.home_bup ?? 0} lượt</strong>
                </div>
                <div class="portal-chart-track"><div class="portal-chart-bar" style="background:#e67e22;width:${Math.min(100, (analytics?.gameCounts?.home_bup ?? 0) * 10)}%"></div></div>
              </div>
            </div>
          </section>
        </div>

        <!-- HỒ SƠ NGƯỜI DÙNG: NẮM BẮT TÂM LÝ & SỞ THÍCH -->
        <section class="portal-panel" style="margin-top:1rem">
          <h2>👤 Nắm Bắt Dữ Liệu Khách Hàng (User Profiles & Behavior)</h2>
          <p style="font-size:0.8rem;color:var(--text-sub);margin-bottom:0.75rem">Xem từng người dùng yêu thích món gì, số lần xem và hoạt động gần nhất:</p>
          <div class="portal-table-wrap">
            <table class="portal-table">
              <thead>
                <tr>
                  <th>Khách Hàng</th>
                  <th>Email</th>
                  <th>Món Yêu Thích Đã Lưu (Gu)</th>
                  <th>Tương Tác</th>
                  <th>Lần Cuối Hoạt Động</th>
                </tr>
              </thead>
              <tbody>
                ${(analytics?.userInsights || []).map(u => {
                  const uRole = getUserRoleInfo(u);
                  return `
                  <tr>
                    <td><strong>${escapeHTML(u.name)}</strong> <span class="admin-badge ${uRole.badgeClass}" style="font-size:0.75rem;padding:2px 6px">${uRole.icon} ${uRole.title}</span></td>
                    <td>${escapeHTML(u.email)}</td>
                    <td>
                      <div>
                        <strong>${u.favoriteCount} món</strong>
                        <div class="admin-user-detail-row">
                          ${u.favoriteDishes.map(dishName => `<span class="admin-pill-tag">❤️ ${escapeHTML(dishName)}</span>`).join('')}
                        </div>
                      </div>
                    </td>
                    <td>${u.viewCount} xem • ${u.eventCount} thao tác</td>
                    <td>
                      <span style="font-size:0.8rem;color:var(--text-sub)">
                        ${u.lastActive ? new Date(u.lastActive).toLocaleString('vi-VN') : '—'}
                      </span>
                    </td>
                  </tr>
                `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </section>

        <!-- NHẬT KÝ SỰ KIỆN TRỰC TIẾP -->
        <section class="portal-panel" style="margin-top:1rem">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem">
            <h2>⚡ Nhật Ký Hoạt Động Thời Gian Thực (Live Activity Feed)</h2>
            <button type="button" class="portal-button portal-button--danger" id="admin-clear-analytics" style="min-height:32px;padding:0.25rem 0.65rem;font-size:0.78rem">🗑️ Xóa Lịch Sử Sự Kiện</button>
          </div>
          <div class="admin-feed-list">
            ${(analytics?.recentEvents && analytics.recentEvents.length > 0) ? analytics.recentEvents.map(e => {
              let icon = '⚡';
              let text = '';
              if (e.type === 'ad_click') {
                icon = '📢';
                text = `<strong>${escapeHTML(e.userName)}</strong> đã CLICK quảng cáo đối tác: <em>${escapeHTML(e.details?.sponsorName || e.details?.dishName || 'Quán đối tác')}</em>`;
              } else if (e.type === 'game_roll') {
                icon = '🎲';
                text = `<strong>${escapeHTML(e.userName)}</strong> vừa quay minigame <em>[${escapeHTML(e.details?.game || 'game')}]</em> ra món <em>${escapeHTML(e.details?.dishName || (e.details?.dishes?.map(d => d.name).join(', ')) || 'món ăn')}</em>`;
              } else if (e.type === 'dish_view') {
                icon = '👁️';
                text = `<strong>${escapeHTML(e.userName)}</strong> đã xem chi tiết món: <em>${escapeHTML(e.details?.dishName || 'món ăn')}</em>`;
              } else if (e.type === 'search') {
                icon = '🔍';
                text = `<strong>${escapeHTML(e.userName)}</strong> vừa tìm kiếm: "<em>${escapeHTML(e.details?.query || '')}</em>"`;
              } else {
                icon = '✨';
                text = `<strong>${escapeHTML(e.userName)}</strong> thực hiện thao tác: ${escapeHTML(e.type)}`;
              }
              return `
                <div class="admin-feed-item">
                  <div class="admin-feed-main">
                    <span class="admin-feed-icon">${icon}</span>
                    <span class="admin-feed-text">${text}</span>
                  </div>
                  <span class="admin-feed-time">${new Date(e.timestamp).toLocaleTimeString('vi-VN')}</span>
                </div>
              `;
            }).join('') : '<p class="portal-empty">Chưa có nhật ký hoạt động nào gần đây.</p>'}
          </div>
        </section>
      ` : ''}

      <!-- TAB 4: WEB SETTINGS & CMS -->
      ${state.adminTab === 'settings' ? `
        <section class="portal-panel">
          <h2>Tùy Chỉnh Toàn Bộ Giao Diện & Bật/Tắt Tính Năng (Dynamic CMS)</h2>
          <p style="color:var(--text-sub);margin-bottom:1.25rem">
            Mọi thiết lập ở đây sẽ lập tức có hiệu lực trên toàn bộ website người dùng mà không cần sửa code hay triển khai lại!
          </p>

          ${isCurrentCtv ? `
            <div class="admin-ctv-notice" style="margin-bottom:1.25rem;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:0.85rem 1rem;display:flex;align-items:flex-start;gap:0.75rem">
              <span class="admin-ctv-notice-icon" style="font-size:1.4rem">🛡️</span>
              <div>
                <strong style="color:#1e40af;font-size:0.95rem">Quyền Hạn Cộng Tác Viên (CTV)</strong>
                <p style="margin:0.25rem 0 0 0;font-size:0.83rem;color:#1e3a8a">Bạn có quyền nhập và chỉnh sửa toàn bộ nội dung văn bản (Tiêu đề, Mô tả, Đường dẫn liên kết, URL ảnh, Lời nhắn bảo trì...). Các nút gạt bật/tắt (bảo trì, tính năng, thông báo, banner) bị khóa và chỉ dành riêng cho Admin Gốc.</p>
              </div>
            </div>
          ` : ''}

          <form id="admin-settings-form">
            <fieldset style="border:0;padding:0;margin:0">
            <!-- PHẦN 1: BẬT TẮT CHỨC NĂNG -->
            <h3 style="margin-bottom:0.6rem">🧩 Bật / Tắt Các Chức Năng (Feature Flags)</h3>
            <p style="font-size:0.83rem;color:var(--text-sub);margin-bottom:0.85rem">
              Bạn có thể bật hoặc tắt riêng từng tính năng của website. Khi bật <strong>Chế độ bảo trì toàn hệ thống</strong>, toàn bộ các tính năng người dùng sẽ tự động tạm ngưng để đảm bảo an toàn.
            </p>

            <!-- KHỐI CHẾ ĐỘ BẢO TRÌ ĐỘC LẬP -->
            <div class="admin-maintenance-card ${features.maintenanceMode ? 'is-active' : ''}">
              <label class="admin-switch-label" style="font-size:0.95rem;font-weight:800;color:#991b1b">
                <input type="checkbox" name="feat_maintenanceMode" id="admin-maintenance-toggle" ${features.maintenanceMode ? 'checked' : ''} ${!canManageSettings ? 'disabled title="Chỉ Admin Gốc mới có quyền bật/tắt chế độ bảo trì"' : ''} />
                <span>⚠️ Chế Độ Bảo Trì Toàn Hệ Thống (Tạm ngưng phục vụ khách hàng)</span>
              </label>
              <div id="maintenance-lock-notice" class="maintenance-lock-notice ${features.maintenanceMode ? '' : 'hidden'}">
                🔒 <strong>Đang bật bảo trì:</strong> Toàn bộ 5 tính năng bên dưới tạm thời bị khóa vì website đang ngưng phục vụ khách hàng thông thường. Khi bạn tắt chế độ bảo trì, các tính năng sẽ mở lại bình thường.
              </div>
              <div class="portal-field" style="margin-top:0.75rem">
                <label for="admin-maintenance-notice" style="font-size:0.8rem;color:#7f1d1d;font-weight:700">Lời nhắn khi bảo trì (hiển thị cho khách hàng):</label>
                <input id="admin-maintenance-notice" name="feat_maintenanceNotice" value="${escapeHTML(features.maintenanceNotice || 'Hệ thống đang bảo trì ít phút để nâng cấp các món ăn mới.')}" style="background:#fff" placeholder="Nhập thông báo khi bảo trì..." />
              </div>
            </div>

            <!-- LƯỚI 5 CHỨC NĂNG CON -->
            <div class="admin-flags-grid ${features.maintenanceMode ? 'is-maintenance-locked' : ''}" id="admin-subfeatures-grid" style="margin-bottom:1.5rem">
              <label class="admin-flag-item ${features.maintenanceMode ? 'is-locked-by-maintenance' : ''}">
                <input type="checkbox" name="feat_mealEnabled" class="feature-sub-checkbox" ${features.mealEnabled !== false ? 'checked' : ''} ${!canManageSettings || features.maintenanceMode ? 'disabled title="Chỉ Admin Gốc mới có quyền bật/tắt tính năng"' : ''} />
                <div class="admin-flag-content">
                  <div class="admin-flag-title">🍽️ Dựng Mâm Cơm 4 Món (Meal Builder)</div>
                  <div class="admin-flag-desc">Cho phép khách bốc mâm cơm tự động theo sở thích và giá tiền.</div>
                </div>
              </label>

              <label class="admin-flag-item ${features.maintenanceMode ? 'is-locked-by-maintenance' : ''}">
                <input type="checkbox" name="feat_arenaEnabled" class="feature-sub-checkbox" ${features.arenaEnabled !== false ? 'checked' : ''} ${!canManageSettings || features.maintenanceMode ? 'disabled title="Chỉ Admin Gốc mới có quyền bật/tắt tính năng"' : ''} />
                <div class="admin-flag-content">
                  <div class="admin-flag-title">🔮 Chiêm Tinh Tarot Ẩm Thực (Culinary Arena)</div>
                  <div class="admin-flag-desc">Bốc quẻ bài Tarot 3D thần bí chọn món ăn định mệnh.</div>
                </div>
              </label>

              <label class="admin-flag-item ${features.maintenanceMode ? 'is-locked-by-maintenance' : ''}">
                <input type="checkbox" name="feat_airdropEnabled" class="feature-sub-checkbox" ${features.airdropEnabled !== false ? 'checked' : ''} ${!canManageSettings || features.maintenanceMode ? 'disabled title="Chỉ Admin Gốc mới có quyền bật/tắt tính năng"' : ''} />
                <div class="admin-flag-content">
                  <div class="admin-flag-title">🎁 Hòm Thính Cứu Đói (Airdrop)</div>
                  <div class="admin-flag-desc">Thả hòm thính dù rơi gợi ý món ngẫu nhiên sống động.</div>
                </div>
              </label>

              <label class="admin-flag-item ${features.maintenanceMode ? 'is-locked-by-maintenance' : ''}">
                <input type="checkbox" name="feat_quizEnabled" class="feature-sub-checkbox" ${features.quizEnabled !== false ? 'checked' : ''} ${!canManageSettings || features.maintenanceMode ? 'disabled title="Chỉ Admin Gốc mới có quyền bật/tắt tính năng"' : ''} />
                <div class="admin-flag-content">
                  <div class="admin-flag-title">🤔 Trắc Nghiệm Hôm Nay Ăn Gì (Quiz)</div>
                  <div class="admin-flag-desc">Bộ câu hỏi trắc nghiệm tâm lý ẩm thực nhanh.</div>
                </div>
              </label>

              <label class="admin-flag-item ${features.maintenanceMode ? 'is-locked-by-maintenance' : ''}">
                <input type="checkbox" name="feat_nearbyEnabled" class="feature-sub-checkbox" ${features.nearbyEnabled !== false ? 'checked' : ''} ${!canManageSettings || features.maintenanceMode ? 'disabled title="Chỉ Admin Gốc mới có quyền bật/tắt tính năng"' : ''} />
                <div class="admin-flag-content">
                  <div class="admin-flag-title">📍 Bản Đồ Quán Ăn Gần Đây (Nearby Places)</div>
                  <div class="admin-flag-desc">Tìm quán ăn bán món đã chọn quanh vị trí người dùng.</div>
                </div>
              </label>
            </div>

            <hr style="border:0;border-top:1px solid var(--border);margin:1.5rem 0" />

            <!-- PHẦN 2: THÔNG BÁO NỔI BẬT KHI VÀO TRANG & THANH BANNER -->
            <h3 style="margin-bottom:0.6rem">📢 Thông Báo Nổi Bật Khi Vào Trang & Thanh Banner (Announcement)</h3>
            <div style="background:#fefbf6;padding:1rem;border:1px solid #fed7aa;border-radius:8px;margin-bottom:1.5rem">
              <div style="margin-bottom:0.75rem">
                <label class="admin-switch-label">
                  <input type="checkbox" name="ann_enabled" ${announcement.enabled ? 'checked' : ''} ${!canManageSettings ? 'disabled title="Chỉ Admin Gốc mới có quyền bật/tắt thông báo"' : ''} />
                  <span>Kích hoạt hiển thị thông báo nổi bật ngay khi khách vào trang web</span>
                </label>
              </div>
              <div class="portal-form-grid">
                <div class="portal-field">
                  <label for="admin-ann-title">Tiêu đề thông báo nổi (Pop-up):</label>
                  <input id="admin-ann-title" name="ann_title" value="${escapeHTML(announcement.title || 'Ưu Đãi Đặc Biệt Từ BungOiAnGi ✨')}" placeholder="Ví dụ: Ưu Đãi Đặc Biệt Hôm Nay..." />
                </div>
                <div class="portal-field">
                  <label for="admin-ann-type">Kiểu thông báo:</label>
                  <select id="admin-ann-type" name="ann_type">
                    <option value="promo" ${announcement.type === 'promo' ? 'selected' : ''}>🎁 Khuyến mãi / Ưu đãi (Màu đỏ cam nổi bật)</option>
                    <option value="info" ${announcement.type === 'info' ? 'selected' : ''}>ℹ️ Tin tức / Thông tin (Xanh dương)</option>
                    <option value="alert" ${announcement.type === 'alert' ? 'selected' : ''}>⚠️ Cảnh báo / Khẩn cấp (Đỏ đậm)</option>
                  </select>
                </div>
                <div class="portal-field portal-field--wide">
                  <label for="admin-ann-text">Nội dung chi tiết thông báo:</label>
                  <input id="admin-ann-text" name="ann_text" value="${escapeHTML(announcement.text || '')}" placeholder="Ví dụ: Nhập mã BUNGOIANGI giảm 30k..." />
                </div>
                <div class="portal-field portal-field--wide">
                  <label for="admin-ann-link">Đường dẫn liên kết nhận quà / ưu đãi (tùy chọn):</label>
                  <input id="admin-ann-link" name="ann_link" value="${escapeHTML(announcement.link || '')}" placeholder="https://..." />
                </div>
              </div>
            </div>

            <!-- PHẦN 3: BANNER QUẢNG CÁO ĐỐI TÁC TRANG CHỦ -->
            <h3 style="margin-bottom:0.6rem">🌟 Banner Quảng Cáo Tài TrỢ Trang Chủ (Hero Sponsor Banner)</h3>
            <div style="background:#fffaf4;padding:1rem;border:1px solid #fdba74;border-radius:8px;margin-bottom:1.5rem">
              <div style="margin-bottom:0.75rem">
                <label class="admin-switch-label">
                  <input type="checkbox" name="ads_bannerEnabled" ${ads.bannerEnabled ? 'checked' : ''} ${!canManageSettings ? 'disabled title="Chỉ Admin Gốc mới có quyền bật/tắt banner quảng cáo"' : ''} />
                  <span>Kích hoạt Banner quảng cáo đối tác nổi bật trang chủ</span>
                </label>
              </div>
              <div class="portal-form-grid">
                <div class="portal-field">
                  <label for="admin-ads-title">Tiêu đề Banner:</label>
                  <input id="admin-ads-title" name="ads_title" value="${escapeHTML(ads.title || '')}" placeholder="Ví dụ: Cơm Tấm Sườn Bì Chả Đặc Biệt" />
                </div>
                <div class="portal-field">
                  <label for="admin-ads-badge">Huy hiệu:</label>
                  <input id="admin-ads-badge" name="ads_badge" value="${escapeHTML(ads.badge || 'TÀI TRỢ HOT')}" placeholder="TÀI TRỢ HOT" />
                </div>
                <div class="portal-field portal-field--wide">
                  <label for="admin-ads-sub">Phụ đề mô tả ưu đãi:</label>
                  <input id="admin-ads-sub" name="ads_subtitle" value="${escapeHTML(ads.subtitle || '')}" placeholder="Giảm 20% cho đơn hàng đầu tiên hôm nay..." />
                </div>
                <div class="portal-field">
                  <label for="admin-ads-img">URL Ảnh Banner:</label>
                  <input id="admin-ads-img" name="ads_img" value="${escapeHTML(ads.img || '')}" placeholder="https://..." />
                </div>
                <div class="portal-field">
                  <label for="admin-ads-link">Link liên kết đối tác:</label>
                  <input id="admin-ads-link" name="ads_link" value="${escapeHTML(ads.link || '')}" placeholder="https://shopee.vn/..." />
                </div>
              </div>
            </div>
            </fieldset>

            <div class="portal-actions">
              <button type="submit" class="portal-button portal-button--primary">💾 Lưu Cấu Hình Hệ Thống & CMS</button>
            </div>
          </form>
        </section>
      ` : ''}

      <!-- TAB 5: USERS -->
      ${state.adminTab === 'users' ? `
        <section class="portal-panel">
          <h2>Tạo tài khoản người dùng mới</h2>
          ${isCurrentPrimaryRoot ? `
            <div class="admin-ctv-notice" style="margin-bottom:1rem;background:#fefce8;border:1px solid #fef08a;border-radius:8px;padding:0.75rem 1rem;display:flex;align-items:center;gap:0.75rem">
              <span style="font-size:1.4rem">👑</span>
              <div>
                <strong style="color:#854d0e">Quyền Admin Gốc Chính (Toàn quyền cao nhất)</strong>
                <p style="margin:0;font-size:0.83rem;color:#713f12">Bạn có toàn quyền tạo tài khoản <strong>Khách hàng</strong>, <strong>Cộng tác viên (CTV)</strong> và <strong>Admin Gốc Phụ</strong>.</p>
              </div>
            </div>
          ` : isCurrentSubRoot ? `
            <div class="admin-ctv-notice" style="margin-bottom:1rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:0.75rem 1rem;display:flex;align-items:center;gap:0.75rem">
              <span style="font-size:1.4rem">⭐</span>
              <div>
                <strong style="color:#166534">Quyền Admin Gốc Phụ</strong>
                <p style="margin:0;font-size:0.83rem;color:#14532d">Bạn có quyền tạo tài khoản <strong>Khách hàng</strong> và <strong>Cộng tác viên (CTV)</strong>. Chỉ có Admin Gốc Chính mới có quyền tạo thêm Admin Gốc Phụ.</p>
              </div>
            </div>
          ` : `
            <div class="admin-ctv-notice" style="margin-bottom:1rem;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:0.75rem 1rem;display:flex;align-items:center;gap:0.75rem">
              <span style="font-size:1.4rem">🛡️</span>
              <div>
                <strong style="color:#1e40af">Quyền Cộng Tác Viên (CTV)</strong>
                <p style="margin:0;font-size:0.83rem;color:#1e3a8a">Bạn có quyền tạo tài khoản <strong>Khách hàng</strong> mới trên hệ thống. Quyền tạo CTV và Admin do Quản trị viên cấp trên đảm nhận.</p>
              </div>
            </div>
          `}
          <form id="admin-user-form" class="portal-form-grid">
            <div class="portal-field"><label for="admin-user-name">Họ và tên</label><input id="admin-user-name" name="name" required minlength="2" placeholder="Ví dụ: Nguyễn Văn A" /></div>
            <div class="portal-field"><label for="admin-user-email">Email</label><input id="admin-user-email" name="email" type="email" required placeholder="user@gmail.com" /></div>
            <div class="portal-field"><label for="admin-user-password">Mật khẩu</label><input id="admin-user-password" name="password" type="password" required minlength="8" placeholder="Tối thiểu 8 ký tự" /></div>
            <div class="portal-field">
              <label for="admin-user-role">Vai trò</label>
              ${isCurrentPrimaryRoot ? `
                <select id="admin-user-role" name="role">
                  <option value="customer">👤 Khách hàng</option>
                  <option value="ctv">🛡️ Cộng tác viên (CTV)</option>
                  <option value="sub_root">⭐ Admin Gốc Phụ (Toàn quyền dưới Gốc Chính)</option>
                </select>
              ` : isCurrentSubRoot ? `
                <select id="admin-user-role" name="role">
                  <option value="customer">👤 Khách hàng</option>
                  <option value="ctv">🛡️ Cộng tác viên (CTV)</option>
                </select>
              ` : `
                <select id="admin-user-role" name="role" disabled class="admin-locked-input">
                  <option value="customer" selected>👤 Khách hàng (Mặc định)</option>
                </select>
                <input type="hidden" name="role" value="customer" />
              `}
            </div>
            <div class="portal-actions portal-field--wide">
              <button class="portal-button portal-button--primary" type="submit">Tạo tài khoản</button>
            </div>
          </form>
        </section>
        <section class="portal-panel">
          <h2>Danh sách người dùng (${state.adminUsers.length})</h2>
          <div class="portal-table-wrap">
            <table class="portal-table">
              <thead><tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
              <tbody>
                ${state.adminUsers.map(userItem => {
                  const currentAuth = getAuthSession()?.user;
                  const isCurrentAuthUser = String(userItem.id) === String(currentAuth?.id);
                  const itemRole = getUserRoleInfo(userItem);
                  const isTargetPrimary = itemRole.level === 'primary_root';
                  const isTargetSub = itemRole.level === 'sub_root';
                  const isTargetCtv = itemRole.level === 'ctv';
                  const isTargetCustomer = itemRole.level === 'customer';
                  const isBanned = Boolean(userItem.isBanned || userItem.status === 'banned');

                  // Phân quyền tương tác với từng dòng:
                  const canChangeRole = !isTargetPrimary && !isCurrentAuthUser && (
                    isCurrentPrimaryRoot || (isCurrentSubRoot && !isTargetSub)
                  );

                  const canToggleBan = !isTargetPrimary && !isCurrentAuthUser && (
                    isCurrentPrimaryRoot ||
                    (isCurrentSubRoot && !isTargetSub) ||
                    (!isTargetPrimary && !isTargetSub && !isTargetCtv)
                  );

                  const canDelete = !isTargetPrimary && !isCurrentAuthUser && (
                    isCurrentPrimaryRoot ||
                    (isCurrentSubRoot && !isTargetSub) ||
                    (!isTargetPrimary && !isTargetSub && !isTargetCtv)
                  );

                  return `
                    <tr class="${isTargetPrimary ? 'row-root-admin' : isTargetSub ? 'row-sub-root-admin' : isBanned ? 'row-banned-user' : ''}">
                      <td>
                        <input type="text" value="${escapeHTML(userItem.name || '')}" minlength="2" aria-label="Họ tên của ${escapeHTML(userItem.email)}" data-user-name="${userItem.id}" />
                        ${isTargetPrimary ? '<div style="font-size:0.75rem;color:#b45309;font-weight:750;margin-top:3px">👑 Admin Gốc Chính (Bảo vệ tối cao)</div>' : ''}
                        ${isTargetSub ? '<div style="font-size:0.75rem;color:#c2410c;font-weight:750;margin-top:3px">⭐ Admin Gốc Phụ (Dưới Gốc Chính)</div>' : ''}
                        ${isTargetCtv ? '<div style="font-size:0.75rem;color:#4338ca;font-weight:750;margin-top:3px">🛡️ Cộng tác viên (CTV)</div>' : ''}
                        ${isCurrentAuthUser ? '<div style="font-size:0.75rem;color:var(--text-sub);margin-top:2px">(Tài khoản bạn đang dùng)</div>' : ''}
                      </td>
                      <td>${escapeHTML(userItem.email)}</td>
                      <td>
                        ${isTargetPrimary ? `
                          <span class="admin-badge badge-root" style="font-size:0.8rem;padding:3px 8px">👑 Admin Gốc Chính</span>
                        ` : isCurrentAuthUser ? `
                          <span class="admin-badge ${itemRole.badgeClass}" style="font-size:0.8rem;padding:3px 8px">
                            ${itemRole.icon} ${itemRole.title} (Bạn)
                          </span>
                        ` : canChangeRole ? `
                          <select aria-label="Vai trò của ${escapeHTML(userItem.email)}" data-user-role="${userItem.id}">
                            <option value="customer" ${isTargetCustomer ? 'selected' : ''}>👤 Khách hàng</option>
                            <option value="ctv" ${isTargetCtv ? 'selected' : ''}>🛡️ CTV</option>
                            ${isCurrentPrimaryRoot ? `<option value="sub_root" ${isTargetSub ? 'selected' : ''}>⭐ Admin Gốc Phụ</option>` : ''}
                          </select>
                        ` : `
                          <span class="admin-badge ${itemRole.badgeClass}" style="font-size:0.8rem;padding:3px 8px">
                            ${itemRole.icon} ${itemRole.title}
                          </span>
                        `}
                      </td>
                      <td>
                        ${isBanned ? `
                          <span class="admin-badge badge-hidden" style="background:#fee2e2;color:#991b1b;border:1px solid #f87171">🔒 Đã vô hiệu hóa</span>
                        ` : `
                          <span class="admin-badge badge-active">🟢 Hoạt động</span>
                        `}
                      </td>
                      <td>
                        <div class="portal-actions">
                          <button class="portal-button" type="button" data-save-user-name="${userItem.id}">Lưu</button>
                          
                          <!-- Nút Vô hiệu hóa / Mở khóa -->
                          ${canToggleBan ? `
                            ${isBanned ? `
                              <button class="portal-button portal-button--success" type="button" data-toggle-user-ban="${userItem.id}" data-action="unban" title="Mở khóa tài khoản">Mở khóa</button>
                            ` : `
                              <button class="portal-button portal-button--warning" type="button" data-toggle-user-ban="${userItem.id}" data-action="ban" title="Khóa tài khoản không cho đăng nhập">Vô hiệu hóa</button>
                            `}
                          ` : ''}

                          <!-- Nút Xóa -->
                          ${canDelete ? `
                            <button class="portal-button portal-button--danger" type="button" data-delete-user="${userItem.id}" title="Xóa tài khoản vĩnh viễn">Xóa</button>
                          ` : ''}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </section>
      ` : ''}

      <!-- TAB 6: VOUCHERS MANAGEMENT -->
      ${state.adminTab === 'vouchers' ? `
        <!-- Form Tạo / Sửa Voucher -->
        <section class="portal-panel">
          <h2>${editingVoucher ? `Sửa Voucher: ${escapeHTML(editingVoucher.code)}` : 'Tạo Voucher Giảm Giá & Mã Khuyến Mãi Mới'}</h2>
          <p style="color:var(--text-sub);margin-bottom:1rem">
            Thiết lập mã code, mức giảm (tiền mặt VNĐ hoặc %), giá trị đơn tối thiểu, số lượt dùng tối đa và hạn sử dụng để thu hút khách hàng!
          </p>

          <form id="admin-voucher-form" class="portal-form-grid">
            <div class="portal-field">
              <label for="admin-voucher-code">Mã Voucher (Code) *</label>
              <input id="admin-voucher-code" name="code" value="${escapeHTML(voucherDraftValues?.code ?? editingVoucher?.code ?? '')}" required minlength="3" maxlength="20" placeholder="Ví dụ: BUNGNEW30, GIAM20K..." style="text-transform:uppercase;font-family:monospace;font-weight:700" />
            </div>

            <div class="portal-field">
              <label for="admin-voucher-title">Tiêu đề ưu đãi *</label>
              <input id="admin-voucher-title" name="title" value="${escapeHTML(voucherDraftValues?.title ?? editingVoucher?.title ?? '')}" required minlength="2" placeholder="Ví dụ: Giảm 30k Cho Đơn Đầu Tiên" />
            </div>

            <div class="portal-field portal-field--wide">
              <label for="admin-voucher-desc">Mô tả & Điều kiện áp dụng</label>
              <textarea id="admin-voucher-desc" name="desc" placeholder="Chi tiết điều kiện, món áp dụng hoặc lưu ý khi dùng mã...">${escapeHTML(voucherDraftValues?.desc ?? editingVoucher?.desc ?? '')}</textarea>
            </div>

            <div class="portal-field">
              <label for="admin-voucher-type">Loại giảm giá *</label>
              <select id="admin-voucher-type" name="discountType">
                <option value="fixed" ${voucherSelectedType !== 'percent' ? 'selected' : ''}>💵 Giảm tiền mặt cố định (VNĐ)</option>
                <option value="percent" ${voucherSelectedType === 'percent' ? 'selected' : ''}>⚡ Giảm theo phần trăm (%)</option>
              </select>
            </div>

            <div class="portal-field">
              <label for="admin-voucher-val">Mức giảm *</label>
              <input id="admin-voucher-val" name="discountValue" type="number" min="1" value="${voucherDraftValues?.discountValue ?? editingVoucher?.discountValue ?? 30000}" required placeholder="Ví dụ: 30000 (nếu VNĐ) hoặc 20 (nếu %)" />
            </div>

            <div class="portal-field">
              <label for="admin-voucher-min">Đơn hàng tối thiểu (VNĐ)</label>
              <input id="admin-voucher-min" name="minOrder" type="number" min="0" step="1000" value="${voucherDraftValues?.minOrder ?? editingVoucher?.minOrder ?? 60000}" placeholder="Ví dụ: 60000" />
            </div>

            <div class="portal-field">
              <label for="admin-voucher-max">Mức giảm tối đa (VNĐ)</label>
              <input id="admin-voucher-max" name="maxDiscount" type="number" min="0" step="1000" value="${voucherDraftValues?.maxDiscount ?? editingVoucher?.maxDiscount ?? 30000}" placeholder="Áp dụng khi chọn giảm theo %" />
            </div>

            <div class="portal-field">
              <label for="admin-voucher-limit">Giới hạn số lượt dùng tối đa</label>
              <input id="admin-voucher-limit" name="usageLimit" type="number" min="1" value="${voucherDraftValues?.usageLimit ?? editingVoucher?.usageLimit ?? 100}" placeholder="Ví dụ: 100" />
            </div>

            <div class="portal-field">
              <label for="admin-voucher-expiry">Hạn sử dụng (HSD)</label>
              <input id="admin-voucher-expiry" name="expiryDate" type="date" value="${voucherDraftValues?.expiryDate ?? editingVoucher?.expiryDate ?? new Date(Date.now() + 30*86400000).toISOString().split('T')[0]}" required />
            </div>

            <div class="portal-field">
              <label for="admin-voucher-badge">Huy hiệu hiển thị</label>
              <input id="admin-voucher-badge" name="badge" value="${escapeHTML(voucherDraftValues?.badge ?? editingVoucher?.badge ?? '🎉 Bạn Mới')}" placeholder="Ví dụ: 🎉 Bạn Mới, 🛵 Freeship, 🔥 Hot Deal, 💎 VIP" />
            </div>

            <div class="portal-field">
              <label for="admin-voucher-cat">Áp dụng cho</label>
              <select id="admin-voucher-cat" name="category">
                <option value="all" ${voucherSelectedCategory === 'all' ? 'selected' : ''}>Mọi món ăn</option>
                <option value="ancient" ${voucherSelectedCategory === 'ancient' ? 'selected' : ''}>💎 Món Cổ Đại (>100k)</option>
                <option value="legendary" ${voucherSelectedCategory === 'legendary' ? 'selected' : ''}>🔶 Món Huyền Thoại (55k-99k)</option>
                <option value="mon-nuoc" ${voucherSelectedCategory === 'mon-nuoc' ? 'selected' : ''}>🍜 Món Nước</option>
                <option value="com" ${voucherSelectedCategory === 'com' ? 'selected' : ''}>🍚 Cơm</option>
                <option value="an-vat" ${voucherSelectedCategory === 'an-vat' ? 'selected' : ''}>🧋 Ăn Vặt & Tráng Miệng</option>
              </select>
            </div>

            <div class="portal-field portal-field--wide">
              <label class="admin-switch-label">
                <input type="checkbox" name="active" ${isEditingVoucherActive ? 'checked' : ''} />
                <span>Kích hoạt phát hành ngay cho khách hàng thu thập và sử dụng</span>
              </label>
            </div>

            <div class="portal-actions portal-field--wide">
              <button type="submit" class="portal-button portal-button--primary">
                ${editingVoucher ? '💾 Lưu Thay Đổi Voucher' : '＋ Tạo & Phát Hành Voucher Mới'}
              </button>
              ${editingVoucher ? '<button type="button" class="portal-button" id="admin-cancel-voucher-edit">Hủy sửa</button>' : ''}
            </div>
          </form>
        </section>

        <!-- Thống Kê & Bảng Danh Sách Voucher -->
        <section class="portal-panel">
          <div class="admin-voucher-summary">
            <div class="admin-voucher-metric">
              <span>Tổng số voucher</span>
              <strong>${state.adminVouchers.length}</strong>
            </div>
            <div class="admin-voucher-metric">
              <span>Đang phát hành</span>
              <strong style="color:#059669">${state.adminVouchers.filter(v => v.active !== false).length}</strong>
            </div>
            <div class="admin-voucher-metric">
              <span>Tổng lượt thu thập / dùng</span>
              <strong style="color:var(--orange-dark)">${state.adminVouchers.reduce((acc, v) => acc + (Number(v.usedCount) || 0), 0)}</strong>
            </div>
          </div>

          <h2>Danh Sách Mã Voucher & Ưu Đãi (${state.adminVouchers.length})</h2>
          <div class="portal-table-wrap">
            <table class="portal-table">
              <thead>
                <tr>
                  <th>Mã Code & Huy hiệu</th>
                  <th>Tiêu đề & Điều kiện</th>
                  <th>Mức Giảm</th>
                  <th>Lượt Dùng</th>
                  <th>Hạn Dùng</th>
                  <th>Trạng Thái</th>
                  <th>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                ${state.adminVouchers.length > 0 ? state.adminVouchers.map(v => {
                  const used = Number(v.usedCount || 0);
                  const limit = Number(v.usageLimit || 100);
                  const isPercent = v.discountType === 'percent';
                  const isExpired = v.expiryDate && new Date(v.expiryDate + 'T23:59:59') < new Date();
                  const isActive = v.active !== false && !isExpired;

                  return `
                    <tr>
                      <td>
                        <span class="admin-code-badge">${escapeHTML(v.code)}</span>
                        <div style="margin-top:0.25rem">
                          <span class="voucher-badge" style="font-size:0.7rem">${escapeHTML(v.badge || 'Ưu đãi')}</span>
                        </div>
                      </td>
                      <td>
                        <strong>${escapeHTML(v.title)}</strong>
                        <div style="font-size:0.75rem;color:var(--text-sub);margin-top:0.15rem">
                          ${escapeHTML(v.desc || '—')}
                        </div>
                      </td>
                      <td>
                        <strong style="color:${isPercent ? '#7c3aed' : 'var(--orange-dark)'};font-size:1.05rem">
                          ${isPercent ? `${v.discountValue}%` : formatCurrency(v.discountValue)}
                        </strong>
                        <div style="font-size:0.72rem;color:var(--text-sub)">
                          Đơn tối thiểu: ${v.minOrder ? formatCurrency(v.minOrder) : '0đ'}
                        </div>
                      </td>
                      <td>
                        <strong>${used}</strong> / ${limit}
                        <div style="font-size:0.72rem;color:var(--text-muted)">
                          (${Math.min(100, Math.round((used/limit)*100))}%)
                        </div>
                      </td>
                      <td>
                        <span style="font-size:0.82rem;font-weight:600;${isExpired ? 'color:#ef4444' : ''}">
                          ${escapeHTML(v.expiryDate || '—')}
                        </span>
                        ${isExpired ? '<div style="font-size:0.7rem;color:#ef4444;font-weight:700">Đã hết hạn</div>' : ''}
                      </td>
                      <td>
                        <button type="button" class="admin-chip ${isActive ? 'active' : ''}" data-toggle-voucher-active="${v.id}" title="Bấm để bật hoặc tắt voucher">
                          ${isActive ? '🟢 Phát hành' : '⚪ Tạm ngưng'}
                        </button>
                      </td>
                      <td>
                        <div class="portal-actions">
                          <button class="portal-button" type="button" data-edit-voucher="${v.id}">Sửa</button>
                          <button class="portal-button portal-button--danger" type="button" data-delete-voucher="${v.id}">Xóa</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('') : '<tr><td colspan="7" class="portal-empty">Chưa có voucher nào được tạo. Hãy bấm "Tạo voucher mới" ở form trên!</td></tr>'}
              </tbody>
            </table>
          </div>
        </section>
      ` : ''}

    </section>
  `;
}

// ============================================================
// 1. TRANG CHỦ (HOME PAGE)
// ============================================================
function renderHome() {
  const moodButtons = Object.values(MOODS).map(m => `
    <button class="mood-btn ${state.mood === m.id ? 'active' : ''}" data-mood="${m.id}" id="mood-${m.id}">
      <span class="m-emoji">${m.emoji}</span>
      <span class="m-label">${m.label}</span>
    </button>`).join('');

  const budgetButtons = BUDGETS.map(b => `
    <button class="budget-btn ${state.budget === b.id ? 'active' : ''}" data-budget="${b.id}" id="budget-${b.id}">
      <span class="b-label">${b.label}</span>
      ${b.sublabel ? `<span class="b-sub">${b.sublabel}</span>` : ''}
    </button>`).join('');

  return `
    <section class="hero-section">
      <div class="hero-box">
        <div class="hero-stickers">
          <span class="sticker">🍜</span>
          <span class="sticker">🔥</span>
          <span class="sticker">🥢</span>
          <span class="sticker">🌶️</span>
        </div>
        <h1 class="hero-title">HÔM NAY<br>ĂN GÌ?</h1>
        <p class="hero-tagline">"Để BungOiAnGi quyết định!"</p>
        <button class="bup-btn" id="bup-btn">
          <span class="btn-icon">🎲</span>
          BỤP! ĂN GÌ
        </button>
      </div>

      <div>
        <p class="section-label">Bạn đang cảm thấy...</p>
        <div class="mood-grid" id="mood-grid">${moodButtons}</div>
        <p class="section-label">Ngân sách hôm nay?</p>
        <div class="budget-row" id="budget-row">${budgetButtons}</div>
      </div>
    </section>
    ${renderHeroAdsBanner()}

    <div class="container">
      <div class="section-header">
        <h2>🔥 Món được chọn nhiều</h2>
        <span class="section-badge" id="popular-count">${getFilteredPopular().length} món</span>
      </div>
      <div class="dishes-grid" id="popular-grid">
        ${renderDishCards(getFilteredPopular())}
      </div>

      <div class="section-header" style="margin-top:2.5rem">
        <h2>🍜 Khám phá món mới</h2>
        <span class="section-badge" id="new-count">${getFilteredNew().length} món</span>
      </div>
      <div class="dishes-grid" id="new-grid">
        ${renderDishCards(getFilteredNew())}
      </div>
    </div>`;
}

function getFilteredPopular() {
  const filtered = filterDishes(dishes, { moodId: state.mood, budgetId: state.budget });
  const pool = filtered.filter(d => d.popular || d.isSponsored || d.isBestseller);
  return pool.sort((a, b) => {
    // 1. Món tài trợ (Sponsored) luôn lên hàng đầu
    if (Boolean(b.isSponsored) !== Boolean(a.isSponsored)) return b.isSponsored ? 1 : -1;
    // 2. Món Bestseller (Hot) lên tiếp theo
    if (Boolean(b.isBestseller) !== Boolean(a.isBestseller)) return b.isBestseller ? 1 : -1;
    // 3. Trọng số rơi
    const weightDiff = (b.dropWeight || 1) - (a.dropWeight || 1);
    if (weightDiff !== 0) return weightDiff;
    return Number(b.id) - Number(a.id);
  });
}
function getFilteredNew() {
  return filterDishes(dishes, { moodId: state.mood, budgetId: state.budget }).filter(d => !d.popular && !d.isSponsored).slice(0, 8);
}

// ============================================================
// 2. TRANG KHÁM PHÁ (EXPLORE PAGE)
// ============================================================
function renderExplore() {
  const catBtns = CATEGORIES.map(c =>
    `<button class="cat-btn ${c.id === 'all' ? 'active' : ''}" data-cat="${c.id}" id="cat-${c.id}">${c.label}</button>`
  ).join('');

  return `
    <div class="explore-header">
      <div class="explore-header-inner">
        <div class="explore-title-wrap">
          <h1>🔍 Khám Phá Món Ăn</h1>
          <span class="explore-subtitle">${dishes.length} món đặc sắc</span>
        </div>
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input class="search-input" type="text" id="explore-search" placeholder="Tìm tên món hoặc mô tả..." />
        </div>
      </div>
    </div>

    <div class="explore-toolbar">
      <div class="explore-toolbar-inner">
        <div class="cat-scroll-wrap">
          <div class="category-tabs" id="cat-tabs">${catBtns}</div>
        </div>
        <div class="toolbar-divider"></div>
        <div class="diet-toggle-wrap">
          <button class="diet-toggle active" data-diet="all" id="diet-all">Tất cả</button>
          <button class="diet-toggle" data-diet="man" id="diet-man">🍖 Mặn</button>
          <button class="diet-toggle" data-diet="chay" id="diet-chay">🥗 Chay</button>
        </div>
        <div class="toolbar-divider"></div>
        <div class="sort-wrap">
          <span class="sort-label">↕️</span>
          <select id="explore-sort" class="sort-select">
            <option value="default">Mặc định</option>
            <option value="price-asc">Giá ↑</option>
            <option value="price-desc">Giá ↓</option>
            <option value="rating">⭐ Rating</option>
            <option value="calo">🔥 Calories</option>
          </select>
        </div>
      </div>
    </div>

    <div class="explore-grid-wrap">
      <p class="explore-count" id="explore-count">${dishes.length} món</p>
      <div class="dishes-grid" id="explore-grid">
        ${renderDishCards(dishes)}
      </div>
    </div>`;
}

// ============================================================
// 3. TRANG QUIZ "HÔM NAY ĂN GÌ?"
// ============================================================
function renderQuiz() {
  const steps = QUIZ_QUESTIONS.map((q, i) => `
    <div class="quiz-step ${i === 0 ? '' : 'hidden'}" data-step="${i}" id="quiz-step-${i}">
      <p class="quiz-q">${q.q}</p>
      <div class="quiz-options">
        ${q.opts.map(o => `
          <button class="quiz-opt" data-key="${q.key}" data-val="${o.value}" id="qopt-${q.key}-${o.value}">
            <span class="opt-icon">${o.icon}</span> ${o.label}
          </button>`).join('')}
      </div>
    </div>`).join('');

  const dots = QUIZ_QUESTIONS.map((_, i) => `<div class="quiz-dot ${i === 0 ? 'active' : ''}" id="quiz-dot-${i}"></div>`).join('');

  return `
    <div class="quiz-wrap">
      <div class="quiz-header">
        <h1>🤔 Hôm Nay Ăn Gì?</h1>
        <p>Trả lời 3 câu hỏi ngắn để nhận gợi ý món chuẩn khẩu vị!</p>
      </div>
      <div class="quiz-progress" id="quiz-progress">${dots}</div>
      ${steps}
      <div class="quiz-result hidden" id="quiz-result">
        <div class="quiz-result-dish" id="quiz-result-dish"></div>
        <div id="quiz-nearby-panel"></div>
        <div style="display:flex;gap:.75rem;margin-top:1rem">
          <button class="btn-primary" id="quiz-restart-btn">🔄 Thử lại</button>
          <button class="btn-secondary" id="quiz-save-btn">❤️ Lưu vào Gu</button>
        </div>
      </div>
    </div>`;
}

function resolveQuizResult() {
  const mood = resolveQuizMood(state.quizAnswers);
  return getRandomDish(dishes, mood, 'all') || dishes[Math.floor(Math.random() * dishes.length)];
}

function showQuizResult(dish) {
  for (let i = 0; i < QUIZ_QUESTIONS.length; i++) {
    document.getElementById(`quiz-step-${i}`)?.classList.add('hidden');
  }
  const result = document.getElementById('quiz-result');
  const dishEl = document.getElementById('quiz-result-dish');
  dishEl.innerHTML = `
    <img src="${dish.img}" alt="${dish.name}" style="width:100%;height:200px;object-fit:cover;border-radius:12px;margin-bottom:1rem" />
    <div class="quiz-result-name">${dish.name}</div>
    <div class="quiz-result-desc">${dish.desc}</div>
    <div class="dish-meta" style="justify-content:center;margin-bottom:.5rem">
      <span>⭐ ${dish.rating}</span> <span>🔥 ${dish.calo} kcal</span>
      <span>💰 ${formatCurrency(dish.price)}</span>
    </div>`;
  renderNearbyPanel(dish, document.getElementById('quiz-nearby-panel'));
  result.classList.remove('hidden');
  playWin();
  burst(window.innerWidth / 2, window.innerHeight / 2, 60);

  document.getElementById('quiz-save-btn').onclick = () => {
    toggleFav(dish.id);
    updateFavBadge();
    document.getElementById('quiz-save-btn').textContent = '✅ Đã lưu!';
  };
  document.getElementById('quiz-restart-btn').onclick = () => resetQuiz();
}

function resetQuiz() {
  state.quizAnswers = {};
  state.quizStep = 0;
  state.quizAdvancing = false;
  document.getElementById('quiz-result')?.classList.add('hidden');
  QUIZ_QUESTIONS.forEach((_, i) => {
    const step = document.getElementById(`quiz-step-${i}`);
    if (step) {
      step.classList.toggle('hidden', i !== 0);
      step.querySelectorAll('.quiz-opt').forEach(b => {
        b.disabled = false;
        b.classList.remove('selected');
      });
    }
  });
  updateQuizDots();
}

function updateQuizDots() {
  QUIZ_QUESTIONS.forEach((_, i) => {
    const dot = document.getElementById(`quiz-dot-${i}`);
    if (!dot) return;
    dot.className = 'quiz-dot';
    if (i < state.quizStep) dot.classList.add('done');
    else if (i === state.quizStep) dot.classList.add('active');
  });
}

// ============================================================
// 4. TRANG GU CỦA TÔI (FAVORITES PAGE)
// ============================================================
function renderFavs() {
  const favDishes = dishes.filter(d => state.favorites.includes(d.id));
  return `
    <div class="fav-page-header">
      <h1>❤️ Gu Của Tôi</h1>
      <p>Những món ăn bạn đã yêu thích và lưu lại</p>
    </div>
    <div class="container">
      ${favDishes.length === 0 ? `
        <div class="fav-empty">
          <div class="fe-icon">❤️</div>
          <p>Bạn chưa lưu món nào.<br>Bấm ❤️ trên món ăn để thêm vào đây!</p>
        </div>` : `
        <div style="margin-top:1.5rem"></div>
        <div class="dishes-grid">${renderDishCards(favDishes)}</div>`}
    </div>`;
}

// ============================================================
// DISH CARDS & MODAL
// ============================================================
function renderDishCards(list) {
  if (!list.length) return `
    <div class="empty-state" style="grid-column:1/-1">
      <div class="es-icon">🍽️</div>
      <p>Không tìm thấy món phù hợp.<br>Thử chọn tâm trạng/ngân sách khác nhé!</p>
    </div>`;
  return list.map(d => {
    const saved = state.favorites.includes(d.id);
    const catLabel = getCategoryLabel(d.category);
    const rarity = rarityOf(d);
    return `
      <div class="dish-card ${d.isSponsored ? 'is-sponsored' : ''} ${d.isBestseller ? 'is-bestseller' : ''}" data-dish="${d.id}" id="dish-card-${d.id}">
        <div class="card-img-wrap">
          <img class="dish-img" src="${d.img}" alt="${d.name}" loading="lazy" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80';" />
          <div class="dish-card-badges">
            <span class="dish-rarity-badge badge-${rarity.id}" title="Độ hiếm minigame: ${rarity.label}">${rarity.icon} ${rarity.label}</span>
            ${d.isSponsored ? `<span class="dish-sponsor-badge">📢 ${escapeHTML(d.sponsorBadge || 'Tài trợ')}</span>` : ''}
            ${d.isBestseller ? `<span class="dish-bestseller-badge">⭐ Hot</span>` : ''}
          </div>
          <button class="dish-fav-btn ${saved ? 'saved' : ''}" data-fav="${d.id}" id="fav-${d.id}" aria-label="Lưu vào Gu">
            ${saved ? '❤️' : '🤍'}
          </button>
          <span class="dish-type-badge ${d.type === 'chay' ? 'chay' : 'man'}">
            ${d.type === 'chay' ? '🥗 Chay' : '🍖 Mặn'}
          </span>
          <span class="dish-price-badge">${formatCurrency(d.price)}</span>
        </div>
        <div class="dish-info">
          <div class="dish-header-row">
            <span class="dish-cat-pill">${catLabel}</span>
            <span class="dish-rating">⭐ ${d.rating}</span>
          </div>
          <h3 class="dish-name">${d.name}</h3>
          <p class="dish-desc">${d.desc}</p>
          <div class="dish-meta">
            <span>🔥 ${d.calo} kcal</span>
            <span>⏱️ ${d.time}</span>
          </div>
          ${d.sponsorLink ? `
            <a href="${escapeHTML(d.sponsorLink)}" target="_blank" rel="noopener noreferrer" class="dish-sponsor-btn" data-sponsor-click="${d.id}" data-sponsor-name="${escapeHTML(d.sponsorName || d.name)}" onclick="event.stopPropagation()">
              🔗 ${escapeHTML(d.sponsorName ? `Ghé ${d.sponsorName}` : 'Đặt món ưu đãi')}
            </a>` : ''}
        </div>
      </div>`;
  }).join('');
}

function renderModal() {
  return `
    <div class="modal-overlay" id="dish-modal" role="dialog" aria-modal="true">
      <div class="modal" id="modal-box">
        <img id="modal-img" src="" alt="" class="modal-img" />
        <div class="modal-body">
          <div class="modal-name" id="modal-name"></div>
          <div class="modal-badges" id="modal-badges"></div>
          <div id="modal-sponsor-container"></div>
          <div class="modal-desc" id="modal-desc"></div>
          <div class="modal-facts" id="modal-facts"></div>
          <div class="modal-reason" id="modal-reason"></div>
          <div id="modal-voucher-section"></div>
          <div id="modal-nearby-panel"></div>
          <div class="modal-actions">
            <button class="btn-secondary" id="modal-change-btn">🔄 Đổi món khác</button>
            <button class="btn-primary" id="modal-save-btn">❤️ Lưu vào Gu</button>
          </div>
        </div>
      </div>
    </div>`;
}

function renderModalVoucherSection(dish) {
  const container = document.getElementById('modal-voucher-section');
  if (!container || !dish) return;

  const dishPrice = Number(dish.price) || 0;
  let activeCode = (state.activeVoucherCode || getActiveVoucherCode() || '').trim().toUpperCase();

  const allVouchers = state.vouchers?.length ? state.vouchers : getLocalVouchers();
  const matchedVoucher = activeCode ? allVouchers.find(v => v.code.toUpperCase() === activeCode) : null;
  const calcResult = matchedVoucher ? calculateVoucherDiscount(matchedVoucher, dishPrice) : null;

  const claimedIds = new Set(state.claimedVoucherIds?.length ? state.claimedVoucherIds : getLocalClaimedVoucherIds());
  const availableVouchers = allVouchers.filter(v => v.active !== false).slice(0, 6);

  container.innerHTML = `
    <div class="modal-voucher-box">
      <div class="mv-header">
        <span class="mv-title">🎟️ Ưu Đãi & Mã Giảm Giá</span>
        <a href="#vouchers" class="mv-link-wallet" id="mv-open-wallet-btn">Xem kho voucher ➔</a>
      </div>

      <div class="mv-input-row">
        <div class="mv-input-wrapper">
          <input
            type="text"
            id="modal-voucher-input"
            class="mv-input"
            placeholder="Nhập mã ưu đãi (VD: BUNGNEW30)..."
            value="${escapeHTML(activeCode)}"
            autocomplete="off"
            spellcheck="false"
          />
          ${activeCode ? `<button type="button" id="modal-voucher-clear-btn" class="mv-clear-btn" title="Gỡ mã">✕</button>` : ''}
        </div>
        <button type="button" id="modal-voucher-apply-btn" class="mv-apply-btn">
          ${calcResult?.isValid ? '✓ Đang áp dụng' : 'Áp Dụng'}
        </button>
      </div>

      ${availableVouchers.length > 0 ? `
        <div class="mv-quick-list">
          <span class="mv-quick-label">Gợi ý:</span>
          ${availableVouchers.map(v => {
            const isCurrent = activeCode === v.code.toUpperCase();
            const badge = v.discountType === 'percent' ? `-${v.discountValue}%` : `-${formatCurrency(v.discountValue)}`;
            const isMine = claimedIds.has(Number(v.id));
            return `
              <button
                type="button"
                class="mv-quick-chip ${isCurrent ? 'is-active' : ''}"
                data-quick-voucher="${escapeHTML(v.code)}"
                title="${escapeHTML(v.title)} (Đơn tối thiểu ${formatCurrency(v.minOrder)})"
              >
                ${isMine ? '⭐ ' : ''}${escapeHTML(v.code)} (${badge})
              </button>
            `;
          }).join('')}
        </div>
      ` : ''}

      <div id="modal-voucher-result" class="mv-result">
        ${calcResult ? `
          <div class="mv-result-card ${calcResult.isValid ? 'mv-result-card--success' : 'mv-result-card--error'}">
            <div class="mv-result-top">
              <span class="mv-result-badge">
                ${calcResult.isValid ? `🎉 ${escapeHTML(matchedVoucher.title || matchedVoucher.code)}` : '⚠️ Chưa đủ điều kiện'}
              </span>
              <button type="button" id="modal-voucher-remove-btn" class="mv-result-remove">Gỡ mã</button>
            </div>
            ${calcResult.isValid ? `
              <div class="mv-result-prices">
                <span class="mv-price-orig">${formatCurrency(dishPrice)}</span>
                <span class="mv-price-discount">Giảm ${formatCurrency(calcResult.discount)}</span>
                <span class="mv-price-final">👉 ${formatCurrency(calcResult.finalPrice)}</span>
              </div>
            ` : ''}
            <div class="mv-result-msg">${escapeHTML(calcResult.message)}</div>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  const inputEl = document.getElementById('modal-voucher-input');
  const applyBtn = document.getElementById('modal-voucher-apply-btn');
  const clearBtn = document.getElementById('modal-voucher-clear-btn');
  const removeBtn = document.getElementById('modal-voucher-remove-btn');
  const walletBtn = document.getElementById('mv-open-wallet-btn');

  const doApply = (codeToApply) => {
    const code = String(codeToApply || inputEl?.value || '').trim().toUpperCase();
    if (!code) {
      state.activeVoucherCode = '';
      clearActiveVoucherCode();
      renderModalVoucherSection(dish);
      return;
    }
    const found = allVouchers.find(v => v.code.toUpperCase() === code);
    if (!found) {
      showVoucherToast(`Mã "${code}" không tồn tại hoặc đã ngưng phát hành!`, 'error');
      state.activeVoucherCode = code;
      setActiveVoucherCode(code);
      renderModalVoucherSection(dish);
      return;
    }
    const res = calculateVoucherDiscount(found, dishPrice);
    state.activeVoucherCode = code;
    setActiveVoucherCode(code);
    playClick();
    if (res.isValid) {
      playWin();
      showVoucherToast(`🎉 Đã áp dụng mã "${code}" giảm ${formatCurrency(res.discount)}!`, 'success');
    } else {
      showVoucherToast(res.message, 'error');
    }
    renderModalVoucherSection(dish);
  };

  applyBtn?.addEventListener('click', () => doApply());
  inputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doApply();
    }
  });

  clearBtn?.addEventListener('click', () => {
    state.activeVoucherCode = '';
    clearActiveVoucherCode();
    renderModalVoucherSection(dish);
  });

  removeBtn?.addEventListener('click', () => {
    state.activeVoucherCode = '';
    clearActiveVoucherCode();
    showVoucherToast('Đã gỡ mã ưu đãi.', 'info');
    renderModalVoucherSection(dish);
  });

  container.querySelectorAll('[data-quick-voucher]').forEach(chip => {
    chip.addEventListener('click', () => {
      const code = chip.dataset.quickVoucher;
      if (inputEl) inputEl.value = code;
      doApply(code);
    });
  });

  walletBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal();
    navigateTo('vouchers');
  });
}

function openModal(dish, onRoll) {
  if (!dish) return;
  trackAnalyticsEvent('dish_view', {
    dishId: Number(dish.id),
    dishName: dish.name,
    isSponsored: Boolean(dish.isSponsored),
    isBestseller: Boolean(dish.isBestseller),
  });
  if (isAuthenticated() && getAuthSession()?.user?.role === 'customer') {
    requestApi('/api/customer/history', { method: 'POST', body: { dishId: Number(dish.id) } }).catch(() => { });
  }
  const overlay = document.getElementById('dish-modal');
  document.getElementById('modal-img').src = dish.img;
  document.getElementById('modal-name').textContent = dish.name;
  document.getElementById('modal-desc').textContent = dish.desc;

  const modalBadges = document.getElementById('modal-badges');
  if (modalBadges) {
    const rarity = rarityOf(dish);
    const catLabel = getCategoryLabel(dish.category);
    modalBadges.innerHTML = `
      <span class="modal-badge-cat">🍽️ ${escapeHTML(catLabel)}</span>
      <span class="modal-badge-type ${dish.type === 'chay' ? 'chay' : 'man'}">${dish.type === 'chay' ? '🥗 Chay' : '🍖 Mặn'}</span>
      <span class="dish-rarity-badge badge-${rarity.id}">${rarity.icon} ${escapeHTML(rarity.label)}</span>
      ${dish.isSponsored ? `<span class="dish-sponsor-badge">📢 ${escapeHTML(dish.sponsorBadge || 'Tài trợ')}</span>` : ''}
      ${dish.isBestseller ? `<span class="dish-bestseller-badge">⭐ Hot</span>` : ''}
    `;
  }

  const sponsorContainer = document.getElementById('modal-sponsor-container');
  if (sponsorContainer) {
    if (dish.isSponsored) {
      sponsorContainer.innerHTML = `
        <div class="modal-sponsor-card">
          <div class="msc-badge">📢 ${escapeHTML(dish.sponsorBadge || 'Món Được Tài Trợ')}</div>
          <div class="msc-title">${escapeHTML(dish.sponsorName || 'Đối tác của BungOiAnGi')}</div>
          <p class="msc-sub">Món ngon nổi bật được đề xuất từ quán ăn đối tác của BungOiAnGi.</p>
          ${dish.sponsorLink ? `<a href="${escapeHTML(dish.sponsorLink)}" target="_blank" rel="noopener noreferrer" class="btn-sponsor-cta" data-sponsor-click="${dish.id}" data-sponsor-name="${escapeHTML(dish.sponsorName || dish.name)}">🚀 Ghé Quán Đặt Món Ngay</a>` : ''}
        </div>
      `;
    } else {
      sponsorContainer.innerHTML = '';
    }
  }

  document.getElementById('modal-facts').innerHTML = `
    <div class="modal-fact"><span class="mf-value">${formatCurrency(dish.price)}</span><span class="mf-key">Giá</span></div>
    <div class="modal-fact"><span class="mf-value">${dish.calo}</span><span class="mf-key">Kcal</span></div>
    <div class="modal-fact"><span class="mf-value">${dish.time}</span><span class="mf-key">Chờ</span></div>
    <div class="modal-fact"><span class="mf-value">⭐ ${dish.rating}</span><span class="mf-key">Đánh giá</span></div>
  `;
  document.getElementById('modal-reason').textContent = `✅ Lý do nên ăn: ${dish.desc.split('–')[0].trim()}`;
  renderModalVoucherSection(dish);
  renderNearbyPanel(dish);

  const saveBtn = document.getElementById('modal-save-btn');
  const saved = state.favorites.includes(dish.id);
  saveBtn.textContent = saved ? '✅ Đã lưu' : '❤️ Lưu vào Gu';
  saveBtn.onclick = () => { toggleFav(dish.id); renderApp(); };

  const changeBtn = document.getElementById('modal-change-btn');
  if (onRoll) {
    changeBtn.style.display = '';
    changeBtn.onclick = () => {
      playBup();
      const newDish = getRandomDish(dishes, state.mood, state.budget);
      openModal(newDish, onRoll);
    };
  } else {
    changeBtn.style.display = 'none';
  }

  overlay.classList.add('open');
}

function closeModal() {
  document.getElementById('dish-modal')?.classList.remove('open');
  closeDishDetail();
  document.body.classList.remove('modal-open');
}

let nearbyPanelSequence = 0;

function renderNearbyPanel(dish, panel = document.getElementById('modal-nearby-panel'), options = {}) {
  if (!panel) return;
  const { showMap = true } = options;
  const panelId = `nearby-panel-${++nearbyPanelSequence}`;
  const ids = {
    radius: `${panelId}-radius`,
    locate: `${panelId}-locate`,
    status: `${panelId}-status`,
    help: `${panelId}-help`,
    map: `${panelId}-map`,
    results: `${panelId}-results`
  };

  panel.innerHTML = `
    <section class="nearby-panel" aria-label="Tìm quán ăn gần đây">
      <div class="nearby-title-row">
        <div>
          <h3>Quán bán ${escapeHTML(dish.name)} gần bạn</h3>
          <p class="nearby-caption">Chỉ hiện quán có thông tin về món này trên bản đồ</p>
        </div>
        <label class="nearby-radius-label" for="${ids.radius}">Bán kính
          <select id="${ids.radius}" aria-label="Bán kính tìm quán">
            <option value="1">1 km</option>
            <option value="3">3 km</option>
            <option value="5" selected>5 km</option>
            <option value="10">10 km</option>
          </select>
        </label>
      </div>
      <button type="button" class="nearby-locate-btn" id="${ids.locate}">
        <span aria-hidden="true">◎</span> Tìm quán ${escapeHTML(dish.name)} gần tôi
      </button>
      <div class="nearby-location-row">
        <p class="nearby-status" id="${ids.status}" role="status" aria-live="polite">
          Vị trí chưa được cấp quyền. Cho phép GPS để xem quán gần nhất.
        </p>
        <button type="button" class="nearby-help-btn" id="${panelId}-help-button" aria-expanded="false" aria-controls="${ids.help}">Cách bật</button>
      </div>
      <p class="nearby-help-text" id="${ids.help}" hidden>Trong Chrome/Edge, mở biểu tượng điều khiển trang cạnh thanh địa chỉ → Quyền vị trí → Cho phép; trên điện thoại, bật Location/GPS và cấp quyền cho trình duyệt. Trang triển khai cần HTTPS.</p>
      ${showMap ? `<div class="nearby-map" id="${ids.map}" aria-label="Bản đồ quán ăn gần đây">
        <div class="nearby-map-placeholder">Bản đồ sẽ hiện sau khi xác định vị trí</div>
      </div>` : ''}
      <div class="nearby-results" id="${ids.results}"></div>
      <div class="service-search">
        <div class="service-buttons" aria-label="Mở dịch vụ tìm món">
          <button type="button" class="service-button service-button--maps" data-service="maps"><span aria-hidden="true">📍</span> Google Maps</button>
          <button type="button" class="service-button service-button--grab" data-service="grab"><span class="service-wordmark">GrabFood</span></button>
          <button type="button" class="service-button service-button--shopee" data-service="shopee"><span class="service-wordmark">ShopeeFood</span></button>
        </div>
      </div>
    </section>`;

  const status = panel.querySelector(`#${ids.status}`);
  const mapElement = panel.querySelector(`#${ids.map}`);
  const resultsElement = panel.querySelector(`#${ids.results}`);
  let currentLocation = null;
  let selectedPlace = null;

  panel.querySelector(`#${panelId}-help-button`)?.addEventListener('click', event => {
    const help = panel.querySelector(`#${ids.help}`);
    help.hidden = !help.hidden;
    event.currentTarget.setAttribute('aria-expanded', String(!help.hidden));
  });

  function renderResults(places) {
    if (!panel.isConnected) return;
    const currentRadius = Number(panel.querySelector(`#${ids.radius}`)?.value || 5);
    const mapsSearchUrl = currentLocation
      ? `https://www.google.com/maps/search/${encodeURIComponent(dish.name + ' gần đây')}/@${currentLocation.lat},${currentLocation.lng},15z`
      : `https://www.google.com/maps/search/${encodeURIComponent(dish.name + ' gần đây')}`;

    const googleLiveHeader = `
      <div class="nearby-google-live-bar">
        <a class="nearby-google-live-btn" href="${mapsSearchUrl}" target="_blank" rel="noopener noreferrer">
          <span class="nearby-google-live-icon">🗺️</span>
          <div class="nearby-google-live-info">
            <span class="nearby-google-live-title">Tìm “${escapeHTML(dish.name)}” trực tiếp trên Google Maps (Bán kính ${currentRadius} km) ↗</span>
            <span class="nearby-google-live-sub">Xem vị trí GPS vệ tinh, hình ảnh thực tế & hàng trăm đánh giá mới nhất</span>
          </div>
        </a>
      </div>`;

    if (places.length === 0) {
      status.textContent = `Đã kết nối Google Maps quét các quán bán “${dish.name}” quanh vị trí của bạn:`;
      resultsElement.innerHTML = `
        <div class="nearby-not-found-card">
          <div class="nearby-not-found-icon">📍🗺️</div>
          <h4 class="nearby-not-found-title">Bản đồ Google Maps trực tiếp: “${escapeHTML(dish.name)} gần đây”</h4>
          <p class="nearby-not-found-desc">Khung bản đồ vệ tinh Google Maps trực tiếp bên dưới đang quét các quán có bán món này quanh tọa độ GPS của bạn. Bạn có thể thu phóng và bấm vào từng ghim đỏ để xem chi tiết quán:</p>
          <div class="nearby-live-map-wrap">
            <iframe class="nearby-live-iframe" title="Google Maps tìm kiếm quán" src="https://maps.google.com/maps?hl=vi&q=${encodeURIComponent(dish.name + ' gần đây')}${currentLocation ? `&ll=${currentLocation.lat},${currentLocation.lng}` : ''}&z=14&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
          </div>
          <div class="nearby-not-found-hint">
            💡 <strong>Mẹo:</strong> Bạn có thể xem quán trên bản đồ trên, hoặc bấm mở toàn màn hình trong ứng dụng Google Maps / ShopeeFood để đặt ship tận nơi:
          </div>
          <div class="nearby-not-found-actions">
            <a class="nearby-action-btn maps" href="${mapsSearchUrl}" target="_blank" rel="noopener noreferrer">
              🗺️ Mở Google Maps quét toàn khu vực ↗
            </a>
            <a class="nearby-action-btn shopee" href="${serviceSearchUrl('shopee', dish.name, currentLocation)}" target="_blank" rel="noopener noreferrer">
              🛵 Tìm đặt giao tận nơi trên ShopeeFood ↗
            </a>
            <a class="nearby-action-btn grab" href="${serviceSearchUrl('grab', dish.name, currentLocation)}" target="_blank" rel="noopener noreferrer">
              🛵 Tìm đặt giao tận nơi trên GrabFood ↗
            </a>
          </div>
        </div>`;
      return;
    }

    const nearestRoadDist = places[0].roadDistanceKm || estimateRoadDistanceKm(places[0].distanceKm);
    const nearestRoadText = nearestRoadDist < 1 ? `${Math.round(nearestRoadDist * 1000)} m` : `${nearestRoadDist.toFixed(1)} km`;
    status.textContent = `Tìm thấy ${places.length} quán có món ${dish.name} được đánh giá cao quanh bạn (gần nhất: ~${nearestRoadText} lái xe).`;
    const cardsHtml = places.slice(0, 8).map((place, index) => {
      const straightDist = place.distanceKm;
      const roadDist = place.roadDistanceKm || estimateRoadDistanceKm(straightDist);
      const travelDistanceText = roadDist < 1
        ? `Cách ${formatDistance(straightDist)} (~${Math.round(roadDist * 1000)} m lái xe)`
        : `Cách ${formatDistance(straightDist)} (~${roadDist.toFixed(1)} km lái xe)`;

      const hasCoords = Number.isFinite(place.lat) && Number.isFinite(place.lng);
      const gmapsPlaceUrl = hasCoords
        ? `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([place.name, place.address].filter(Boolean).join(' '))}`;

      return `
      <article class="nearby-place ${index === 0 ? 'is-nearest' : ''} ${place.isTopRated ? 'is-top-rated' : ''}">
        <button type="button" class="nearby-place-select" data-place-index="${index}">
          <div class="nearby-place-header">
            <span class="nearby-place-name">${escapeHTML(place.name)}</span>
            <span class="nearby-rating-badge">⭐ ${Number(place.rating || 4.7).toFixed(1)}</span>
          </div>
          <div class="nearby-place-subrow">
            <span class="nearby-place-distance" title="Ước tính khoảng cách lái xe trên đường thực tế ~${roadDist.toFixed(1)} km theo Google Maps (khoảng cách đường chim bay: ${formatDistance(straightDist)})">📍 ${travelDistanceText}</span>
            <span class="nearby-review-rate">👍 ${escapeHTML(place.ratingRate || '97% khen ngon')}</span>
            <span class="nearby-review-count">(${place.reviewCount || 180}+ đánh giá)</span>
            ${place.badge ? `<span class="nearby-badge-pill">${escapeHTML(place.badge)}</span>` : ''}
          </div>
          ${place.dishReview ? `
          <div class="nearby-dish-review">
            <span class="nearby-dish-review-icon">💬</span>
            <div class="nearby-dish-review-body">
              <span class="nearby-dish-review-title">Đánh giá món ${escapeHTML(dish.name)}:</span>
              <span class="nearby-dish-review-quote">“${escapeHTML(place.dishReview)}”</span>
            </div>
          </div>` : ''}
          <div class="nearby-place-meta">
            <span class="nearby-place-price">💰 ${escapeHTML(place.priceRange || '35.000đ - 65.000đ')}</span>
            <span class="nearby-place-status">${escapeHTML(place.openStatus || '🟢 Đang mở cửa')}</span>
          </div>
          <span class="nearby-place-address">${escapeHTML(place.address)}</span>
        </button>
        <div class="nearby-place-actions">
          <a class="nearby-directions" href="${googleMapsDirectionsUrl(currentLocation, place)}" target="_blank" rel="noopener noreferrer" aria-label="Chỉ đường đến ${escapeHTML(place.name)}">
            Chỉ đường ↗
          </a>
          <a class="nearby-map-link" href="${gmapsPlaceUrl}" target="_blank" rel="noopener noreferrer" title="Xem trên Google Maps">
            Xem GG Map 📍
          </a>
          <a class="nearby-ship-link" href="${serviceSearchUrl('shopee', place.name, currentLocation)}" target="_blank" rel="noopener noreferrer" title="Tìm trên ShopeeFood">
            Đặt món 🛵
          </a>
        </div>
      </article>`;
    }).join('');

    resultsElement.innerHTML = googleLiveHeader + cardsHtml;

    resultsElement.querySelectorAll('[data-place-index]').forEach(button => {
      button.addEventListener('click', async () => {
        selectedPlace = places[Number(button.dataset.placeIndex)];
        status.textContent = mapElement
          ? `Đang mở bản đồ đến ${selectedPlace.name}…`
          : `Đã chọn ${selectedPlace.name}. Nhấn “Chỉ đường” để mở Google Maps.`;
        if (mapElement) await renderNearbyMap(mapElement, currentLocation, selectedPlace);
        if (mapElement) {
          const selRoadDist = selectedPlace.roadDistanceKm || estimateRoadDistanceKm(selectedPlace.distanceKm);
          const selRoadText = selRoadDist < 1 ? `${Math.round(selRoadDist * 1000)} m` : `${selRoadDist.toFixed(1)} km`;
          status.textContent = `${selectedPlace.name} · ~${selRoadText} lái xe (${formatDistance(selectedPlace.distanceKm)} thẳng) từ vị trí của bạn (⭐ ${Number(selectedPlace.rating || 4.7).toFixed(1)}).`;
        }
        resultsElement.querySelectorAll('.nearby-place').forEach(row => row.classList.remove('is-selected'));
        button.closest('.nearby-place')?.classList.add('is-selected');
      });
    });
  }

  // Tùy chỉnh bán kính thay đổi -> tự động cập nhật ngay nếu đã có vị trí
  panel.querySelector(`#${ids.radius}`)?.addEventListener('change', async () => {
    if (!currentLocation) return;
    const radiusKm = Number(panel.querySelector(`#${ids.radius}`)?.value || 5);
    status.textContent = `Đang tìm quán bán ${dish.name} trong bán kính tùy chỉnh ${radiusKm} km…`;
    try {
      const places = await findNearbyPlaces(currentLocation, radiusKm, dish.name, dish.category);
      renderResults(places);
    } catch (err) {
      status.textContent = err.message || 'Không thể tìm quán.';
    }
  });

  panel.querySelector(`#${ids.locate}`)?.addEventListener('click', async () => {
    if (!requireAuthentication('Vui lòng đăng nhập hoặc đăng ký trước khi tìm địa chỉ quán ăn.')) return;
    const radiusKm = Number(panel.querySelector(`#${ids.radius}`)?.value || 5);
    status.textContent = 'Đang xin quyền GPS…';
    resultsElement.innerHTML = '';

    try {
      currentLocation = await getCurrentPosition();
      status.textContent = `Đã xác định vị trí. Đang tìm quán bán ${dish.name} trong bán kính ${radiusKm} km…`;
      if (mapElement) await renderNearbyMap(mapElement, currentLocation);

      const places = await findNearbyPlaces(currentLocation, radiusKm, dish.name, dish.category);
      renderResults(places);
    } catch (error) {
      if (panel.isConnected) {
        status.innerHTML = `
          <div class="nearby-error-row">
            <span class="nearby-error-msg">${escapeHTML(error.message || 'Không thể lấy vị trí hiện tại.')}</span>
            <button type="button" class="nearby-sample-btn" id="${panelId}-sample-btn">
              📍 Dùng vị trí trung tâm để xem mẫu
            </button>
          </div>`;
        panel.querySelector(`#${panelId}-sample-btn`)?.addEventListener('click', async () => {
          currentLocation = { lat: 10.7769, lng: 106.7009 };
          status.textContent = `Đang tải các quán bán ${dish.name} quanh trung tâm…`;
          if (mapElement) await renderNearbyMap(mapElement, currentLocation);
          const places = await findNearbyPlaces(currentLocation, radiusKm, dish.name, dish.category);
          renderResults(places);
        });
      }
    }
  });

  panel.querySelectorAll('[data-service]').forEach(button => {
    button.addEventListener('click', () => {
      if (!requireAuthentication('Vui lòng đăng nhập hoặc đăng ký trước khi tìm địa chỉ món ăn.')) return;
      const query = dish.name;
      const service = button.dataset.service;
      recordServiceClick({ service, dishId: dish.id, dishName: query });
      window.open(serviceSearchUrl(service, query, currentLocation), '_blank', 'noopener,noreferrer');
    });
  });

}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function formatDistance(distanceKm) {
  return distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`;
}

function toggleFav(id) {
  if (!requireAuthentication('Vui lòng đăng nhập hoặc đăng ký để lưu món vào Gu của tôi.')) return false;

  const idx = state.favorites.indexOf(id);
  if (idx >= 0) state.favorites.splice(idx, 1);
  else state.favorites.push(id);
  localStorage.setItem('bung_favs', JSON.stringify(state.favorites));
  requestApi('/api/customer/favorites', {
    method: 'PUT',
    body: { dishIds: state.favorites },
  }).then(() => {
    state.profileFavorites = [...state.favorites];
    if (state.activePage === 'profile') void loadProfileData();
  }).catch(error => {
    state.profileMessage = error.message;
    state.profileMessageType = 'error';
  });
  return true;
}

function updateFavBadge() {
  const badge = document.getElementById('fav-badge');
  if (!badge) return;
  const count = state.favorites.length;
  badge.textContent = count;
  badge.classList.toggle('hidden', count === 0);
  badge.style.animation = 'none';
  requestAnimationFrame(() => { badge.style.animation = ''; });
}

function updateHomeGrids() {
  const pg = document.getElementById('popular-grid');
  const ng = document.getElementById('new-grid');
  const pc = document.getElementById('popular-count');
  const nc = document.getElementById('new-count');
  if (pg) pg.innerHTML = renderDishCards(getFilteredPopular());
  if (ng) ng.innerHTML = renderDishCards(getFilteredNew());
  if (pc) pc.textContent = `${getFilteredPopular().length} món`;
  if (nc) nc.textContent = `${getFilteredNew().length} món`;
  bindDishCards();
}

function updateExploreGrid() {
  const query = document.getElementById('explore-search')?.value || '';
  const activecat = document.querySelector('.cat-btn.active')?.dataset.cat || 'all';
  let results = filterDishes(dishes, {
    categoryId: activecat,
    query,
    diet: state.exploreDiet
  });
  results = sortDishes(results, state.exploreSort);
  const grid = document.getElementById('explore-grid');
  const count = document.getElementById('explore-count');
  if (grid) grid.innerHTML = renderDishCards(results);
  if (count) count.textContent = `${results.length} món`;
  bindDishCards();
}

function updateAdminDishSearch() {
  const query = removeVietnameseTones(state.adminDishSearch);
  let visibleCount = 0;
  document.querySelectorAll('[data-admin-dish-row]').forEach(row => {
    const matches = row.dataset.search.includes(query);
    row.hidden = !matches;
    if (matches) visibleCount += 1;
  });
  const emptyRow = document.getElementById('admin-dish-search-empty');
  if (emptyRow) emptyRow.hidden = visibleCount > 0;
}

function navigateTo(page, { updateUrl = true } = {}) {
  closeModal();
  closeDishDetail();
  document.body.classList.remove('modal-open');

  if (page === 'culinary-arena') page = 'arena';

  if (['favs', 'profile', 'admin'].includes(page) && !isAuthenticated()) {
    requireAuthentication('Vui lòng đăng nhập hoặc đăng ký để tiếp tục.', page);
    return;
  }

  if (page === 'admin' && getAuthSession()?.user?.role !== 'admin') {
    state.profileMessage = 'Tài khoản khách hàng không được phép truy cập trang quản trị.';
    state.profileMessageType = 'error';
    page = 'profile';
    if (window.location.pathname === PAGE_PATHS.admin) {
      window.history.replaceState({ page }, '', PAGE_PATHS.profile);
    }
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) targetPage.classList.add('active');
  const navBtn = document.querySelector(`[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');
  state.activePage = page;
  if (updateUrl && PAGE_PATHS[page] && window.location.pathname !== PAGE_PATHS[page]) {
    window.history.pushState({ page }, '', PAGE_PATHS[page]);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (page === 'airdrop') {
    const container = document.getElementById('airdrop-container');
    if (container) {
      initAirdropManager(
        container,
        dishes,
        () => state.favorites,
        (id) => { toggleFav(id); updateFavBadge(); },
        (dish, onRoll) => openModal(dish, onRoll),
        (dish, host) => renderNearbyPanel(dish, host, {
          showMap: false
        })
      );
    }
  }

  if (page === 'meal') initializeMealPage();
  if (page === 'arena') initializeArenaPage();

  if (page === 'favs') {
    const favPage = document.getElementById('page-favs');
    if (favPage) favPage.innerHTML = renderFavs();
    bindDishCards();
    void loadCustomerFavorites();
  }

  if (page === 'profile') void loadProfileData();
  if (page === 'admin') void loadAdminDashboard();
  if (page === 'vouchers') void loadVouchersData();
}

async function loadVouchersData() {
  try {
    const remoteVouchers = await requestApi('/api/vouchers', { auth: false }).catch(() => null);
    if (Array.isArray(remoteVouchers) && remoteVouchers.length > 0) {
      state.vouchers = remoteVouchers;
      saveLocalVouchers(remoteVouchers);
    }
  } catch {}

  if (isAuthenticated()) {
    try {
      const myClaims = await requestApi('/api/customer/vouchers').catch(() => null);
      if (Array.isArray(myClaims)) {
        state.claimedVoucherIds = myClaims.map(c => Number(c.voucherId));
        saveLocalClaimedVoucherIds(state.claimedVoucherIds);
      }
    } catch {}
  }

  if (state.activePage === 'vouchers') renderApp();
}

async function loadRemoteDishes() {
  try {
    const remoteDishes = await requestApi('/api/dishes', { auth: false });
    if (Array.isArray(remoteDishes) && remoteDishes.length) {
      saveLocalAdminDishes(remoteDishes);
      replaceDishes(remoteDishes);
      renderApp();
      return;
    }
  } catch (error) {
    console.info('Sử dụng dữ liệu món ăn lưu trữ cục bộ:', error.message);
  }
  const local = getLocalAdminDishes();
  if (Array.isArray(local) && local.length) {
    replaceDishes(local);
    renderApp();
  }
}

async function loadProfileData() {
  try {
    const [profile, favorites, history, vouchers] = await Promise.all([
      requestApi('/api/me'),
      requestApi('/api/customer/favorites'),
      requestApi('/api/customer/history'),
      requestApi('/api/customer/vouchers').catch(() => null),
    ]);
    state.profile = profile;
    state.profileFavorites = favorites.dishIds.map(Number);
    state.profileHistory = history;
    state.favorites = state.profileFavorites;
    if (Array.isArray(vouchers)) {
      state.claimedVoucherIds = vouchers.map(c => Number(c.voucherId));
      saveLocalClaimedVoucherIds(state.claimedVoucherIds);
    }
    localStorage.setItem('bung_favs', JSON.stringify(state.favorites));
    if (state.activePage === 'profile') renderApp();
  } catch (error) {
    state.profileMessage = error.message;
    state.profileMessageType = 'error';
    if (state.activePage === 'profile') renderApp();
  }
}

async function loadCustomerFavorites() {
  try {
    const result = await requestApi('/api/customer/favorites');
    state.favorites = result.dishIds.map(Number);
    localStorage.setItem('bung_favs', JSON.stringify(state.favorites));
    updateFavBadge();
    if (state.activePage === 'favs') {
      const favPage = document.getElementById('page-favs');
      if (favPage) favPage.innerHTML = renderFavs();
      bindDishCards();
    }
  } catch (error) {
    state.profileMessage = error.message;
  }
}

async function loadAdminDashboard(successMessage = '') {
  try {
    const localDishes = getLocalAdminDishes();
    const localUsers = getLocalAdminUsers();
    const localSettings = getDynamicSettings();
    const localVouchers = getLocalVouchers();

    let [stats, adminDishes, users, analytics, settings, adminVouchers] = await Promise.all([
      requestApi('/api/admin/stats').catch(() => null),
      requestApi('/api/admin/dishes').catch(() => null),
      requestApi('/api/admin/users').catch(() => null),
      requestApi('/api/admin/analytics').catch(() => null),
      requestApi('/api/admin/settings').catch(() => null),
      requestApi('/api/admin/vouchers').catch(() => null),
    ]);

    if (Array.isArray(adminDishes) && adminDishes.length > 0) {
      saveLocalAdminDishes(adminDishes);
    } else {
      adminDishes = localDishes;
    }

    if (Array.isArray(users) && users.length > 0) {
      saveLocalAdminUsers(users);
    } else {
      users = localUsers;
    }

    if (settings) {
      setDynamicSettings(settings);
    } else {
      settings = localSettings;
    }

    if (Array.isArray(adminVouchers) && adminVouchers.length > 0) {
      saveLocalVouchers(adminVouchers);
    } else {
      adminVouchers = localVouchers;
    }

    if (!stats) {
      stats = computeLocalStats(adminDishes, users, adminVouchers);
    }

    state.adminStats = stats;
    state.adminDishes = adminDishes;
    state.adminUsers = users;
    if (analytics) state.adminAnalytics = analytics;
    state.adminSettings = settings;
    state.adminVouchers = adminVouchers;
    state.vouchers = adminVouchers;
    replaceDishes(adminDishes);

    // Đồng bộ ngay vai trò và quyền hạn của tài khoản đang đăng nhập từ database
    const session = getAuthSession();
    if (session?.user && session?.token && Array.isArray(users)) {
      const match = users.find(u => String(u.id) === String(session.user.id) || String(u.email).toLowerCase() === String(session.user.email).toLowerCase());
      if (match) {
        setAuthSession({ ...session.user, ...match }, session.token);
      }
    }

    state.adminMessage = successMessage;
    state.adminMessageType = successMessage ? 'success' : '';
  } catch (error) {
    state.adminMessage = error.message;
    state.adminMessageType = 'error';
  }
  if (state.activePage === 'admin') renderApp();
}

function requireAuthentication(message, returnPage = state.activePage) {
  if (isAuthenticated()) return true;

  closeModal();
  state.authMode = 'login';
  state.authMessage = message;
  state.authMessageType = 'error';
  state.authReturnPage = returnPage;
  state.activePage = 'auth';
  renderApp();
  navigateTo('auth');
  return false;
}

function closeHeaderMenu() {
  const popup = document.getElementById('header-menu-popup');
  popup?.classList.add('hidden');
}

function toggleHeaderMenu(forceOpen = null) {
  const popup = document.getElementById('header-menu-popup');
  if (!popup) return;
  const shouldOpen = forceOpen ?? popup.classList.contains('hidden');
  popup.classList.toggle('hidden', !shouldOpen);
}

// ============================================================
// GẮN SỰ KIỆN TƯƠNG TÁC (BIND EVENTS)
// ============================================================
function bindAll() {
  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      playClick();
      navigateTo(btn.dataset.page);
    });
  });

  document.getElementById('fav-nav-btn')?.addEventListener('click', () => {
    playClick();
    if (!requireAuthentication('Vui lòng đăng nhập hoặc đăng ký để xem Gu của tôi.', 'favs')) return;
    navigateTo('favs');
  });

  document.getElementById('header-menu-trigger')?.addEventListener('click', () => {
    playClick();
    toggleHeaderMenu();
  });

  document.getElementById('header-menu-close')?.addEventListener('click', () => {
    closeHeaderMenu();
  });

  document.querySelectorAll('[data-header-action]').forEach(button => {
    button.addEventListener('click', () => {
      const action = button.dataset.headerAction;
      closeHeaderMenu();
      if (action === 'auth') {
        if (!isAuthenticated()) {
          state.authMode = 'login';
          state.authMessage = 'Vui lòng đăng nhập hoặc đăng ký để tiếp tục.';
          state.authMessageType = 'error';
        }
        navigateTo('auth');
        return;
      }
      if (action === 'profile') {
        if (!requireAuthentication('Vui lòng đăng nhập để xem cá nhân.', 'profile')) return;
        navigateTo('profile');
        return;
      }
      if (action === 'admin') {
        if (!requireAuthentication('Vui lòng đăng nhập với tài khoản admin.', 'admin')) return;
        if (getAuthSession()?.user?.role !== 'admin') {
          state.profileMessage = 'Tài khoản khách hàng không được phép truy cập trang quản trị.';
          state.profileMessageType = 'error';
          navigateTo('profile');
          return;
        }
        navigateTo('admin');
        return;
      }
      if (action === 'vouchers') {
        navigateTo('vouchers');
        return;
      }
      if (action === 'volume') {
        window.__bungoiangi_sound_on = !(window.__bungoiangi_sound_on ?? true);
        button.querySelector('.header-menu-label').textContent = window.__bungoiangi_sound_on ? 'Âm lượng' : 'Tắt âm';
        return;
      }
    });
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.header-menu') && !event.target.closest('.header-menu-trigger')) {
      closeHeaderMenu();
    }
  });

  document.getElementById('profile-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name') || '').trim();
    try {
      const profile = await updateProfileName(name);
      state.profile = profile;
      state.profileMessage = 'Hồ sơ đã được cập nhật.';
      state.profileMessageType = 'success';
      renderApp();
    } catch (error) {
      state.profileMessage = error.message;
      state.profileMessageType = 'error';
      renderApp();
    }
  });

  document.getElementById('admin-refresh')?.addEventListener('click', () => void loadAdminDashboard());
  document.getElementById('admin-dish-search')?.addEventListener('input', event => {
    state.adminDishSearch = event.currentTarget.value;
    updateAdminDishSearch();
  });
  updateAdminDishSearch();

  document.getElementById('admin-add-dish')?.addEventListener('click', () => {
    state.adminEditDishId = null;
    document.getElementById('admin-dish-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('admin-dish-name')?.focus({ preventScroll: true });
  });
  document.getElementById('admin-add-user')?.addEventListener('click', () => {
    document.getElementById('admin-user-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('admin-user-name')?.focus({ preventScroll: true });
  });
  document.querySelectorAll('[data-admin-tab]').forEach(button => {
    button.addEventListener('click', () => {
      state.adminTab = button.dataset.adminTab;
      renderApp();
    });
  });

  document.getElementById('admin-cancel-edit')?.addEventListener('click', () => {
    state.adminEditDishId = null;
    state.adminDishDraft = null;
    renderApp();
  });

  const adminDishForm = document.getElementById('admin-dish-form');
  const captureAdminDishDraft = () => {
    if (!adminDishForm) return;
    const formData = new FormData(adminDishForm);
    state.adminDishDraft = {
      dishId: state.adminEditDishId === null ? null : Number(state.adminEditDishId),
      values: {
        name: String(formData.get('name') ?? ''),
        price: String(formData.get('price') ?? ''),
        desc: String(formData.get('desc') ?? ''),
        category: String(formData.get('category') ?? ''),
        type: String(formData.get('type') ?? ''),
        calo: String(formData.get('calo') ?? ''),
        img: String(formData.get('img') ?? ''),
        dropWeight: String(formData.get('dropWeight') ?? '1'),
        isSponsored: formData.get('isSponsored') === 'on',
        sponsorName: String(formData.get('sponsorName') ?? ''),
        sponsorBadge: String(formData.get('sponsorBadge') ?? ''),
        sponsorLink: String(formData.get('sponsorLink') ?? ''),
        isBestseller: formData.get('isBestseller') === 'on',
        active: formData.get('active') === 'on',
      },
    };
  };
  adminDishForm?.addEventListener('input', captureAdminDishDraft);
  adminDishForm?.addEventListener('change', captureAdminDishDraft);

  document.getElementById('admin-dish-image-file')?.addEventListener('change', async event => {
    const file = event.currentTarget.files?.[0];
    const message = document.getElementById('image-upload-message');
    if (!file || !message) return;
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      message.textContent = 'Chọn ảnh tối đa 10 MB.';
      message.classList.add('is-error');
      return;
    }
    message.textContent = 'Đang tải ảnh lên Cloudinary…';
    message.classList.remove('is-error');
    try {
      const imageUrl = await uploadImageToCloudinary(file);
      document.getElementById('admin-dish-img').value = imageUrl;
      captureAdminDishDraft();
      message.textContent = 'Ảnh đã tải lên.';
    } catch (error) {
      message.textContent = error.message;
      message.classList.add('is-error');
    }
  });

  const dishNameInput = document.getElementById('admin-dish-name');
  const dishNameFeedback = document.getElementById('admin-dish-name-feedback');
  dishNameInput?.addEventListener('input', () => {
    const normalizeName = value => String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
    const enteredName = normalizeName(dishNameInput.value);
    const duplicate = enteredName && state.adminDishes.find(dish =>
      Number(dish.id) !== Number(state.adminEditDishId) && normalizeName(dish.name) === enteredName
    );
    dishNameFeedback.textContent = duplicate ? `Món đã có: ${duplicate.name}` : '';
    dishNameFeedback.classList.toggle('is-error', Boolean(duplicate));
  });

  document.getElementById('admin-dish-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const dish = {
      name: values.name,
      price: Number(values.price),
      desc: values.desc,
      category: values.category,
      type: values.type,
      diet: values.type,
      calo: Number(values.calo || 0),
      img: values.img,
      dropWeight: Math.max(0.1, Number(values.dropWeight || 1)),
      isSponsored: values.isSponsored === 'on' || values.isSponsored === true || values.isSponsored === 'true',
      sponsorName: String(values.sponsorName || '').trim(),
      sponsorBadge: String(values.sponsorBadge || 'Tài trợ').trim(),
      sponsorLink: String(values.sponsorLink || '').trim(),
      isBestseller: values.isBestseller === 'on' || values.isBestseller === true || values.isBestseller === 'true',
      rarity: String(values.rarity || '').trim(),
      active: values.active === 'on' || values.active === true || values.active === 'true',
    };
    const editingId = state.adminEditDishId;
    let savedDish = null;
    try {
      savedDish = await requestApi(editingId ? `/api/admin/dishes/${editingId}` : '/api/admin/dishes', {
        method: editingId ? 'PATCH' : 'POST',
        body: dish,
      });
    } catch (_) {
      // Local fallback on Vercel
    }

    if (!savedDish || typeof savedDish !== 'object') {
      if (editingId) {
        savedDish = { ...dish, id: Number(editingId) };
      } else {
        const maxId = Math.max(0, ...state.adminDishes.map(d => Number(d.id) || 0));
        savedDish = { ...dish, id: maxId + 1 };
      }
    }

    if (editingId) {
      state.adminDishes = state.adminDishes.map(d => Number(d.id) === Number(editingId) ? { ...d, ...savedDish } : d);
    } else {
      state.adminDishes = [savedDish, ...state.adminDishes];
    }
    saveLocalAdminDishes(state.adminDishes);
    replaceDishes(state.adminDishes);

    state.adminEditDishId = null;
    state.adminDishDraft = null;
    await loadAdminDashboard(editingId ? 'Đã cập nhật món ăn.' : 'Đã thêm món ăn.');
  });

  document.querySelectorAll('[data-edit-dish]').forEach(button => {
    button.addEventListener('click', () => {
      state.adminEditDishId = Number(button.dataset.editDish);
      renderApp();
      const nameInput = document.getElementById('admin-dish-name');
      nameInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      nameInput?.focus({ preventScroll: true });
    });
  });

  document.querySelectorAll('[data-view-dish]').forEach(button => {
    button.addEventListener('click', () => {
      const dish = state.adminDishes.find(item => Number(item.id) === Number(button.dataset.viewDish));
      if (dish) openModal(dish, false);
    });
  });

  document.querySelectorAll('[data-delete-dish]').forEach(button => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Bạn có chắc muốn xóa món này?')) return;
      const deleteId = Number(button.dataset.deleteDish);
      try {
        await requestApi(`/api/admin/dishes/${deleteId}`, { method: 'DELETE' }).catch(() => {});
      } catch (_) {}
      state.adminDishes = state.adminDishes.filter(d => Number(d.id) !== deleteId);
      saveLocalAdminDishes(state.adminDishes);
      replaceDishes(state.adminDishes);
      await loadAdminDashboard('Đã xóa món ăn.');
    });
  });

  document.getElementById('admin-user-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const roleVal = values.role;
    if (roleVal === 'sub_root') {
      values.role = 'admin';
      values.adminLevel = 'sub_root';
    } else if (roleVal === 'ctv' || roleVal === 'admin') {
      values.role = 'admin';
      values.adminLevel = 'ctv';
    } else {
      values.role = 'customer';
      values.adminLevel = 'customer';
    }

    let savedUser = null;
    try {
      savedUser = await requestApi('/api/admin/users', { method: 'POST', body: values });
    } catch (_) {}

    if (!savedUser) {
      const maxId = Math.max(0, ...state.adminUsers.map(u => Number(u.id) || 0));
      savedUser = {
        id: maxId + 1,
        name: values.name,
        email: values.email,
        role: values.role,
        adminLevel: values.adminLevel,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
    }
    state.adminUsers = [savedUser, ...state.adminUsers];
    saveLocalAdminUsers(state.adminUsers);
    await loadAdminDashboard('Đã tạo người dùng mới thành công.');
  });

  document.querySelectorAll('[data-user-role]').forEach(select => {
    select.addEventListener('change', async () => {
      const userId = Number(select.dataset.userRole);
      const val = select.value;
      const payload = val === 'sub_root'
        ? { role: 'admin', adminLevel: 'sub_root' }
        : val === 'ctv' || val === 'admin'
          ? { role: 'admin', adminLevel: 'ctv' }
          : { role: 'customer', adminLevel: 'customer' };

      try {
        await requestApi(`/api/admin/users/${userId}`, { method: 'PATCH', body: payload }).catch(() => {});
      } catch (_) {}
      const targetUser = state.adminUsers.find(u => Number(u.id) === userId);
      if (targetUser) {
        Object.assign(targetUser, payload);
        saveLocalAdminUsers(state.adminUsers);
      }
      await loadAdminDashboard('Đã cập nhật vai trò người dùng.');
    });
  });

  document.querySelectorAll('[data-save-user-name]').forEach(button => {
    button.addEventListener('click', async () => {
      const userId = Number(button.dataset.saveUserName);
      const nameInput = document.querySelector(`[data-user-name="${userId}"]`);
      const name = String(nameInput?.value || '').trim();
      if (name.length < 2) {
        state.adminMessage = 'Tên phải có ít nhất 2 ký tự.';
        state.adminMessageType = 'error';
        renderApp();
        return;
      }
      try {
        await requestApi(`/api/admin/users/${userId}`, { method: 'PATCH', body: { name } }).catch(() => {});
      } catch (_) {}
      const targetUser = state.adminUsers.find(u => Number(u.id) === userId);
      if (targetUser) {
        targetUser.name = name;
        saveLocalAdminUsers(state.adminUsers);
      }
      await loadAdminDashboard('Đã cập nhật người dùng.');
    });
  });

  document.querySelectorAll('[data-delete-user]').forEach(button => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Bạn có chắc muốn xóa người dùng này?')) return;
      const userId = Number(button.dataset.deleteUser);
      try {
        await requestApi(`/api/admin/users/${userId}`, { method: 'DELETE' }).catch(() => {});
      } catch (_) {}
      state.adminUsers = state.adminUsers.filter(u => Number(u.id) !== userId);
      saveLocalAdminUsers(state.adminUsers);
      await loadAdminDashboard('Đã xóa người dùng.');
    });
  });

  // Lọc nhanh danh sách món ăn trên Admin Tab 1
  document.querySelectorAll('[data-admin-filter]').forEach(button => {
    button.addEventListener('click', () => {
      state.adminDishFilter = button.dataset.adminFilter;
      renderApp();
    });
  });

  // Bật/tắt nhanh thuộc tính món ăn (Quảng cáo, Bestseller, Ẩn/Hiện)
  document.querySelectorAll('[data-quick-toggle]').forEach(button => {
    button.addEventListener('click', async () => {
      const field = button.dataset.quickToggle;
      const dishId = Number(button.dataset.id);
      const dish = state.adminDishes.find(d => Number(d.id) === dishId);
      if (!dish) return;
      let nextValue;
      if (field === 'active') {
        nextValue = dish.active === false ? true : false;
      } else if (field === 'sponsored') {
        nextValue = !dish.isSponsored;
      } else if (field === 'bestseller') {
        nextValue = !dish.isBestseller;
      }
      const propKey = field === 'sponsored' ? 'isSponsored' : (field === 'bestseller' ? 'isBestseller' : 'active');
      dish[propKey] = nextValue;
      saveLocalAdminDishes(state.adminDishes);
      replaceDishes(state.adminDishes);
      renderApp();

      const payload = {
        field,
        value: nextValue,
        [propKey]: nextValue
      };
      try {
        await requestApi(`/api/admin/dishes/${dishId}/quick-toggle`, {
          method: 'PATCH',
          body: payload,
        }).catch(() => {});
      } catch (_) {}
    });
  });

  // Thay đổi trọng số rơi trực tiếp từ bảng món ăn
  document.querySelectorAll('[data-quick-weight]').forEach(input => {
    input.addEventListener('change', async () => {
      const dishId = Number(input.dataset.quickWeight);
      const dish = state.adminDishes.find(d => Number(d.id) === dishId);
      if (!dish) return;
      const newWeight = Math.max(0.1, Number(input.value) || 1);
      dish.dropWeight = newWeight;
      saveLocalAdminDishes(state.adminDishes);
      replaceDishes(state.adminDishes);
      renderApp();

      const payload = {
        field: 'dropWeight',
        value: newWeight,
        dropWeight: newWeight
      };
      try {
        await requestApi(`/api/admin/dishes/${dishId}/quick-toggle`, {
          method: 'PATCH',
          body: payload,
        }).catch(() => {});
      } catch (_) {}
    });
  });

  // Lưu cấu hình Luật chơi & Tỉ lệ rơi món (Tab 2)
  document.getElementById('admin-rules-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const updatedRules = {
      sponsoredMultiplier: Number(formData.get('sponsoredMultiplier') || 3),
      bestsellerMultiplier: Number(formData.get('bestsellerMultiplier') || 2),
      guaranteeSponsored: formData.get('guaranteeSponsored') === 'on',
      mealAncientRate: Number(formData.get('mealAncientRate') || 5),
      mealLegendaryRate: Number(formData.get('mealLegendaryRate') || 15),
      airdropHotRate: Number(formData.get('airdropHotRate') || 30),
    };
    const currentSettings = state.adminSettings || getDynamicSettings();
    const newSettings = {
      ...currentSettings,
      gameRules: { ...currentSettings.gameRules, ...updatedRules },
    };
    state.adminSettings = newSettings;
    setDynamicSettings(newSettings);

    try {
      const saved = await requestApi('/api/admin/settings', {
        method: 'PUT',
        body: newSettings,
      }).catch(() => null);
      if (saved) {
        state.adminSettings = saved;
        setDynamicSettings(saved);
      }
    } catch (_) {}
    await loadAdminDashboard('Đã lưu cấu hình luật chơi & tỉ lệ thành công!');
  });

  // Tương tác trực tiếp với thanh trượt luật chơi & mô phỏng tỉ lệ rơi thời gian thực
  const bindRuleSlider = (sliderId, badgeId, labelId, suffix) => {
    const slider = document.getElementById(sliderId);
    if (!slider) return;
    slider.addEventListener('input', () => {
      const val = slider.value + suffix;
      const badge = document.getElementById(badgeId);
      const label = document.getElementById(labelId);
      if (badge) badge.textContent = val;
      if (label) label.textContent = val;
      const currentSettings = state.adminSettings || getDynamicSettings();
      const tempSettings = {
        ...currentSettings,
        gameRules: {
          ...currentSettings.gameRules,
          sponsoredMultiplier: Number(document.getElementById('slider-sponsored-multiplier')?.value || 3),
          bestsellerMultiplier: Number(document.getElementById('slider-bestseller-multiplier')?.value || 2),
        }
      };
      const simulated = simulateDropProbabilities(state.adminDishes, tempSettings).slice(0, 10);
      const tbody = document.getElementById('sim-prob-tbody');
      if (tbody) {
        tbody.innerHTML = simulated.map(d => `
          <tr>
            <td><strong>${escapeHTML(d.name)}</strong></td>
            <td>
              ${d.isSponsored ? '<span class="admin-badge badge-sponsored">📢 Tài trợ</span>' : ''}
              ${d.isBestseller ? '<span class="admin-badge badge-bestseller">⭐ Hot</span>' : ''}
              ${!d.isSponsored && !d.isBestseller ? '<span style="color:var(--text-sub);font-size:0.75rem">Thường</span>' : ''}
            </td>
            <td><strong>${d.calculatedWeight}</strong></td>
            <td>
              <div style="display:flex;align-items:center;gap:0.6rem">
                <div class="admin-prob-meter" style="width:140px">
                  <div class="admin-prob-fill ${d.isSponsored ? 'is-sponsored' : ''}" style="width:${Math.min(100, Math.max(3, d.percentage * 4))}%"></div>
                </div>
                <strong>${d.percentage}%</strong>
              </div>
            </td>
          </tr>
        `).join('');
      }
    });
  };
  bindRuleSlider('slider-sponsored-multiplier', 'badge-sponsored-multiplier', 'lbl-sponsored-multiplier', 'x');
  bindRuleSlider('slider-bestseller-multiplier', 'badge-bestseller-multiplier', 'lbl-bestseller-multiplier', 'x');
  bindRuleSlider('slider-ancient-rate', 'badge-ancient-rate', 'lbl-ancient-rate', '%');
  bindRuleSlider('slider-legendary-rate', 'badge-legendary-rate', 'lbl-legendary-rate', '%');
  bindRuleSlider('slider-airdrop-rate', 'badge-airdrop-rate', 'lbl-airdrop-rate', '%');

  // Lưu Cài Đặt Web & CMS (Tab 4)
  document.getElementById('admin-settings-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const currentSettings = state.adminSettings || getDynamicSettings();
    const readCheckbox = (name, currentVal) => {
      const el = form.elements[name];
      if (!el) return Boolean(currentVal);
      if (el.disabled) return Boolean(currentVal);
      return Boolean(el.checked);
    };

    const newSettings = {
      features: {
        ...currentSettings.features,
        mealEnabled: readCheckbox('feat_mealEnabled', currentSettings.features?.mealEnabled !== false),
        arenaEnabled: readCheckbox('feat_arenaEnabled', currentSettings.features?.arenaEnabled !== false),
        airdropEnabled: readCheckbox('feat_airdropEnabled', currentSettings.features?.airdropEnabled !== false),
        quizEnabled: readCheckbox('feat_quizEnabled', currentSettings.features?.quizEnabled !== false),
        nearbyEnabled: readCheckbox('feat_nearbyEnabled', currentSettings.features?.nearbyEnabled !== false),
        maintenanceMode: readCheckbox('feat_maintenanceMode', currentSettings.features?.maintenanceMode),
        maintenanceNotice: String(form.elements['feat_maintenanceNotice']?.value || '').trim(),
      },
      announcement: {
        ...currentSettings.announcement,
        enabled: readCheckbox('ann_enabled', currentSettings.announcement?.enabled),
        title: String(form.elements['ann_title']?.value || '').trim(),
        text: String(form.elements['ann_text']?.value || '').trim(),
        type: String(form.elements['ann_type']?.value || 'promo'),
        link: String(form.elements['ann_link']?.value || '').trim(),
      },
      ads: {
        ...currentSettings.ads,
        bannerEnabled: readCheckbox('ads_bannerEnabled', currentSettings.ads?.bannerEnabled),
        title: String(form.elements['ads_title']?.value || '').trim(),
        badge: String(form.elements['ads_badge']?.value || 'TÀI TRỢ HOT').trim(),
        subtitle: String(form.elements['ads_subtitle']?.value || '').trim(),
        img: String(form.elements['ads_img']?.value || '').trim(),
        link: String(form.elements['ads_link']?.value || '').trim(),
      },
    };
    state.adminSettings = newSettings;
    setDynamicSettings(newSettings);

    try {
      const saved = await requestApi('/api/admin/settings', {
        method: 'PUT',
        body: newSettings,
      }).catch(() => null);
      if (saved) {
        state.adminSettings = saved;
        setDynamicSettings(saved);
      }
    } catch (_) {}
    await loadAdminDashboard('Đã lưu cài đặt Web & CMS thành công!');
  });

  // Tương tác trực tiếp bật/tắt chế độ bảo trì để khóa/mở các tính năng con
  const maintToggle = document.getElementById('admin-maintenance-toggle');
  maintToggle?.addEventListener('change', () => {
    const isMaint = maintToggle.checked;
    const notice = document.getElementById('maintenance-lock-notice');
    const card = maintToggle.closest('.admin-maintenance-card');
    const grid = document.getElementById('admin-subfeatures-grid');
    if (notice) notice.classList.toggle('hidden', !isMaint);
    if (card) card.classList.toggle('is-active', isMaint);
    if (grid) grid.classList.toggle('is-maintenance-locked', isMaint);
    document.querySelectorAll('.feature-sub-checkbox').forEach(cb => {
      cb.disabled = isMaint;
      cb.closest('.admin-flag-item')?.classList.toggle('is-locked-by-maintenance', isMaint);
    });
  });

  // Vô hiệu hóa (Khóa) hoặc Mở khóa tài khoản người dùng
  document.querySelectorAll('[data-toggle-user-ban]').forEach(button => {
    button.addEventListener('click', async () => {
      const userId = button.dataset.toggleUserBan;
      const action = button.dataset.action;
      const isBanAction = action === 'ban';
      const promptText = isBanAction
        ? 'Bạn có chắc muốn VÔ HIỆU HÓA (khóa) tài khoản này? Người này sẽ bị chặn không thể đăng nhập vào website.'
        : 'Bạn có chắc muốn MỞ KHÓA (kích hoạt lại) tài khoản này?';
      if (!window.confirm(promptText)) return;
      try {
        await requestApi(`/api/admin/users/${userId}`, {
          method: 'PATCH',
          body: { status: isBanAction ? 'banned' : 'active', isBanned: isBanAction },
        });
        await loadAdminDashboard(isBanAction ? 'Đã vô hiệu hóa tài khoản thành công.' : 'Đã mở khóa tài khoản thành công.');
      } catch (error) {
        state.adminMessage = error.message;
        state.adminMessageType = 'error';
        renderApp();
      }
    });
  });

  // Xóa sạch nhật ký sự kiện
  document.getElementById('admin-clear-analytics')?.addEventListener('click', async () => {
    if (!window.confirm('Bạn có chắc muốn xóa sạch toàn bộ lịch sử sự kiện và nhật ký hoạt động?')) return;
    try {
      await requestApi('/api/admin/analytics/clear', { method: 'DELETE' });
      await loadAdminDashboard('Đã xóa sạch lịch sử sự kiện.');
    } catch (error) {
      state.adminMessage = error.message;
      state.adminMessageType = 'error';
      renderApp();
    }
  });

  // Đóng thông báo nổi và thanh thông báo
  const dismissAnnouncement = () => {
    state.announcementDismissed = true;
    try { sessionStorage.setItem('bung_ann_dismissed', 'true'); } catch (_) {}
    const popup = document.getElementById('announcement-modal-backdrop');
    if (popup) {
      popup.classList.add('is-closing');
      setTimeout(() => popup.remove(), 200);
    }
    const bar = document.getElementById('announcement-bar');
    if (bar) bar.style.display = 'none';
  };
  document.getElementById('announcement-modal-close')?.addEventListener('click', dismissAnnouncement);
  document.getElementById('announcement-modal-dismiss')?.addEventListener('click', dismissAnnouncement);
  document.getElementById('announcement-close')?.addEventListener('click', dismissAnnouncement);

  // Theo dõi lượt click quảng cáo quán đối tác (Ad Clicks tracking)
  document.querySelectorAll('[data-sponsor-click]').forEach(el => {
    el.addEventListener('click', () => {
      const rawId = el.dataset.sponsorClick;
      const dishId = Number(rawId) || null;
      const sponsorName = el.dataset.sponsorName || '';
      const dishName = el.dataset.dishName || '';
      trackAnalyticsEvent('ad_click', { dishId, sponsorName, dishName });
    });
  });

  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      state.authMode = btn.dataset.authMode;
      state.authMessage = '';
      state.authMessageType = '';
      renderApp();
    });
  });

  document.querySelectorAll('.password-toggle').forEach(button => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.target);
      if (!input) return;
      const showPassword = input.type === 'password';
      input.type = showPassword ? 'text' : 'password';
      button.textContent = showPassword ? '🙈' : '👁';
      button.setAttribute('aria-label', showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    });
  });

  document.getElementById('auth-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get('name') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      password: String(formData.get('password') || ''),
      newPassword: String(formData.get('newPassword') || ''),
    };

    let result;
    if (state.authMode === 'register') {
      result = await apiRegister(payload);
    } else if (state.authMode === 'forgot') {
      result = await apiForgotPassword({ email: payload.email, newPassword: payload.newPassword });
    } else {
      result = await apiLogin({ email: payload.email, password: payload.password });
    }

    state.authMessage = result.message;
    state.authMessageType = result.ok ? 'success' : 'error';

    if (result.requiresEmailConfirmation) {
      renderApp();
      return;
    }

    if (result.ok) {
      const isPasswordReset = state.authMode === 'forgot';
      if (isPasswordReset) {
        state.authMode = 'login';
      }
      const destination = isPasswordReset ? 'auth' : (state.authReturnPage || 'home');
      state.authReturnPage = null;
      setTimeout(async () => {
        renderApp();
        navigateTo(destination);
        if (result.user?.role === 'customer' || result.user?.role === 'admin') await loadCustomerFavorites();
      }, 500);
    } else {
      renderApp();
    }
  });

  document.getElementById('auth-logout-btn')?.addEventListener('click', async () => {
    try {
      await logout();
      state.authMessage = 'Bạn đã đăng xuất.';
      state.authMessageType = 'success';
      renderApp();
      navigateTo('home');
    } catch (error) {
      state.authMessage = error.message;
      state.authMessageType = 'error';
      renderApp();
    }
  });

  document.getElementById('profile-logout-btn')?.addEventListener('click', async () => {
    try {
      await logout();
      state.profile = null;
      state.profileFavorites = [];
      state.profileHistory = [];
      state.favorites = [];
      localStorage.setItem('bung_favs', '[]');
      state.profileMessage = '';
      state.profileMessageType = '';
      state.authMode = 'login';
      state.authMessage = 'Bạn đã đăng xuất.';
      state.authMessageType = 'success';
      renderApp();
      navigateTo('home');
    } catch (error) {
      state.profileMessage = error.message;
      state.profileMessageType = 'error';
      renderApp();
    }
  });

  document.getElementById('logo-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    playClick();
    navigateTo('home');
  });

let lastBupDishId = null;

  // Nút BỤP! ĂN GÌ — Mega explosion
  document.getElementById('bup-btn')?.addEventListener('click', (e) => {
    playBup();
    const btn = e.currentTarget;

    // Kill any prior shake
    btn.classList.remove('bup-shaking');
    void btn.offsetWidth; // force reflow to restart animation

    // Stage 1: compress in
    btn.classList.add('bup-shaking');

    // Fire mega confetti from button center
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    megaBurst(cx, cy);

    // Screen flash ring
    const flash = document.createElement('div');
    flash.className = 'bup-flash-ring';
    flash.style.left = cx + 'px';
    flash.style.top = cy + 'px';

    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 700);

    setTimeout(() => {
      btn.classList.remove('bup-shaking');
      const dish = getRandomDish(dishes, state.mood, state.budget, lastBupDishId);
      if (dish) {
        lastBupDishId = dish.id;
        openModal(dish, true);
      }
    }, 420);
  });

  // Lọc Mood (Tâm trạng)
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      playSelect();
      const mood = btn.dataset.mood;
      state.mood = state.mood === mood ? null : mood;
      document.querySelectorAll('.mood-btn').forEach(b => b.classList.toggle('active', b.dataset.mood === state.mood));
      updateHomeGrids();
    });
  });

  // Lọc Budget (Ngân sách)
  document.querySelectorAll('.budget-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      playSelect();
      state.budget = btn.dataset.budget;
      document.querySelectorAll('.budget-btn').forEach(b => b.classList.toggle('active', b.dataset.budget === state.budget));
      updateHomeGrids();
    });
  });

  // Đóng Modal
  document.getElementById('dish-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Tìm kiếm & Danh mục trang Khám Phá
  let searchDebounceTimer = null;
  const searchInput = document.getElementById('explore-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      updateExploreGrid();
      clearTimeout(searchDebounceTimer);
      const query = searchInput.value.trim();
      if (query.length >= 2) {
        searchDebounceTimer = setTimeout(() => {
          trackAnalyticsEvent('search', { query });
        }, 1000);
      }
    });
  }
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      playClick();
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateExploreGrid();
    });
  });

  // Lọc Chay / Mặn (diet-toggle pills)
  document.querySelectorAll('.diet-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      playClick();
      state.exploreDiet = btn.dataset.diet;
      document.querySelectorAll('.diet-toggle').forEach(b => b.classList.toggle('active', b.dataset.diet === state.exploreDiet));
      updateExploreGrid();
    });
  });

  // Sắp xếp
  document.getElementById('explore-sort')?.addEventListener('change', (e) => {
    state.exploreSort = e.target.value;
    updateExploreGrid();
  });

  // Quiz Options
  document.querySelectorAll('.quiz-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.quizAdvancing) return;
      state.quizAdvancing = true;
      playSelect();
      const key = btn.dataset.key;
      const val = btn.dataset.val;
      const step = btn.closest('.quiz-step');
      step.querySelectorAll('.quiz-opt').forEach(b => {
        b.disabled = true;
        b.classList.remove('selected');
      });
      btn.classList.add('selected');
      state.quizAnswers[key] = val;

      setTimeout(() => {
        const nextStep = state.quizStep + 1;
        if (nextStep < QUIZ_QUESTIONS.length) {
          document.getElementById(`quiz-step-${state.quizStep}`)?.classList.add('hidden');
          document.getElementById(`quiz-step-${nextStep}`)?.classList.remove('hidden');
          state.quizStep = nextStep;
          updateQuizDots();
        } else {
          state.quizStep = QUIZ_QUESTIONS.length;
          updateQuizDots();
          const dish = resolveQuizResult();
          showQuizResult(dish);
        }
        state.quizAdvancing = false;
      }, 400);
    });
  });

  bindVoucherInteractions();
  bindDishCards();
}

function showVoucherToast(msg) {
  const existing = document.querySelector('.voucher-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'voucher-toast';
  toast.innerHTML = `<span>🎟️</span> <span>${escapeHTML(msg)}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function copyVoucherCode(code, buttonElement) {
  playSelect();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => {
      if (buttonElement) {
        const origText = buttonElement.innerHTML;
        buttonElement.innerHTML = '✓ Đã chép!';
        buttonElement.classList.add('copied');
        setTimeout(() => {
          buttonElement.innerHTML = origText;
          buttonElement.classList.remove('copied');
        }, 2000);
      }
      showVoucherToast(`Đã sao chép mã "${code}" thành công! 🎉`);
    }).catch(() => {
      showVoucherToast(`Mã ưu đãi của bạn: ${code}`);
    });
  } else {
    showVoucherToast(`Mã ưu đãi của bạn: ${code}`);
  }
}

async function handleClaimVoucher(voucherId) {
  playWin();
  burst();
  const vId = Number(voucherId);
  const target = state.vouchers.find(v => Number(v.id) === vId);

  if (!state.claimedVoucherIds.includes(vId)) {
    state.claimedVoucherIds.push(vId);
    saveLocalClaimedVoucherIds(state.claimedVoucherIds);
    if (target) {
      target.usedCount = (target.usedCount || 0) + 1;
      saveLocalVouchers(state.vouchers);
    }
  }

  showVoucherToast(`Đã thu thập mã "${target?.code || 'ƯU ĐÃI'}" vào ví! 🎉`);
  renderApp();

  if (isAuthenticated()) {
    try {
      await requestApi('/api/customer/vouchers', {
        method: 'POST',
        body: { voucherId: vId }
      });
    } catch (err) {
      console.warn('Lỗi đồng bộ lưu voucher lên server:', err.message);
    }
  }
}

function bindVoucherInteractions() {
  // Lọc voucher theo danh mục / tab
  document.querySelectorAll('[data-voucher-filter]').forEach(button => {
    button.addEventListener('click', () => {
      playClick();
      state.voucherFilter = button.dataset.voucherFilter;
      const voucherPage = document.getElementById('page-vouchers');
      if (voucherPage) voucherPage.innerHTML = renderVouchersPage();
      bindVoucherInteractions();
    });
  });

  // Sao chép mã voucher
  document.querySelectorAll('[data-copy-voucher]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const code = btn.dataset.copyVoucher;
      copyVoucherCode(code, btn);
    });
  });

  // Thu thập / lưu voucher vào kho
  document.querySelectorAll('[data-claim-voucher]').forEach(btn => {
    btn.addEventListener('click', () => {
      const vId = Number(btn.dataset.claimVoucher);
      handleClaimVoucher(vId);
    });
  });

  // Dùng ngay voucher -> kích hoạt voucher, copy mã và chuyển hướng sang Khám phá
  document.querySelectorAll('[data-use-voucher]').forEach(btn => {
    btn.addEventListener('click', () => {
      playClick();
      const code = String(btn.dataset.useVoucher || '').trim().toUpperCase();
      state.activeVoucherCode = code;
      setActiveVoucherCode(code);
      copyVoucherCode(code);
      showVoucherToast(`🎟️ Đã kích hoạt mã "${code}"! Hãy bấm vào món ăn bất kỳ để xem mức giảm giá.`, 'success');
      navigateTo('explore');
    });
  });

  // Chuyển hướng tới trang voucher
  document.querySelectorAll('[data-nav-to-vouchers]').forEach(btn => {
    btn.addEventListener('click', () => {
      playClick();
      navigateTo('vouchers');
    });
  });

  // ADMIN VOUCHER ACTIONS:
  document.getElementById('admin-add-voucher')?.addEventListener('click', () => {
    state.adminEditVoucherId = null;
    state.adminVoucherDraft = null;
    renderApp();
    document.getElementById('admin-voucher-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('admin-voucher-code')?.focus({ preventScroll: true });
  });

  document.getElementById('admin-cancel-voucher-edit')?.addEventListener('click', () => {
    state.adminEditVoucherId = null;
    state.adminVoucherDraft = null;
    renderApp();
  });

  // Form tạo / sửa voucher cho Admin
  document.getElementById('admin-voucher-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      code: String(formData.get('code') || '').trim().toUpperCase(),
      title: String(formData.get('title') || '').trim(),
      desc: String(formData.get('desc') || '').trim(),
      discountType: String(formData.get('discountType') || 'fixed'),
      discountValue: Number(formData.get('discountValue') || 0),
      minOrder: Number(formData.get('minOrder') || 0),
      maxDiscount: Number(formData.get('maxDiscount') || 0),
      usageLimit: Number(formData.get('usageLimit') || 100),
      expiryDate: String(formData.get('expiryDate') || ''),
      badge: String(formData.get('badge') || 'Ưu Đãi').trim(),
      category: String(formData.get('category') || 'all'),
      active: formData.get('active') === 'on',
    };

    try {
      if (state.adminEditVoucherId) {
        await requestApi(`/api/admin/vouchers/${state.adminEditVoucherId}`, {
          method: 'PATCH',
          body: payload,
        });
        state.adminEditVoucherId = null;
        state.adminVoucherDraft = null;
        await loadAdminDashboard('Đã cập nhật voucher thành công!');
      } else {
        await requestApi('/api/admin/vouchers', {
          method: 'POST',
          body: payload,
        });
        state.adminVoucherDraft = null;
        await loadAdminDashboard('Đã tạo và phát hành voucher mới thành công!');
      }
    } catch (error) {
      // Cập nhật cục bộ nếu chạy tĩnh hoặc demo
      if (state.adminEditVoucherId) {
        const idx = state.adminVouchers.findIndex(v => Number(v.id) === Number(state.adminEditVoucherId));
        if (idx !== -1) {
          state.adminVouchers[idx] = { ...state.adminVouchers[idx], ...payload };
          state.vouchers = state.adminVouchers;
          saveLocalVouchers(state.vouchers);
        }
        state.adminEditVoucherId = null;
        state.adminVoucherDraft = null;
        state.adminMessage = 'Đã cập nhật voucher (chế độ cục bộ)!';
        state.adminMessageType = 'success';
      } else {
        const newVoucher = {
          id: Date.now(),
          ...payload,
          usedCount: 0,
          createdAt: new Date().toISOString(),
        };
        state.adminVouchers.unshift(newVoucher);
        state.vouchers = state.adminVouchers;
        saveLocalVouchers(state.vouchers);
        state.adminVoucherDraft = null;
        state.adminMessage = 'Đã tạo voucher mới thành công!';
        state.adminMessageType = 'success';
      }
      renderApp();
    }
  });

  // Nút Sửa Voucher
  document.querySelectorAll('[data-edit-voucher]').forEach(btn => {
    btn.addEventListener('click', () => {
      const vId = Number(btn.dataset.editVoucher);
      state.adminEditVoucherId = vId;
      state.adminVoucherDraft = null;
      renderApp();
      document.getElementById('admin-voucher-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('admin-voucher-code')?.focus();
    });
  });

  // Nút Xóa Voucher
  document.querySelectorAll('[data-delete-voucher]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!window.confirm('Bạn có chắc muốn xóa voucher này? Khách hàng sẽ không thể sử dụng mã này nữa.')) return;
      const vId = Number(btn.dataset.deleteVoucher);
      try {
        await requestApi(`/api/admin/vouchers/${vId}`, { method: 'DELETE' });
        await loadAdminDashboard('Đã xóa voucher khỏi hệ thống.');
      } catch (error) {
        state.adminVouchers = state.adminVouchers.filter(v => Number(v.id) !== vId);
        state.vouchers = state.adminVouchers;
        saveLocalVouchers(state.vouchers);
        state.adminMessage = 'Đã xóa voucher thành công.';
        state.adminMessageType = 'success';
        renderApp();
      }
    });
  });

  // Bật/tắt nhanh voucher
  document.querySelectorAll('[data-toggle-voucher-active]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const vId = Number(btn.dataset.toggleVoucherActive);
      const v = state.adminVouchers.find(item => Number(item.id) === vId);
      if (!v) return;
      const nextActive = !v.active;
      try {
        await requestApi(`/api/admin/vouchers/${vId}/quick-toggle`, {
          method: 'PATCH',
          body: { active: nextActive }
        });
        await loadAdminDashboard(nextActive ? `Đã kích hoạt phát hành mã ${v.code}.` : `Đã tạm ngưng phát hành mã ${v.code}.`);
      } catch (error) {
        v.active = nextActive;
        saveLocalVouchers(state.adminVouchers);
        renderApp();
      }
    });
  });
}

function bindDishCards() {
  document.querySelectorAll('.dish-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.dish-fav-btn')) return;
      const id = parseInt(card.dataset.dish);
      const dish = dishes.find(d => d.id === id);
      if (dish) openModal(dish, false);
    });
  });

  document.querySelectorAll('.dish-fav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      playSelect();
      const id = parseInt(btn.dataset.fav);
      if (!toggleFav(id)) return;
      updateFavBadge();
      const saved = state.favorites.includes(id);
      btn.textContent = saved ? '❤️' : '🤍';
      btn.classList.toggle('saved', saved);
      if (state.activePage === 'favs' && !saved) {
        const favPage = document.getElementById('page-favs');
        if (favPage) {
          favPage.innerHTML = renderFavs();
          bindDishCards();
        }
      }
      if (saved) burst(e.clientX, e.clientY, 30);
    });
  });
}

// Khởi chạy ứng dụng
window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, () => {
  if (state.activePage === 'auth') return;
  state.authMode = 'login';
  state.authMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  state.authMessageType = 'error';
  state.authReturnPage = null;
  renderApp();
  navigateTo('auth');
});
window.addEventListener('popstate', () => navigateTo(pageForPath(window.location.pathname), { updateUrl: false }));
window.addEventListener(SETTINGS_UPDATED_EVENT, () => {
  renderApp();
});

void (async () => {
  try {
    await Promise.all([
      initializeAuth(),
      fetchDynamicSettings().catch(() => {}),
    ]);
  } catch (error) {
    state.authMessage = `Không thể khôi phục phiên đăng nhập: ${error.message}`;
    state.authMessageType = 'error';
  }
  renderApp();
  const initialPage = pageForPath(window.location.pathname);
  if (initialPage !== 'home') navigateTo(initialPage, { updateUrl: false });
  void loadRemoteDishes();
  void loadVouchersData();
})();
