import { normalizeCategory } from '../filters/dishFilters.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { getCurrentVoucherCalculation } from '../../utils/voucherWidget.js';

/** Các giai đoạn của chuỗi sự kiện hòm thính */
export const AIRDROP_PHASE = {
  READY: 'ready',
  LAUNCHING: 'launching',
  INCOMING: 'incoming',
  DROPPED: 'dropped',
  OPENING: 'opening',
  REVEALED: 'revealed'
};

/** Thời lượng (ms) của từng giai đoạn, dùng để hẹn giờ chuyển trạng thái */
export const AIRDROP_TIMING = {
  LAUNCHING: 1150,
  INCOMING: 3400,
  OPENING: 3000
};

export const DISH_TYPES = [
  { id: 'tat-ca', name: 'Tất cả', icon: '🍽️' },
  { id: 'man', name: 'Món mặn', icon: '🥩' },
  { id: 'chay', name: 'Món chay', icon: '🥗' }
];

export const CATEGORIES = [
  { id: 'tat-ca', name: 'Tất cả', icon: '🍽️' },
  { id: 'nuoc', name: 'Món nước', icon: '🍜' },
  { id: 'com', name: 'Cơm & Xôi', icon: '🍚' },
  { id: 'xao-kho', name: 'Món xào & Nướng', icon: '🥢' },
  { id: 'anvat', name: 'Ăn vặt', icon: '🍢' },
  { id: 'ngot', name: 'Tráng miệng & Chè', icon: '🍮' },
  { id: 'uong', name: 'Đồ uống', icon: '🧋' }
];

export const BUDGET_GROUPS = [
  { id: 'b20', name: 'Dưới 25K', min: 0, max: 25000, icon: '💵' },
  { id: 'b40', name: '25K – 45K', min: 25001, max: 45000, icon: '💵' },
  { id: 'b70', name: '45K – 80K', min: 45001, max: 80000, icon: '💵' },
  { id: 'b150', name: 'Trên 80K', min: 80001, max: Infinity, icon: '💎' }
];

function foodImageFallback(alt) {
  return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80';
}

function getCategoryName(catId) {
  const norm = normalizeCategory(catId);
  const cat = CATEGORIES.find(c => c.id === norm || c.id === catId);
  return cat ? cat.name : (catId || 'Món ăn');
}

function removeVietnameseTones(str) {
  if (!str) return '';
  str = str.toLowerCase();
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
  str = str.replace(/đ/g, 'd');
  return str;
}

const BUSY_PHASES = new Set([
  AIRDROP_PHASE.LAUNCHING,
  AIRDROP_PHASE.INCOMING,
  AIRDROP_PHASE.OPENING
]);

const PHASE_STATUS = {
  ready: 'Bấm bắn pháo hiệu để gọi máy bay thả hòm xuống.',
  launching: 'Pháo hiệu đang vút lên trời...',
  incoming: 'Máy bay đã nhận lệnh, đang thả hòm xuống!',
  dropped: 'Hòm thính đã hạ cánh. Nhấn vào hòm để mở!',
  opening: 'Hòm đang mở, vòng quay đang chạy...',
  revealed: ''
};

function getAirdropStatus(phase, dish, message) {
  if (message) return message;
  if (phase === AIRDROP_PHASE.REVEALED) return `Hòm thính mang đến ${dish?.name || 'một món ngon'}!`;
  return PHASE_STATUS[phase] || '';
}

/** Số món sẽ rơi xuống sau khi áp bộ lọc */
function getPoolLabel(poolSize) {
  return `${poolSize} món sẽ rơi xuống`;
}

const PHASE_LAUNCH_LABEL = {
  ready: '🚀 Bắn pháo lên trời',
  revealed: '🎆 Gọi máy bay tiếp'
};

/** Giai đoạn đang chạy animation, lúc này không được render lại scene */
export function isAirdropBusy(phase) {
  return BUSY_PHASES.has(phase);
}

export function createAirdropState() {
  return { phase: AIRDROP_PHASE.READY, dishId: null, message: '' };
}

/* ===== Vòng quay trong hòm (kiểu quay xổ số trong PUBG) ===== */

