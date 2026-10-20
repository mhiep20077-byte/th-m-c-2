// ============================================================
// 🍜 BungOiAnGi – Ứng Dụng Gợi Ý Món Ăn (Main App Shell)
// ============================================================

import './styles/main.css';
import './features/airdrop/airdrop.css';
import './features/auth/auth.css';
import './features/portals/portals.css';

import { dishes, MOODS, BUDGETS, CATEGORIES, replaceDishes } from './data/dishes.js';
import { filterDishes, sortDishes, getRandomDish, getCategoryLabel, removeVietnameseTones } from './features/filters/dishFilters.js';
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
  serviceSearchUrl
} from './features/nearby/nearbyPlaces.js';
import { AUTH_SESSION_EXPIRED_EVENT, apiRegister, apiLogin, apiForgotPassword, getAuthSession, initializeAuth, isAuthenticated, logout, updateProfileName } from './utils/auth.js';
import { requestApi, uploadImageToCloudinary } from './utils/apiClient.js';

// ============================================================
// STATE QUẢN LÝ ỨNG DỤNG
// ============================================================
const state = {
  activePage: 'home',
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
  adminTab: 'dishes',
  adminDishes: [],
  adminUsers: [],
  adminStats: null,
  adminMessage: '',
  adminMessageType: '',
  adminEditDishId: null,
  adminDishDraft: null,
  adminDishSearch: '',
};

const PAGE_PATHS = {
  home: '/',
  explore: '/explore',
  quiz: '/quiz',
  airdrop: '/airdrop',
  auth: '/auth',
  favs: '/favs',
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
  `;
  bindAll();
}

function renderHeader() {
  const favCount = state.favorites.length;
  const session = getAuthSession();
  const isLoggedIn = Boolean(session?.user);
  const isAdmin = session?.user?.role === 'admin';
  const authLabel = isLoggedIn ? 'Tài khoản' : 'Đăng nhập';

  return `
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
        <button class="nav-btn ${state.activePage === 'quiz' ? 'active' : ''}" data-page="quiz" id="nav-quiz">🤔 Hôm nay ăn gì?</button>
        <button class="nav-btn ${state.activePage === 'airdrop' ? 'active' : ''}" data-page="airdrop" id="nav-airdrop">🎁 Hòm thính</button>
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
  return `
    <main>
      <div id="page-home" class="page ${state.activePage === 'home' ? 'active' : ''}">${renderHome()}</div>
      <div id="page-explore" class="page ${state.activePage === 'explore' ? 'active' : ''}">${renderExplore()}</div>
      <div id="page-quiz" class="page ${state.activePage === 'quiz' ? 'active' : ''}">${renderQuiz()}</div>
      <div id="page-airdrop" class="page ${state.activePage === 'airdrop' ? 'active' : ''}"><div id="airdrop-container"></div></div>
      <div id="page-auth" class="page ${state.activePage === 'auth' ? 'active' : ''}">${renderAuthPage()}</div>
      <div id="page-favs" class="page ${state.activePage === 'favs' ? 'active' : ''}">${renderFavs()}</div>
      <div id="page-profile" class="page ${state.activePage === 'profile' ? 'active' : ''}">${renderProfilePage()}</div>
      <div id="page-admin" class="page ${state.activePage === 'admin' ? 'active' : ''}">${renderAdminPage()}</div>
    </main>`;
}

