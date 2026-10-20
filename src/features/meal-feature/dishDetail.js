import { formatCurrency, getCategoryName } from './dishRender.js';
import { DISH_TYPES } from './filterUtils.js';
import { foodImageFallback } from './foodImages.js';
import { rarityOf } from './foodRarity.js';

/**
 * Tìm một món ăn theo ID
 * @param {Array} dishes - Danh sách món ăn
 * @param {number} id - ID món cần tìm
 * @returns {Object|null} Món ăn hoặc null nếu không tồn tại
 */
export function findDishById(dishes, id) {
    if (!dishes || !Array.isArray(dishes)) return null;
    const dishId = Number(id);
    return dishes.find(dish => dish.id === dishId) || null;
}

/**
 * Xếp hạng các món ăn tương tự với một món cho trước
 * Điểm = số tag chung (ưu tiên cao nhất) + cùng danh mục + cùng loại chay/mặn
 * @param {Array} dishes - Danh sách món ăn
 * @param {Object} dish - Món đang xem
 * @param {Array<number>} excludedIds - Các ID cần loại (món bị loại theo BR02)
 * @returns {Array<{dish: Object, score: number}>} Danh sách đã sắp xếp giảm dần
 */
function rankSimilarDishes(dishes, dish, excludedIds = []) {
    if (!dishes || !Array.isArray(dishes) || !dish) return [];

    const skipIds = new Set([dish.id, ...excludedIds.map(Number)]);
    const dishTags = new Set(dish.tags || []);

    return dishes
        .filter(candidate => !skipIds.has(candidate.id))
        .map(candidate => {
            const sharedTags = (candidate.tags || []).filter(tag => dishTags.has(tag)).length;
            const score =
                sharedTags * 2 +
                (candidate.category === dish.category ? 1 : 0) +
                (candidate.type === dish.type ? 0.5 : 0);
            return { dish: candidate, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);
}

/**
 * Lấy danh sách món tương tự đã sắp xếp
 * @param {Array} dishes - Danh sách món ăn
 * @param {Object} dish - Món đang xem
 * @param {Array<number>} excludedIds - Các ID cần loại
 * @param {number} limit - Số món tối đa
 * @returns {Array<Object>}
 */
export function getSimilarDishes(dishes, dish, excludedIds = [], limit = 6) {
    return rankSimilarDishes(dishes, dish, excludedIds)
        .slice(0, limit)
        .map(item => item.dish);
}

/**
 * Bốc ngẫu nhiên một món tương tự trong nhóm món tương tự nhất
 * @param {Array} dishes - Danh sách món ăn
 * @param {Object} dish - Món đang xem
 * @param {Array<number>} excludedIds - Các ID cần loại
 * @param {number} poolSize - Số món đưa vào "bể bốc" để vẫn giữ tính tương tự
 * @returns {Object|null} Món được bốc hoặc null nếu không có món tương tự
 */
export function pickRandomSimilar(dishes, dish, excludedIds = [], poolSize = 3) {
    const pool = rankSimilarDishes(dishes, dish, excludedIds).slice(0, poolSize);
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)].dish;
}

/**
 * Tạo nội dung chi tiết của một món ăn (F04)
 * @param {Object} dish - Món ăn
 * @param {boolean} isFavorite - Món này đang được yêu thích hay không
 * @param {string} notice - Thông báo phụ cần hiển thị (VD: không còn món tương tự)
 * @returns {string} HTML string
 */
function buildDetailContentHTML(dish, isFavorite, isExcluded, notice) {
    const type = DISH_TYPES.find(t => t.id === dish.type);
    const typeBadge = type
        ? `<span class="detail-badge ${dish.type === 'chay' ? 'detail-badge-chay' : 'detail-badge-man'}">${type.icon} ${type.name}</span>`
        : '';

    const tagsHTML = (dish.tags || [])
        .map(tag => `<span class="tag-chip">#${tag}</span>`)
        .join('');

    const noticeHTML = notice
        ? `<div class="detail-notice">${notice}</div>`
        : '';

    // Bậc hiếm suy ra từ giá, dùng chung với âm thanh lúc món lộ ra nên người dùng
    // thấy trước lý do tiếng vừa nghe "nặng" hay "nhẹ"
    const rarity = rarityOf(dish);

    return `
    <div class="detail-badges">
      <span class="detail-badge">🍽️ ${getCategoryName(dish.category)}</span>
      ${typeBadge}
      <span class="detail-badge detail-badge-rarity" data-rarity="${rarity.id}">${rarity.icon} ${rarity.label}</span>
    </div>
    <h2 class="detail-name" id="dish-detail-name">${dish.name}</h2>
    <p class="detail-price">${formatCurrency(dish.price)}</p>
    <p class="detail-desc">${dish.description}</p>
    <div class="detail-tags">${tagsHTML}</div>
    ${noticeHTML}
    <div class="detail-actions">
    <button type="button" class="btn-detail-fav ${isFavorite ? 'active' : ''}" data-action="fav" aria-pressed="${isFavorite}">
      ${isFavorite ? '❤️ Đã yêu thích' : '🤍 Yêu thích'}
    </button>

    <button type="button" class="btn-detail-exclude ${isExcluded ? 'active' : ''}" data-action="exclude" aria-pressed="${isExcluded}">
    ${isExcluded ? '↩️ Bỏ không thích' : '🚫 Không thích'}
    </button>

    <button type="button" class="btn-detail-similar" data-action="similar">
      🎲 Bốc món tương tự
    </button>
    </div>
  `;
}