const ROULETTE_FILLERS = 8;
const ROULETTE_LOOPS = 3;
/** Vé dự phòng nằm sau món trúng để dải vé không bị cắt cụt đúng chỗ dừng */
const ROULETTE_TAIL = 6;

/** Xáo trộn bản sao để không làm đổi thứ tự pool gốc */
function shuffleDishes(dishes) {
  const shuffled = [...dishes];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

/**
 * Vé mồi của một vòng: các món khác món trúng, mỗi vòng trộn một kiểu và
 * không lặp món để dải vé nhìn như quay xổ số thật.
 */
function buildRouletteFillers(pool, dish, count = ROULETTE_FILLERS) {
  return shuffleDishes(pool.filter(item => item.id !== dish.id)).slice(0, count);
}

/**
 * Tạo dải vé vòng quay. Món được chọn nằm ở một vị trí ngẫu nhiên trong vòng
 * cuối, có vé mồi ở cả phía trước lẫn phía sau, nên dải vé lướt qua món trúng
 * thay vì lúc nào cũng dừng ở lá cuối.
 * @returns {{ tickets: Array, stopIndex: number }}
 */
function buildRouletteTickets(pool, dish) {
  const tickets = [];

  // Các vòng chạy phía trước chỉ toàn vé mồi để dải vé quay đủ dài
  for (let lapIndex = 0; lapIndex < ROULETTE_LOOPS; lapIndex += 1) {
    tickets.push(...buildRouletteFillers(pool, dish));
  }

  const fillers = buildRouletteFillers(pool, dish);
  if (fillers.length === 0) {
    return { tickets: [...tickets, dish], stopIndex: tickets.length };
  }

  const offset = Math.floor(Math.random() * (fillers.length + 1));
  const stopIndex = tickets.length + offset;
  tickets.push(...fillers.slice(0, offset), dish, ...fillers.slice(offset));
  tickets.push(...buildRouletteFillers(pool, dish, ROULETTE_TAIL));

  return { tickets, stopIndex };
}

function renderRouletteTickets(tickets) {
  return tickets.map(dish => `
    <span class="airdrop-roulette-ticket">
      <img src="${dish.image || dish.img}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${foodImageFallback('Món ăn')}';" />
      <span class="airdrop-roulette-ticket-name">${dish.name}</span>
    </span>
  `).join('');
}

/**
 * Chạy hiệu ứng vòng quay dải vé, dừng chính xác tại món vừa bốc.
 * Vé cách nhau cả phần `gap` của flex nên phải lấy toạ độ thật của vé đích
 * thay vì tự nhân số vé với bề rộng vé, nếu không sẽ dừng lệch món.
 */
function spinRoulette(scene) {
  const viewport = scene.querySelector('.airdrop-roulette');
  const strip = scene.querySelector('.airdrop-roulette-strip');
  if (!viewport || !strip) return;

  const stopIndex = Number(strip.dataset.stopIndex) || 0;
  const target = strip.children[stopIndex];
  if (!target) return;

  // Dải chưa được dịch chuyển lúc này nên đọc rect là ra toạ độ gốc
  const stripLeft = strip.getBoundingClientRect().left;
  const targetRect = target.getBoundingClientRect();
  const targetCenter = targetRect.left - stripLeft + targetRect.width / 2;
  const endX = viewport.getBoundingClientRect().width / 2 - targetCenter;

  if (!Number.isFinite(endX)) return;

  strip.animate(
    [{ transform: 'translateX(0px)' }, { transform: `translateX(${endX}px)` }],
    { duration: 2600, easing: 'cubic-bezier(0.11, 0.72, 0.12, 1)', fill: 'forwards' }
  );
}

/* ===== Thẻ phần thưởng ===== */

function renderReward(dish, isFavorite, isExcluded) {
  if (!dish) return '';

  const type = DISH_TYPES.find(item => item.id === dish.type);
  const tagsHTML = (dish.tags || [])
    .map(tag => `<span class="airdrop-reward-tag">#${tag}</span>`)
    .join('');
  const favLabel = isFavorite ? 'Bỏ yêu thích' : 'Lưu yêu thích';
  const excludeLabel = isExcluded ? 'Cho món này quay lại hòm thính' : 'Bỏ món này khỏi hòm thính';

  return `
    <article class="airdrop-reward-card${isExcluded ? ' is-dismissed' : ''}">
      <div class="airdrop-reward-media">
        <img
          src="${dish.image || dish.img}"
          alt="${dish.name}"
          loading="lazy"
          onerror="this.onerror=null;this.src='${foodImageFallback('Ảnh lỗi')}';"
        />
        <span class="airdrop-reward-ribbon">🎁 HÒM THÍNH</span>
        <button
          type="button"
          class="airdrop-reward-dismiss${isExcluded ? ' is-active' : ''}"
          data-action="exclude"
          data-id="${dish.id}"
          title="${excludeLabel}"
          aria-label="${excludeLabel}"
          aria-pressed="${isExcluded}"
        >${isExcluded ? '+' : '−'}</button>
      </div>
      <button
        type="button"
        class="airdrop-reward-close"
        data-action="close"
        title="Đóng hòm thính"
        aria-label="Đóng hòm thính"
      >✕</button>
      <div class="airdrop-reward-copy">
        <div class="airdrop-reward-badges">
          <span class="airdrop-reward-badge">🍽️ ${getCategoryName(dish.category)}</span>
          ${type ? `<span class="airdrop-reward-badge">${type.icon} ${type.name}</span>` : ''}
        </div>
        <h2 class="airdrop-reward-name">${dish.name}</h2>
        <p class="airdrop-reward-desc">${dish.description || dish.desc}</p>
        ${tagsHTML ? `<div class="airdrop-reward-tags">${tagsHTML}</div>` : ''}
        <div class="airdrop-reward-foot">
          <strong class="airdrop-reward-price">${(() => {
            const calc = getCurrentVoucherCalculation(dish.price);
            return calc?.result?.isValid
              ? `<del style="opacity:0.6;font-size:0.85em;margin-right:6px;font-weight:normal">${formatCurrency(dish.price)}</del> 👉 <span style="color:#ea580c;font-weight:800">${formatCurrency(calc.result.finalPrice)}</span>`
              : formatCurrency(dish.price);
          })()}</strong>
          <div class="airdrop-reward-actions">
            <button type="button" class="airdrop-detail-button" data-action="detail" data-id="${dish.id}">
              Xem chi tiết món
            </button>
            <button
              type="button"
              class="airdrop-reward-fav${isFavorite ? ' active' : ''}"
              data-action="fav"
              data-id="${dish.id}"
              title="${favLabel}"
              aria-label="${favLabel}"
              aria-pressed="${isFavorite}"
            >${isFavorite ? '❤️' : '🤍'}</button>
          </div>
        </div>
      </div>
      <div class="airdrop-voucher-host" id="airdrop-voucher-host"></div>
      <div class="airdrop-nearby-host"></div>
    </article>
  `;
}

/* ===== Scene hòm thính ===== */

function renderScene(phase, dish, pool, isFavorite, isExcluded) {
  const isOpening = phase === AIRDROP_PHASE.OPENING;
  const isRevealed = phase === AIRDROP_PHASE.REVEALED;
  const roulette = isOpening && dish ? buildRouletteTickets(pool, dish) : null;

  return `
    <div class="airdrop-scene" data-phase="${phase}" aria-label="Mô phỏng máy bay thả hòm quà">
      <div class="airdrop-stars" aria-hidden="true"></div>
      <span class="airdrop-moon" aria-hidden="true"></span>
      <span class="airdrop-cloud airdrop-cloud--one" aria-hidden="true"></span>
      <span class="airdrop-cloud airdrop-cloud--two" aria-hidden="true"></span>
      <span class="airdrop-flare-trail" aria-hidden="true"></span>
      <span class="airdrop-flare" aria-hidden="true"></span>
      <span class="airdrop-plane" aria-hidden="true">
        <span class="airdrop-plane-trail"></span>
        <span class="airdrop-plane-body">✈️</span>
      </span>

      <div class="airdrop-package" aria-hidden="true">
        <span class="airdrop-parachute"><span class="airdrop-canopy"></span><span class="airdrop-cord"></span></span>
        <span class="airdrop-shockwave airdrop-shockwave--one"></span>
        <span class="airdrop-shockwave airdrop-shockwave--two"></span>
        <div class="airdrop-crate-glow"></div>
        <div class="airdrop-crate-body">
          <span class="airdrop-crate-lid"></span>
          <button
            type="button"
            class="airdrop-crate"
            data-action="open"
            ${phase === AIRDROP_PHASE.DROPPED ? '' : 'disabled'}
            aria-label="Mở hòm thính"
          ><span class="airdrop-crate-icon">📦</span><small>MỞ HÒM</small></button>
        </div>
        <span class="airdrop-crate-shadow"></span>
      </div>

      ${roulette ? `
        <div class="airdrop-roulette" role="status" aria-label="Đang quay chọn món ăn">
          <span class="airdrop-roulette-pointer" aria-hidden="true"></span>
          <div class="airdrop-roulette-strip" data-stop-index="${roulette.stopIndex}">
            ${renderRouletteTickets(roulette.tickets)}
          </div>
          <span class="airdrop-roulette-fade airdrop-roulette-fade--left" aria-hidden="true"></span>
          <span class="airdrop-roulette-fade airdrop-roulette-fade--right" aria-hidden="true"></span>
        </div>
      ` : ''}

      <div class="airdrop-ground" aria-hidden="true"></div>
      <div class="airdrop-sparkles" aria-hidden="true">
        <span>✦</span><span>✦</span><span>✦</span><span>✦</span><span>✦</span><span>✦</span>
      </div>

      ${isRevealed ? `
        <div class="airdrop-reward-overlay">
          <div class="airdrop-celebrate" aria-hidden="true">
            <span class="airdrop-rays"></span>
            <span class="airdrop-cash airdrop-cash--one">💵</span>
            <span class="airdrop-cash airdrop-cash--two">💸</span>
            <span class="airdrop-cash airdrop-cash--three">🪙</span>
            <span class="airdrop-cash airdrop-cash--four">💰</span>
            <span class="airdrop-cash airdrop-cash--five">💵</span>
            <span class="airdrop-cash airdrop-cash--six">🪙</span>
          </div>
          ${renderReward(dish, isFavorite, isExcluded)}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Bố cục scene chỉ khác nhau ở vòng quay và thẻ quà.
 * Các phase bay (ready → launching → incoming → dropped) dùng chung một bộ khung
 * nên chỉ cần đổi thuộc tính, giữ nguyên DOM để chuyển động chạy liền mạch.
 */
function sceneSignature(phase, dish) {
  const shape = phase === AIRDROP_PHASE.OPENING || phase === AIRDROP_PHASE.REVEALED ? phase : 'flight';
  return `${shape}|${dish?.id ?? 'none'}`;
}

const ACTION_HANDLERS = {
  launch: (handlers) => handlers.onLaunch?.(),
  open: (handlers) => handlers.onOpen?.(),
  detail: (handlers, trigger) => handlers.onViewDetail?.(Number(trigger.dataset.id), trigger),
  fav: (handlers, trigger) => handlers.onToggleFavorite?.(Number(trigger.dataset.id), trigger),
  exclude: (handlers, trigger) => handlers.onToggleExclude?.(Number(trigger.dataset.id), trigger),
  'pick-sort': (handlers, trigger) => handlers.onSortPick?.(trigger.value),
  'pick-category': (handlers, trigger) => handlers.onFilterPick?.({ category: trigger.dataset.value }),
  'pick-type': (handlers, trigger) => handlers.onFilterPick?.({ type: trigger.dataset.value }),
  'pick-budget': (handlers, trigger) => handlers.onFilterPick?.({ budget: trigger.dataset.value }),
  'pick-reset': (handlers) => handlers.onResetFilters?.(),
  close: (handlers) => handlers.onClose?.()
};

let activeAirdropHandlers = {};

/** Nghe sự kiện một lần trên container nên đổi bố cục không phải gắn lại listener */
function bindAirdropActions(container) {
  if (container.dataset.airdropBound === 'true') return;
  container.dataset.airdropBound = 'true';

  container.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger || !container.contains(trigger)) return;

    const run = ACTION_HANDLERS[trigger.dataset.action];
    if (!run || trigger.disabled) return;

    event.stopPropagation();
    if (trigger.dataset.action === 'close') dismissRewardOverlay(container, run);
    else run(activeAirdropHandlers, trigger);
  });

  container.addEventListener('change', (event) => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger || !container.contains(trigger)) return;

    event.stopPropagation();
    ACTION_HANDLERS[trigger.dataset.action]?.(activeAirdropHandlers, trigger);
  });

  // Gõ tên món cũng là một điều kiện lọc nên đi qua handler chung,
  // render lại chỉ vá phần pool nên không mất focus ô tìm kiếm
  container.addEventListener('input', (event) => {
    const input = event.target.closest('.airdrop-picked-search');
    if (!input || !container.contains(input)) return;

    activeAirdropHandlers.onSearchPick?.(input.value);
  });
}