function renderAuthPage() {
  const session = getAuthSession();
  if (session?.user) {
    return `
      <div class="auth-shell">
        <div class="auth-account-box">
          <div class="avatar">👋</div>
          <h3>Xin chào, ${session.user.name}</h3>
          <p>${session.user.email}</p>
          <div class="meta">🔐 Đã đăng nhập • ${session.user.role === 'admin' ? 'Quản trị viên' : 'Khách hàng'}</div>
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

function renderProfilePage() {
  const user = state.profile || getAuthSession()?.user;
  if (!user) return '<section class="portal-page"><p class="portal-empty">Đang tải hồ sơ…</p></section>';

  return `
    <section class="portal-page">
      <header class="portal-heading">
        <div><h1>Hồ sơ cá nhân</h1><p>Thông tin, món yêu thích và lịch sử xem của bạn.</p></div>
        <button type="button" class="portal-button portal-button--danger" id="profile-logout-btn">Đăng xuất</button>
      </header>
      <p class="portal-message ${state.profileMessageType === 'error' ? 'is-error' : state.profileMessageType === 'success' ? 'is-success' : ''}" id="profile-message" role="status">${escapeHTML(state.profileMessage)}</p>
      <div class="portal-profile-summary">
        <div class="portal-metric"><span>Tài khoản</span><strong>${escapeHTML(user.role === 'admin' ? 'Quản trị viên' : 'Khách hàng')}</strong></div>
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
  const user = getAuthSession()?.user;
  if (user?.role !== 'admin') return '<section class="portal-page"><p class="portal-empty">Bạn không có quyền truy cập trang quản trị.</p></section>';

  const stats = state.adminStats;
  const hotDishes = stats?.hotDishes || [];
  const maximumHotScore = Math.max(1, ...hotDishes.map(dish => dish.favorites * 2 + dish.views));
  const editingDish = state.adminDishes.find(dish => Number(dish.id) === Number(state.adminEditDishId));
  const draftValues = state.adminDishDraft?.dishId === (editingDish ? Number(editingDish.id) : null)
    ? state.adminDishDraft.values
    : null;
  const selectedCategory = draftValues?.category ?? editingDish?.category;
  const selectedType = draftValues?.type ?? editingDish?.type ?? 'man';

  return `
    <section class="portal-page">
      <header class="portal-heading"><div><h1>Bảng quản trị</h1><p>Quản lý món ăn, tài khoản và số liệu sử dụng.</p></div><div class="portal-actions">${state.adminTab === 'dishes' ? '<button type="button" class="portal-button portal-button--primary" id="admin-add-dish">＋ Thêm món</button>' : '<button type="button" class="portal-button portal-button--primary" id="admin-add-user">＋ Tạo tài khoản</button>'}<button type="button" class="portal-button" id="admin-refresh">↻ Làm mới</button></div></header>
      <p class="portal-message ${state.adminMessageType === 'error' ? 'is-error' : state.adminMessageType === 'success' ? 'is-success' : ''}" id="admin-message" role="status">${escapeHTML(state.adminMessage)}</p>
      <div class="portal-segmented" role="group" aria-label="Khu vực quản trị">
        <button type="button" data-admin-tab="dishes" aria-pressed="${state.adminTab === 'dishes'}">Món ăn</button>
        <button type="button" data-admin-tab="users" aria-pressed="${state.adminTab === 'users'}">Người dùng</button>
      </div>
      ${state.adminTab === 'dishes' ? `
        <section class="portal-panel">
          <h2>${editingDish ? 'Sửa món ăn' : 'Thêm món ăn'}</h2>
          <form id="admin-dish-form" class="portal-form-grid">
            <div class="portal-field"><label for="admin-dish-name">Tên món</label><input id="admin-dish-name" name="name" value="${escapeHTML(draftValues?.name ?? editingDish?.name ?? '')}" required minlength="2" /><span class="portal-message" id="admin-dish-name-feedback" role="status" aria-live="polite"></span></div>
            <div class="portal-field"><label for="admin-dish-price">Giá (đ)</label><input id="admin-dish-price" name="price" type="number" min="0" value="${draftValues?.price ?? editingDish?.price ?? ''}" required /></div>
            <div class="portal-field portal-field--wide"><label for="admin-dish-desc">Mô tả</label><textarea id="admin-dish-desc" name="desc">${escapeHTML(draftValues?.desc ?? editingDish?.desc ?? '')}</textarea></div>
            <div class="portal-field"><label for="admin-dish-category">Danh mục</label><select id="admin-dish-category" name="category">${CATEGORIES.filter(category => category.id !== 'all').map(category => `<option value="${category.id}" ${selectedCategory === category.id ? 'selected' : ''}>${escapeHTML(category.name)}</option>`).join('')}</select></div>
            <div class="portal-field"><label for="admin-dish-type">Loại</label><select id="admin-dish-type" name="type"><option value="man" ${selectedType !== 'chay' ? 'selected' : ''}>Mặn</option><option value="chay" ${selectedType === 'chay' ? 'selected' : ''}>Chay</option></select></div>
            <div class="portal-field"><label for="admin-dish-calo">Calo</label><input id="admin-dish-calo" name="calo" type="number" min="0" value="${draftValues?.calo ?? editingDish?.calo ?? 0}" /></div>
            <div class="portal-field portal-field--wide"><label for="admin-dish-img">URL ảnh</label><input id="admin-dish-img" name="img" value="${escapeHTML(draftValues?.img ?? editingDish?.img ?? '')}" placeholder="https://..." /><input id="admin-dish-image-file" type="file" accept="image/*" /><span class="portal-message" id="image-upload-message" role="status"></span></div>
            <div class="portal-actions portal-field--wide"><button type="submit" class="portal-button portal-button--primary">${editingDish ? 'Lưu món' : 'Thêm món'}</button>${editingDish ? '<button type="button" class="portal-button" id="admin-cancel-edit">Hủy sửa</button>' : ''}</div>
          </form>
        </section>
        <section class="portal-panel"><h2>Danh sách món (${state.adminDishes.length})</h2>
          <label class="portal-field" for="admin-dish-search">Tìm món muốn sửa<input id="admin-dish-search" type="search" value="${escapeHTML(state.adminDishSearch)}" placeholder="Nhập tên món..." /></label>
          <div class="portal-table-wrap"><table class="portal-table"><thead><tr><th>Món</th><th>Danh mục</th><th>Giá</th><th>Thao tác</th></tr></thead><tbody>${state.adminDishes.map(dish => `<tr data-admin-dish-row data-search="${escapeHTML(removeVietnameseTones(dish.name))}"><td><div class="portal-dish-cell">${dish.img ? `<img src="${escapeHTML(dish.img)}" alt="" loading="lazy" />` : ''}<span>${escapeHTML(dish.name)}</span></div></td><td>${escapeHTML(getCategoryLabel(dish.category))}</td><td>${formatCurrency(dish.price)}</td><td><div class="portal-actions"><button class="portal-button" type="button" data-view-dish="${dish.id}">Xem</button><button class="portal-button" type="button" data-edit-dish="${dish.id}">Sửa</button><button class="portal-button portal-button--danger" type="button" data-delete-dish="${dish.id}">Xóa</button></div></td></tr>`).join('')}<tr id="admin-dish-search-empty" hidden><td colspan="4" class="portal-empty">Không tìm thấy món phù hợp.</td></tr></tbody></table></div>
        </section>` : `
        <section class="portal-panel">
          <h2>Tạo tài khoản</h2>
          <form id="admin-user-form" class="portal-form-grid">
            <div class="portal-field"><label for="admin-user-name">Họ và tên</label><input id="admin-user-name" name="name" required minlength="2" /></div>
            <div class="portal-field"><label for="admin-user-email">Email</label><input id="admin-user-email" name="email" type="email" required /></div>
            <div class="portal-field"><label for="admin-user-password">Mật khẩu</label><input id="admin-user-password" name="password" type="password" required minlength="8" /></div>
            <div class="portal-field"><label for="admin-user-role">Vai trò</label><select id="admin-user-role" name="role"><option value="customer">Khách hàng</option><option value="admin">Admin</option></select></div>
            <div class="portal-actions portal-field--wide"><button class="portal-button portal-button--primary" type="submit">Tạo người dùng</button></div>
          </form>
        </section>
        <section class="portal-panel"><h2>Danh sách người dùng (${state.adminUsers.length})</h2>
          <div class="portal-table-wrap"><table class="portal-table"><thead><tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${state.adminUsers.map(user => `<tr><td><input type="text" value="${escapeHTML(user.name || '')}" minlength="2" aria-label="Họ tên của ${escapeHTML(user.email)}" data-user-name="${user.id}" /></td><td>${escapeHTML(user.email)}</td><td><select aria-label="Vai trò của ${escapeHTML(user.email)}" data-user-role="${user.id}"><option value="customer" ${user.role === 'customer' ? 'selected' : ''}>Khách hàng</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option></select></td><td>Đang hoạt động</td><td><div class="portal-actions"><button class="portal-button" type="button" data-save-user-name="${user.id}">Lưu</button><button class="portal-button portal-button--danger" type="button" data-delete-user="${user.id}" ${String(user.id) === String(getAuthSession()?.user?.id) ? 'disabled' : ''}>Xóa</button></div></td></tr>`).join('')}</tbody></table></div>
        </section>`}
      <div class="portal-metrics">
        <div class="portal-metric"><span>Người dùng</span><strong>${stats?.userCount ?? '—'}</strong></div>
        <div class="portal-metric"><span>Món ăn</span><strong>${stats?.dishCount ?? '—'}</strong></div>
        <div class="portal-metric"><span>Lượt yêu thích</span><strong>${stats?.favoriteCount ?? '—'}</strong></div>
        <div class="portal-metric"><span>Lượt xem món</span><strong>${stats?.historyCount ?? '—'}</strong></div>
      </div>
      <section class="portal-panel">
        <h2>Món nổi bật</h2>
        ${hotDishes.length ? `<div class="portal-chart">${hotDishes.map(dish => {
    const score = dish.favorites * 2 + dish.views;
    return `<div class="portal-chart-row"><span>${escapeHTML(dish.name)}</span><div class="portal-chart-track"><div class="portal-chart-bar" style="width:${Math.max(3, score / maximumHotScore * 100)}%"></div></div><strong>${score}</strong></div>`;
  }).join('')}</div>` : '<p class="portal-empty">Chưa có dữ liệu thống kê.</p>'}
      </section>
    </section>`;
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
  return filterDishes(dishes, { moodId: state.mood, budgetId: state.budget }).filter(d => d.popular);
}
function getFilteredNew() {
  return filterDishes(dishes, { moodId: state.mood, budgetId: state.budget }).filter(d => !d.popular).slice(0, 8);
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
    return `
      <div class="dish-card" data-dish="${d.id}" id="dish-card-${d.id}">
        <div class="card-img-wrap">
          <img class="dish-img" src="${d.img}" alt="${d.name}" loading="lazy" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80';" />
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
          <div class="modal-desc" id="modal-desc"></div>
          <div class="modal-facts" id="modal-facts"></div>
          <div class="modal-reason" id="modal-reason"></div>
          <div id="modal-nearby-panel"></div>
          <div class="modal-actions">
            <button class="btn-secondary" id="modal-change-btn">🔄 Đổi món khác</button>
            <button class="btn-primary" id="modal-save-btn">❤️ Lưu vào Gu</button>
          </div>
        </div>
      </div>
    </div>`;
}

function openModal(dish, onRoll) {
  if (!dish) return;
  if (isAuthenticated() && getAuthSession()?.user?.role === 'customer') {
    requestApi('/api/customer/history', { method: 'POST', body: { dishId: Number(dish.id) } }).catch(() => { });
  }
  const overlay = document.getElementById('dish-modal');
  document.getElementById('modal-img').src = dish.img;
  document.getElementById('modal-name').textContent = dish.name;
  document.getElementById('modal-desc').textContent = dish.desc;
  document.getElementById('modal-facts').innerHTML = `
    <div class="modal-fact"><span class="mf-value">${formatCurrency(dish.price)}</span><span class="mf-key">Giá</span></div>
    <div class="modal-fact"><span class="mf-value">${dish.calo}</span><span class="mf-key">Kcal</span></div>
    <div class="modal-fact"><span class="mf-value">${dish.time}</span><span class="mf-key">Chờ</span></div>
    <div class="modal-fact"><span class="mf-value">⭐ ${dish.rating}</span><span class="mf-key">Đánh giá</span></div>
  `;
  document.getElementById('modal-reason').textContent = `✅ Lý do nên ăn: ${dish.desc.split('–')[0].trim()}`;
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

  panel.querySelector(`#${ids.locate}`)?.addEventListener('click', async () => {
    if (!requireAuthentication('Vui lòng đăng nhập hoặc đăng ký trước khi tìm địa chỉ quán ăn.')) return;
    const radiusKm = Number(panel.querySelector(`#${ids.radius}`)?.value || 5);
    status.textContent = 'Đang xin quyền GPS…';
    resultsElement.innerHTML = '';

    try {
      currentLocation = await getCurrentPosition();
      status.textContent = `Đã xác định vị trí. Đang tìm quán bán ${dish.name} trong bán kính ${radiusKm} km…`;
      if (mapElement) await renderNearbyMap(mapElement, currentLocation);

      const places = await findNearbyPlaces(currentLocation, radiusKm, dish.name);
      if (!panel.isConnected) return;
      if (places.length === 0) {
        status.textContent = `Chưa có quán nào gần bạn trong bán kính ${radiusKm} km. Hãy thử tăng bán kính hoặc xem trên Google Maps.`;
        return;
      }

      const fallbackMode = places.some(place => place.fallback);
      status.textContent = fallbackMode
        ? `Không tìm thấy quán bán ${dish.name} đúng món, nhưng đây là quán gần nhất quanh bạn.`
        : `Tìm thấy ${places.length} quán. Gần nhất cách bạn ${formatDistance(places[0].distanceKm)}.`;
      resultsElement.innerHTML = places.slice(0, 8).map((place, index) => `
        <article class="nearby-place ${index === 0 ? 'is-nearest' : ''}">
          <button type="button" class="nearby-place-select" data-place-index="${index}">
            <span class="nearby-place-name">${escapeHTML(place.name)}</span>
            <span class="nearby-place-distance">${formatDistance(place.distanceKm)}</span>
            <span class="nearby-place-address">${escapeHTML(place.address)}${place.fallback ? ' · Gần bạn' : ''}</span>
          </button>
          <a class="nearby-directions" href="${googleMapsDirectionsUrl(currentLocation, place)}" target="_blank" rel="noopener noreferrer" aria-label="Chỉ đường đến ${escapeHTML(place.name)}">Chỉ đường ↗</a>
        </article>`).join('');

      resultsElement.querySelectorAll('[data-place-index]').forEach(button => {
        button.addEventListener('click', async () => {
          selectedPlace = places[Number(button.dataset.placeIndex)];
          status.textContent = mapElement
            ? `Đang mở bản đồ đến ${selectedPlace.name}…`
            : `Đã chọn ${selectedPlace.name}. Nhấn “Chỉ đường” để mở Google Maps.`;
          if (mapElement) await renderNearbyMap(mapElement, currentLocation, selectedPlace);
          if (mapElement) status.textContent = `${selectedPlace.name} · ${formatDistance(selectedPlace.distanceKm)} từ vị trí của bạn.`;
          resultsElement.querySelectorAll('.nearby-place').forEach(row => row.classList.remove('is-selected'));
          button.closest('.nearby-place')?.classList.add('is-selected');
        });
      });
    } catch (error) {
      if (panel.isConnected) status.textContent = error.message || 'Không thể lấy vị trí. Hãy kiểm tra quyền GPS của trình duyệt.';
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

  if (page === 'favs') {
    const favPage = document.getElementById('page-favs');
    if (favPage) favPage.innerHTML = renderFavs();
    bindDishCards();
    void loadCustomerFavorites();
  }

  if (page === 'profile') void loadProfileData();
  if (page === 'admin') void loadAdminDashboard();
}

async function loadRemoteDishes() {
  try {
    const remoteDishes = await requestApi('/api/dishes', { auth: false });
    if (Array.isArray(remoteDishes) && remoteDishes.length) {
      replaceDishes(remoteDishes);
      renderApp();
    }
  } catch (error) {
    console.warn('Không thể đồng bộ danh sách món từ JSON Server:', error.message);
  }
}

async function loadProfileData() {
  try {
    const [profile, favorites, history] = await Promise.all([
      requestApi('/api/me'),
      requestApi('/api/customer/favorites'),
      requestApi('/api/customer/history'),
    ]);
    state.profile = profile;
    state.profileFavorites = favorites.dishIds.map(Number);
    state.profileHistory = history;
    state.favorites = state.profileFavorites;
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
    const [stats, adminDishes, users] = await Promise.all([
      requestApi('/api/admin/stats'),
      requestApi('/api/admin/dishes'),
      requestApi('/api/admin/users'),
    ]);
    state.adminStats = stats;
    state.adminDishes = adminDishes;
    state.adminUsers = users;
    replaceDishes(adminDishes);
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
      values: Object.fromEntries(['name', 'price', 'desc', 'category', 'type', 'calo', 'img']
        .map(name => [name, String(formData.get(name) ?? '')])),
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
    };
    const editingId = state.adminEditDishId;
    try {
      await requestApi(editingId ? `/api/admin/dishes/${editingId}` : '/api/admin/dishes', {
        method: editingId ? 'PATCH' : 'POST',
        body: dish,
      });
      state.adminEditDishId = null;
      state.adminDishDraft = null;
      await loadAdminDashboard(editingId ? 'Đã cập nhật món ăn.' : 'Đã thêm món ăn.');
    } catch (error) {
      state.adminMessage = error.message;
      state.adminMessageType = 'error';
      renderApp();
    }
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
      try {
        await requestApi(`/api/admin/dishes/${button.dataset.deleteDish}`, { method: 'DELETE' });
        await loadAdminDashboard('Đã xóa món ăn.');
      } catch (error) {
        state.adminMessage = error.message;
        state.adminMessageType = 'error';
        renderApp();
      }
    });
  });

  document.getElementById('admin-user-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await requestApi('/api/admin/users', { method: 'POST', body: values });
      await loadAdminDashboard('Đã tạo người dùng.');
    } catch (error) {
      state.adminMessage = error.message;
      state.adminMessageType = 'error';
      renderApp();
    }
  });

  document.querySelectorAll('[data-user-role]').forEach(select => {
    select.addEventListener('change', async () => {
      try {
        await requestApi(`/api/admin/users/${select.dataset.userRole}`, {
          method: 'PATCH', body: { role: select.value },
        });
        await loadAdminDashboard('Đã cập nhật vai trò.');
      } catch (error) {
        state.adminMessage = error.message;
        state.adminMessageType = 'error';
        renderApp();
      }
    });
  });

  document.querySelectorAll('[data-save-user-name]').forEach(button => {
    button.addEventListener('click', async () => {
      const userId = button.dataset.saveUserName;
      const nameInput = document.querySelector(`[data-user-name="${userId}"]`);
      const name = String(nameInput?.value || '').trim();
      if (name.length < 2) {
        state.adminMessage = 'Tên phải có ít nhất 2 ký tự.';
        state.adminMessageType = 'error';
        renderApp();
        return;
      }
      try {
        await requestApi(`/api/admin/users/${userId}`, { method: 'PATCH', body: { name } });
        await loadAdminDashboard('Đã cập nhật người dùng.');
      } catch (error) {
        state.adminMessage = error.message;
        state.adminMessageType = 'error';
        renderApp();
      }
    });
  });

  document.querySelectorAll('[data-delete-user]').forEach(button => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Bạn có chắc muốn xóa người dùng này?')) return;
      try {
        await requestApi(`/api/admin/users/${button.dataset.deleteUser}`, { method: 'DELETE' });
        await loadAdminDashboard('Đã xóa người dùng.');
      } catch (error) {
        state.adminMessage = error.message;
        state.adminMessageType = 'error';
        renderApp();
      }
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
      const dish = getRandomDish(dishes, state.mood, state.budget);
      if (dish) openModal(dish, true);
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
  const searchInput = document.getElementById('explore-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => updateExploreGrid());
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

  bindDishCards();
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
void (async () => {
  try {
    await initializeAuth();
  } catch (error) {
    state.authMessage = `Không thể khôi phục phiên đăng nhập: ${error.message}`;
    state.authMessageType = 'error';
  }
  renderApp();
  const initialPage = pageForPath(window.location.pathname);
  if (initialPage !== 'home') navigateTo(initialPage, { updateUrl: false });
  void loadRemoteDishes();
})();