/**
 * Render trang chi tiết món ăn dạng modal (F04)
 * @param {HTMLElement} containerEl - Container chứa modal
 * @param {Object} dish - Món ăn cần hiển thị
 * @param {Object} handlers - { isFavorite, notice, onClose, onToggleFavorite, onSimilar }
 */
/**
 * Lớp ăn mừng phủ lên modal khi món vừa được bốc trúng.
 * Dùng emoji và CSS thuần nên không tốn thêm tài nguyên ảnh.
 * @returns {string} HTML string
 */
function buildCelebrationHTML() {
    const pieces = ['🍜', '🌶️', '🥢', '✨', '🍚', '🥟', '💛', '🌟'];
    const items = Array.from({ length: 18 }, (_, i) => {
        const piece = pieces[i % pieces.length];
        const left = (i / 18) * 100;
        const drift = ((i * 41) % 70) - 35;
        const delay = ((i * 47) % 50) / 100;
        return `<span class="roll-confetti-piece" style="left:${left.toFixed(1)}%;--confetti-x:${drift}px;--confetti-delay:${delay.toFixed(2)}s">${piece}</span>`;
    }).join('');

    return `
    <div class="modal-celebrate" aria-hidden="true">
      <span class="roll-rays"></span>
      <span class="roll-shock"></span>
      <span class="roll-shock roll-shock--two"></span>
      <div class="roll-confetti">${items}</div>
    </div>
  `;
}

/**
 * Render modal chi tiết món
 * @param {HTMLElement} containerEl - Container chứa modal
 * @param {Object} dish - Món cần hiển thị
 * @param {Object} handlers - { isFavorite, isExcluded, notice, celebrate, onClose, onToggleFavorite, onExclude, onSimilar }
 */
export function renderDishDetail(containerEl, dish, handlers = {}) {
    if (!containerEl) return;

    if (!dish) {
        containerEl.innerHTML = '';
        return;
    }

    const {
        isFavorite = false,
        isExcluded = false,
        notice = '',
        celebrate = false,
        onClose,
        onToggleFavorite,
        onExclude,
        onSimilar
    } = handlers;

    containerEl.innerHTML = `
    <div class="modal-overlay active${celebrate ? ' is-celebrate' : ''}" id="dish-detail-overlay">
      ${celebrate ? buildCelebrationHTML() : ''}
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="dish-detail-name">
        ${celebrate ? '<span class="modal-celebrate-badge">🎉 VỪA BỐC TRÚNG</span>' : ''}
        <button type="button" class="modal-close" data-action="close" aria-label="Đóng chi tiết món">✕</button>
        <img
          class="modal-image"
          src="${dish.image}"
          alt="${dish.name}"
          onerror="this.onerror=null;this.src='${foodImageFallback('Ảnh lỗi')}';"
        />
        <div class="modal-content">
          ${buildDetailContentHTML(dish, isFavorite, isExcluded, notice)}
        </div>
      </div>
    </div>
  `;

    const overlay = containerEl.querySelector('#dish-detail-overlay');

    overlay.addEventListener('click', (e) => {
        // Chỉ đóng khi bấm ra vùng nền bên ngoài, không đóng khi bấm bên trong thẻ
        if (e.target === overlay && onClose) onClose();
    });

    const favBtn = containerEl.querySelector('[data-action="fav"]');
    if (favBtn) {
        favBtn.addEventListener('click', () => onToggleFavorite && onToggleFavorite());
    }

    const excludeBtn = containerEl.querySelector('[data-action="exclude"]');
    if (excludeBtn) {
        excludeBtn.addEventListener('click', () => onExclude && onExclude());
    }

    const similarBtn = containerEl.querySelector('[data-action="similar"]');
    if (similarBtn) {
        similarBtn.addEventListener('click', () => onSimilar && onSimilar());
    }

    const closeBtn = containerEl.querySelector('[data-action="close"]');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => onClose && onClose());
    }
}