/** Đổi cách sắp xếp danh sách xem trước rồi vẽ lại */
export function setAirdropPickSort(sort) {
  pickSort = Object.prototype.hasOwnProperty.call(PICK_SORT, sort) ? sort : 'ten-az';
  return pickSort;
}

/** Bật/tắt bộ lọc loại món, chay mặn và mức giá của hòm thính */
export function setAirdropPickFilter({ category, type, budget, keyword } = {}) {
  if (category) pickCategory = category;
  if (type) pickType = type;
  if (budget) pickBudget = budget;
  if (typeof keyword === 'string') pickKeyword = keyword;
  return { category: pickCategory, type: pickType, budget: pickBudget, keyword: pickKeyword };
}

/** Bỏ sạch mọi điều kiện lọc, hòm thính bốc lại toàn bộ danh sách */
export function resetAirdropFilters() {
  pickKeyword = '';
  pickCategory = 'tat-ca';
  pickType = 'tat-ca';
  pickBudget = 'tat-ca';
}

/** Thu thẻ quà về trước rồi mới đổi trạng thái, đóng không bị giật */
function dismissRewardOverlay(container, run) {
  const overlay = container.querySelector('.airdrop-reward-overlay');
  if (!overlay) {
    run(activeAirdropHandlers);
    return;
  }

  overlay.classList.add('is-closing');
  window.setTimeout(() => run(activeAirdropHandlers), 240);
}

