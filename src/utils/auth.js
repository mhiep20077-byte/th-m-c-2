import { AUTH_SESSION_EXPIRED_EVENT, requestApi } from './apiClient.js';

const AUTH_KEY = 'bung_auth_session';
const DEFAULT_SESSION_DURATION = 1000 * 60 * 60;
let sessionExpiryTimer = null;

export { AUTH_SESSION_EXPIRED_EVENT };

function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;

  const globalStore = globalThis.__bungoiangi_store__ ??= Object.create(null);
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(globalStore, key) ? globalStore[key] : null; },
    setItem(key, value) { globalStore[key] = String(value); },
    removeItem(key) { delete globalStore[key]; },
  };
}

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function sanitizeUser(user) {
  if (!user) return null;
  const isPrimary = Boolean(user.isPrimaryRootAdmin || user.adminLevel === 'primary_root' || String(user.email).toLowerCase() === 'admin@bungoiangi.com' || Number(user.id) === 1);
  const isSub = !isPrimary && Boolean(user.isSubRootAdmin || user.adminLevel === 'sub_root' || user.subRole === 'sub_root');
  const isCtv = !isPrimary && !isSub && Boolean(user.isCtv || user.adminLevel === 'ctv' || user.role === 'admin');
  const adminLevel = isPrimary ? 'primary_root' : (isSub ? 'sub_root' : (isCtv ? 'ctv' : (user.adminLevel || 'customer')));

  return {
    id: user.id,
    name: user.name || '',
    email: user.email,
    role: user.role || 'customer',
    adminLevel,
    isSubRootAdmin: isSub,
    isPrimaryRootAdmin: isPrimary,
    isRootAdmin: isPrimary,
    canManageSettings: isPrimary || isSub,
    isCtv,
    roleTitle: user.roleTitle || (isPrimary ? 'Admin Gốc Chính' : isSub ? 'Admin Gốc Phụ' : isCtv ? 'Cộng tác viên (CTV)' : 'Khách hàng'),
    status: user.status || (user.isBanned ? 'banned' : 'active'),
    isBanned: Boolean(user.isBanned || user.status === 'banned'),
    createdAt: user.createdAt || new Date().toISOString(),
  };
}

function tokenExpiry(token) {
  const payload = String(token || '').split('.')[1];
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    const expiry = JSON.parse(decoded).exp;
    return Number.isFinite(expiry) ? expiry * 1000 : null;
  } catch {
    return null;
  }
}

function scheduleSessionExpiry(expiresAt, token) {
  if (sessionExpiryTimer !== null) clearTimeout(sessionExpiryTimer);
  const delay = expiresAt - Date.now();

  if (delay <= 0) {
    clearAuthSession();
    globalThis.window?.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
    return;
  }

  sessionExpiryTimer = setTimeout(() => {
    const storage = getStorage();
    const session = safeJsonParse(storage.getItem(AUTH_KEY), null);
    if (!session || session.token !== token) return;

    if (session.expiresAt > Date.now()) {
      scheduleSessionExpiry(session.expiresAt, token);
      return;
    }

    clearAuthSession();
    globalThis.window?.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
  }, delay);
  sessionExpiryTimer.unref?.();
}

export function getAuthSession() {
  const storage = getStorage();
  const session = safeJsonParse(storage.getItem(AUTH_KEY), null);
  if (!session) return null;

  if (session.expiresAt && Date.now() > session.expiresAt) {
    storage.removeItem(AUTH_KEY);
    return null;
  }

  return session;
}

export function setAuthSession(user, token) {
  const expiresAt = tokenExpiry(token) || Date.now() + DEFAULT_SESSION_DURATION;
  const storage = getStorage();
  storage.setItem(AUTH_KEY, JSON.stringify({
    user: sanitizeUser(user),
    token,
    expiresAt,
  }));
  scheduleSessionExpiry(expiresAt, token);
}

export async function initializeAuth() {
  const session = getAuthSession();
  if (!session?.token) return false;

  const user = await requestApi('/api/me');
  if (getAuthSession()?.token === session.token) setAuthSession(user, session.token);
  return true;
}