function syncFavoriteButton(btn, isFavorite) {
  const label = isFavorite ? 'Bỏ yêu thích' : 'Lưu yêu thích';
  btn.classList.toggle('active', isFavorite);
  btn.textContent = isFavorite ? '❤️' : '🤍';
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.setAttribute('aria-pressed', String(isFavorite));
}

/* ===== Bộ lọc món cho hòm thính ===== */

const PICK_SORT = {
  'ten-az': (a, b) => a.name.localeCompare(b.name, 'vi'),
  'ten-za': (a, b) => b.name.localeCompare(a.name, 'vi'),
  'gia-tang': (a, b) => a.price - b.price,
  'gia-giam': (a, b) => b.price - a.price
};

/** Điều kiện lọc của hòm thính, giữ nguyên qua mỗi lần vẽ lại panel */
let pickKeyword = '';
let pickSort = 'ten-az';
let pickCategory = 'tat-ca';
let pickType = 'tat-ca';
let pickBudget = 'tat-ca';

function matchPickFilters(dish, keyword) {
  if (keyword) {
    const cleanK = removeVietnameseTones(keyword);
    const inName = removeVietnameseTones(dish.name).includes(cleanK);
    const inDesc = removeVietnameseTones(dish.desc || '').includes(cleanK);
    const inTags = (dish.tags || []).some(t => removeVietnameseTones(t).includes(cleanK));
    if (!inName && !inDesc && !inTags) return false;
  }
  if (pickCategory !== 'tat-ca' && pickCategory !== 'all') {
    const norm = normalizeCategory(pickCategory);
    const dishCat = normalizeCategory(dish.category);
    if (dishCat !== norm) return false;
  }
  if (pickType !== 'tat-ca' && pickType !== 'all') {
    if (String(dish.type).toLowerCase() !== String(pickType).toLowerCase()) return false;
  }

  if (pickBudget !== 'tat-ca' && pickBudget !== 'all') {
    const group = BUDGET_GROUPS.find(item => item.id === pickBudget);
    if (group && (dish.price < group.min || dish.price > group.max)) return false;
  }

  return true;
}

/**
 * Áp bộ lọc của hòm thính lên danh sách món ứng viên.
 * main.js dùng đúng hàm này để bốc món nên phần xem trước và phần rơi hòm
 * luôn khớp nhau.
 * @param {Array<Object>} dishes
 * @returns {Array<Object>}
 */
export function applyAirdropFilters(dishes) {
  if (!Array.isArray(dishes)) return [];
  const keyword = removeVietnameseTones(pickKeyword);
  return dishes.filter(dish => matchPickFilters(dish, keyword));
}

function renderFilterTabs(items, action, activeId) {
  return items.map(item => `
    <button type="button" class="airdrop-pick-tab${activeId === item.id ? ' is-active' : ''}" data-action="${action}" data-value="${item.id}" aria-pressed="${activeId === item.id}">
      <span aria-hidden="true">${item.icon}</span>${item.name}
    </button>
  `).join('');
}

/** Ba nhóm nút lọc: loại món, chay/mặn và mức giá */
function renderPickFilterTabs() {
  const budgetTabs = [{ id: 'tat-ca', name: 'Mọi mức giá', icon: '💰' }, ...BUDGET_GROUPS];

  return `
    <div class="airdrop-pick-filter">
      <span class="airdrop-pick-filter-label">Loại món</span>
      <div class="airdrop-pick-tabs">${renderFilterTabs(CATEGORIES, 'pick-category', pickCategory)}</div>
    </div>
    <div class="airdrop-pick-filter">
      <span class="airdrop-pick-filter-label">Chay hay mặn</span>
      <div class="airdrop-pick-tabs">${renderFilterTabs(DISH_TYPES, 'pick-type', pickType)}</div>
    </div>
    <div class="airdrop-pick-filter">
      <span class="airdrop-pick-filter-label">Mức giá</span>
      <div class="airdrop-pick-tabs">${renderFilterTabs(budgetTabs, 'pick-budget', pickBudget)}</div>
    </div>
  `;
}