export function clearAuthSession() {
  if (sessionExpiryTimer !== null) clearTimeout(sessionExpiryTimer);
  sessionExpiryTimer = null;
  const storage = getStorage();
  storage.removeItem(AUTH_KEY);
}

export function validateAuthInput({ name, email, password, newPassword }) {
  if (name !== undefined && String(name).trim().length < 2) {
    return 'Tên người dùng phải có ít nhất 2 ký tự.';
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return 'Email không hợp lệ.';
  }

  const finalPassword = String(password || newPassword || '').trim();
  if (!finalPassword || finalPassword.length < 6) {
    return 'Mật khẩu phải có ít nhất 6 ký tự.';
  }

  return '';
}

export async function registerUser(data) {
  return apiRegister(data);
}

export async function loginUser(data) {
  return apiLogin(data);
}

export async function forgotPassword(data) {
  return apiForgotPassword(data);
}

function getRequestFailureMessage(error, fallback = 'Thao tác không thành công. Vui lòng thử lại.') {
  const message = String(error?.message || '').trim();
  if (!message) return fallback;

  const lower = message.toLowerCase();
  if (/tên.*đã.*(tồn tại|sử dụng)/i.test(message)) {
    return message;
  }

  if (/email.*đã.*(tồn tại|sử dụng|đăng ký)/i.test(message)) {
    return message;
  }

  if (/already registered|already exists/i.test(message)) {
    return 'Email này đã được sử dụng. Vui lòng chọn email khác hoặc đăng nhập.';
  }

  if (/invalid login credentials|invalid credentials|email hoặc mật khẩu không đúng/i.test(lower)) {
    return 'Email hoặc mật khẩu không đúng.';
  }

  if (/failed to fetch|network|load failed|fetch failed|connection|timeout|api.*unavailable|not connected/i.test(lower)) {
    const isLocal = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
    return isLocal
      ? 'Không thể kết nối JSON Server. Hãy chạy API local bằng lệnh npm run api.'
      : 'Không thể kết nối máy chủ API backend. Hãy kiểm tra biến VITE_API_URL hoặc dịch vụ backend.';
  }

  return message;
}

export async function apiRegister({ name, email, password }) {
  const error = validateAuthInput({ name, email, password });
  if (error) {
    return { ok: false, message: error };
  }

  try {
    const data = await requestApi('/register', {
      method: 'POST',
      auth: false,
      body: {
        name: String(name).trim(),
        email: normalizeEmail(email),
        password,
      },
    });
    const user = sanitizeUser(data.user);
    setAuthSession(user, data.accessToken);
    return { ok: true, token: data.accessToken, user, message: 'Đăng ký thành công! Bạn đã được đăng nhập tự động.' };
  } catch (requestError) {
    return { ok: false, message: getRequestFailureMessage(requestError, 'Đăng ký thất bại. Vui lòng thử lại.') };
  }
}

export async function apiLogin({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) {
    return { ok: false, message: 'Vui lòng nhập email và mật khẩu.' };
  }

  try {
    const data = await requestApi('/login', {
      method: 'POST',
      auth: false,
      body: { email: normalizedEmail, password },
    });
    const user = sanitizeUser(data.user);
    setAuthSession(user, data.accessToken);
    return { ok: true, token: data.accessToken, user, message: 'Đăng nhập thành công.' };
  } catch (requestError) {
    const message = getRequestFailureMessage(requestError, 'Email hoặc mật khẩu không đúng.');
    return { ok: false, message };
  }
}

export async function apiForgotPassword() {
  return {
    ok: false,
    message: 'Đặt lại mật khẩu cần luồng xác minh email. Vui lòng liên hệ quản trị viên.',
  };
}

export async function updateProfileName(name) {
  const normalizedName = String(name || '').trim();
  if (normalizedName.length < 2) throw new Error('Tên người dùng phải có ít nhất 2 ký tự.');

  const user = await requestApi('/api/me', { method: 'PATCH', body: { name: normalizedName } });
  const session = getAuthSession();
  if (session?.token) setAuthSession(user, session.token);
  return user;
}

export async function logout() {
  clearAuthSession();
  return { ok: true, message: 'Bạn đã đăng xuất.' };
}

export function isAuthenticated() {
  return Boolean(getAuthSession()?.token);
}