function renderPickRows(dishes) {
  if (!dishes.length) {
    return '<p class="airdrop-picked-empty">Không có món nào khớp. Thử bỏ bớt điều kiện lọc.</p>';
  }

  return dishes.map(dish => {
    const type = DISH_TYPES.find(item => item.id === dish.type);
    return `
      <div class="airdrop-pick-row">
        <img class="airdrop-pick-thumb" src="${dish.image || dish.img}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${foodImageFallback('Món ăn')}';" />
        <span class="airdrop-pick-text">
          <span class="airdrop-pick-name">${dish.name}</span>
          <span class="airdrop-pick-meta">${getCategoryName(dish.category)}${type ? ` · ${type.name}` : ''}</span>
        </span>
        <span class="airdrop-pick-price">${formatCurrency(dish.price)}</span>
      </div>
    `;
  }).join('');
}

/** Vẽ lại danh sách xem trước, giữ nguyên ô tìm kiếm, bộ lọc và cách sắp xếp đang dùng */
function syncPickList(container, pool) {
  const listEl = container.querySelector('.airdrop-picked-list');
  const countEl = container.querySelector('.airdrop-picked-count');
  if (!listEl) return;

  const visible = [...pool].sort(PICK_SORT[pickSort] || PICK_SORT['ten-az']);

  listEl.innerHTML = renderPickRows(visible);
  listEl.classList.toggle('is-empty', visible.length === 0);

  if (countEl) countEl.textContent = `${pool.length} món`;

  syncPickFilterTabs(container);
}

/**
 * Dựng bộ lọc một lần rồi chỉ đổi trạng thái active, không dựng lại innerHTML
 * để không mất focus và không phá các tham chiếu đang giữ.
 */
function syncPickFilterTabs(container) {
  const filterEl = container.querySelector('.airdrop-picked-filters');
  if (!filterEl) return;

  if (!filterEl.querySelector('.airdrop-pick-tabs')) {
    filterEl.innerHTML = renderPickFilterTabs();
  }

  const rules = [
    ['pick-category', pickCategory],
    ['pick-type', pickType],
    ['pick-budget', pickBudget]
  ];

  rules.forEach(([action, activeId]) => {
    filterEl.querySelectorAll(`[data-action="${action}"]`).forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.value === activeId);
      btn.setAttribute('aria-pressed', String(btn.dataset.value === activeId));
    });
  });
}

function syncDismissButton(btn, isExcluded) {
  const label = isExcluded ? 'Cho món này quay lại hòm thính' : 'Bỏ món này khỏi hòm thính';
  btn.classList.toggle('is-active', isExcluded);
  btn.textContent = isExcluded ? '+' : '−';
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.setAttribute('aria-pressed', String(isExcluded));
}
/** Cập nhật nhanh phần thay đổi, giữ nguyên ảnh + animation đang chạy */
function patchPanel(container, { phase, status, isFavorite, isExcluded, basePool }) {
  const pool = applyAirdropFilters(basePool);
  const emptyPool = pool.length === 0;

  container.querySelector('.airdrop-scene').dataset.phase = phase;

  const statusEl = container.querySelector('.airdrop-status');
  if (statusEl) {
    statusEl.textContent = status;
    statusEl.classList.toggle('is-error', emptyPool);
  }

  const launchBtn = container.querySelector('[data-action="launch"]');
  if (launchBtn) {
    launchBtn.textContent = PHASE_LAUNCH_LABEL[phase] || PHASE_LAUNCH_LABEL.ready;
    launchBtn.disabled = emptyPool || (phase !== AIRDROP_PHASE.READY && phase !== AIRDROP_PHASE.REVEALED);
  }

  const poolCount = container.querySelector('.airdrop-pool-count');
  if (poolCount) poolCount.textContent = getPoolLabel(pool.length);

  container.querySelector('.airdrop-crate')?.toggleAttribute('disabled', phase !== AIRDROP_PHASE.DROPPED);

  const favBtn = container.querySelector('[data-action="fav"]');
  if (favBtn) syncFavoriteButton(favBtn, isFavorite);

  const dismissBtn = container.querySelector('[data-action="exclude"]');
  if (dismissBtn) syncDismissButton(dismissBtn, isExcluded);

  container.querySelector('.airdrop-reward-card')?.classList.toggle('is-dismissed', isExcluded);

  syncPickList(container, pool);
}

/**
 * Ghi nhớ ô tìm kiếm trước khi dựng lại panel, vì có thể nó đang được gõ
 * mà món đang mở rơi khỏi bộ lọc làm bố cục đổi hình dạng.
 * @returns {null | { value: string, start: number, end: number }}
 */
function captureSearchFocus(container) {
  const input = container.querySelector('.airdrop-picked-search');
  if (!input || document.activeElement !== input) return null;
  return { value: input.value, start: input.selectionStart, end: input.selectionEnd };
}

/** Đặt lại con trỏ vào ô tìm kiếm để người dùng gõ tiếp không bị mất */
function restoreSearchFocus(container, snapshot) {
  if (!snapshot) return;

  const input = container.querySelector('.airdrop-picked-search');
  if (!input) return;

  input.value = snapshot.value;
  input.focus();
  input.setSelectionRange(snapshot.start, snapshot.end);
}

/**
 * Render khu vực hòm thính: bắn pháo → máy bay thả hòm → mở hòm quay ra món
 * @param {HTMLElement} container - Container chứa panel
 * @param {Object} state - { phase, dish, message, basePool, isFavorite, isExcluded }
 * @param {Object} handlers - { onLaunch, onOpen, onViewDetail, onToggleFavorite, onToggleExclude, onSearchPick, onSortPick, onFilterPick, onResetFilters, onClose }
 */
export function renderAirdropPanel(container, state, handlers = {}) {
  if (!container) return;

  const {
    phase = AIRDROP_PHASE.READY,
    dish = null,
    message = '',
    basePool = [],
    isFavorite = false,
    isExcluded: isDishExcluded = false
  } = state;
  // Danh sách món ứng viên sau khi áp bộ lọc của hòm thính
  const pool = applyAirdropFilters(basePool);
  const canLaunch = phase === AIRDROP_PHASE.READY || phase === AIRDROP_PHASE.REVEALED;
  const emptyPool = pool.length === 0;
  const status = getAirdropStatus(phase, dish, message);
  const signature = sceneSignature(phase, dish);

  activeAirdropHandlers = handlers;
  bindAirdropActions(container);

  // Cùng bộ khung: chỉ vá phần thay đổi để không nháy ảnh hay cắt animation
  if (container.dataset.airdropSignature === signature) {
    patchPanel(container, { phase, status, isFavorite, isExcluded: isDishExcluded, basePool });
    return;
  }

  const searchFocus = captureSearchFocus(container);

  container.innerHTML = `
    <section class="airdrop-panel" aria-labelledby="airdrop-title">
      <header class="airdrop-heading">
        <span class="airdrop-kicker">SỰ KIỆN TRÊN BẦU TRỜI</span>
        <h1 id="airdrop-title">Hòm thính từ trên cao</h1>
        <p>Bắn pháo hiệu gọi máy bay, hòm rơi xuống rồi mở ra món ăn bất ngờ.</p>
      </header>

      ${renderScene(phase, dish, pool, isFavorite, isDishExcluded)}

      <div class="airdrop-controls">
        <p class="airdrop-status${emptyPool ? ' is-error' : ''}" role="status" aria-live="polite">${status}</p>
        <button type="button" class="airdrop-launch-button" data-action="launch" ${canLaunch && !emptyPool ? '' : 'disabled'}>
          ${PHASE_LAUNCH_LABEL[phase] || PHASE_LAUNCH_LABEL.ready}
        </button>
        <span class="airdrop-pool-count">${getPoolLabel(pool.length)}</span>
      </div>

      <section class="airdrop-picked">
        <header class="airdrop-picked-head">
          <div class="airdrop-picked-head-text">
            <h2 class="airdrop-picked-title">Lọc món trong hòm thính</h2>
            <p class="airdrop-picked-hint">Hòm chỉ rơi ra món khớp bộ lọc bên dưới. Dưới đây là những món sẽ được bốc.</p>
          </div>
          <span class="airdrop-picked-count" aria-live="polite">${pool.length} món</span>
        </header>

        <div class="airdrop-picked-filters" role="group" aria-label="Lọc món trong hòm thính theo loại, chay mặn và mức giá"></div>

        <div class="airdrop-picked-tools">
          <label class="airdrop-picked-search-wrap">
            <span class="airdrop-picked-search-icon" aria-hidden="true">🔍</span>
            <input
              type="search"
              class="airdrop-picked-search"
              placeholder="Tìm tên món..."
              aria-label="Tìm món sẽ rơi trong hòm thính"
              value="${pickKeyword}"
            />
          </label>
          <select class="airdrop-picked-sort" data-action="pick-sort" aria-label="Sắp xếp danh sách món">
            <option value="ten-az"${pickSort === 'ten-az' ? ' selected' : ''}>A → Z</option>
            <option value="ten-za"${pickSort === 'ten-za' ? ' selected' : ''}>Z → A</option>
            <option value="gia-tang"${pickSort === 'gia-tang' ? ' selected' : ''}>Giá thấp → cao</option>
            <option value="gia-giam"${pickSort === 'gia-giam' ? ' selected' : ''}>Giá cao → thấp</option>
          </select>
          <button type="button" class="airdrop-picked-clear" data-action="pick-reset">Bỏ lọc</button>
        </div>

        <div class="airdrop-picked-list" role="group" aria-label="Danh sách món sẽ rơi trong hòm thính"></div>
      </section>
    </section>
  `;

  container.dataset.airdropSignature = signature;
  syncPickList(container, pool);
  restoreSearchFocus(container, searchFocus);

  if (phase === AIRDROP_PHASE.OPENING) spinRoulette(container.querySelector('.airdrop-scene'));
}
