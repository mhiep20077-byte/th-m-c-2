import { formatCurrency, getCategoryName } from './dishRender.js';
import { DISH_TYPES } from './filterUtils.js';
import { BUDGET_GROUPS } from './priceFilter.js';
import { foodImageFallback } from './foodImages.js';

/* ===== Khung bữa ăn ===== */

/**
 * Bốn suất ăn của một bữa cơm. Mỗi suất lấy món từ nhóm danh mục / tag riêng
 * để bữa ăn luôn có đủ món chính, món ăn kèm, thứ uống và điểm ngọt.
 *
 * `savoryDecisive` đánh dấu suất quyết định bữa ăn là mặn hay chay. Trà sữa, nước dừa,
 * chè đậu... vốn dĩ không có thịt nên đồ uống và tráng miệng không bị ép vào chế độ mặn,
 * hai suất này luôn để mở cho tự nhiên.
 *
 * `excludeCategories` / `excludeTags` là điều kiện loại cứng, áp cho cả đường chính
 * lẫn đường `fallback`. Nhờ vậy một món không thể lọt vào suất ăn sai dù sau này có
 * nới tiêu chí ra sao: suất tráng miệng không bao giờ ra đồ uống, suất ăn kèm không
 * bao giờ ra món ngọt vì món ngọt đã thuộc suất tráng miệng.
 */

/** Tag đánh dấu món ngọt, dùng chung cho suất tráng miệng và các suất loại trừ */
const DESSERT_TAGS = ['ngot-ngao'];

/** Danh mục chứa món tráng miệng, dùng chung cho suất tráng miệng và các suất loại trừ */
const DESSERT_CATEGORY = 'mon-ngot';

export const MEAL_COURSES = [
  {
    id: 'main',
    name: 'Món chính',
    icon: '🍚',
    hint: 'Món quyết định bữa ăn',
    categories: ['mon-com', 'mon-nuoc', 'mon-kho'],
    savoryDecisive: true
  },
  {
    id: 'side',
    name: 'Ăn kèm',
    icon: '🥗',
    hint: 'Món ăn đỡ ngán',
    categories: ['an-vat', 'mon-kho'],
    excludeCategories: [DESSERT_CATEGORY],
    excludeTags: DESSERT_TAGS,
    savoryDecisive: true
  },
  {
    id: 'drink',
    name: 'Đồ uống',
    icon: '🥤',
    hint: 'Thứ uống cho trọn bữa',
    categories: ['do-uong'],
    excludeCategories: [DESSERT_CATEGORY],
    excludeTags: DESSERT_TAGS
  },
  {
    id: 'sweet',
    name: 'Tráng miệng',
    icon: '🍮',
    hint: 'Chè hoặc món ngọt cuối bữa',
    categories: [DESSERT_CATEGORY],
    tags: DESSERT_TAGS,
    // Trà sữa, trà tắc, sinh tố đều mang tag giai-khat hoặc thanh-mat nên nếu mở
    // rộng theo tag là bữa sẽ ra đồ uống ở ô tráng miệng. Khoá luôn danh mục đồ uống ra.
    excludeCategories: ['do-uong'],
    // Hết món ngọt thì nhận món ăn vặt thường, vẫn hơn là lấy bừa ly nước.
    fallback: { categories: ['mon-ngot', 'an-vat'] }
  }
];

/** Suất ăn có quyền ép chế độ mặn, dùng để gọi tên bữa sau khi dọn */
const DECISIVE_COURSES = MEAL_COURSES.filter(course => course.savoryDecisive);

/** Trạng thái một ô đựng món trên khay */
export const MEAL_SLOT = {
  EMPTY: 'empty',
  ROLLING: 'rolling',
  FILLED: 'filled'
};

/** Trạng thái cả bữa ăn */
export const MEAL_PHASE = {
  BUILDING: 'building',
  SERVING: 'serving',
  SERVED: 'served'
};

/** Thời lượng lắc hộp và dọn món, phải khớp với keyframe trong style.css */
export const MEAL_TIMING = {
  RATTLE: 820,
  REVEAL: 850,
  SERVE: 900
};

/** Ngưỡng giá để kết luận bữa ăn rẻ hay sang */
const VERDICTS = [
  { max: 70000, icon: '🪙', label: 'Tiết kiệm', note: 'Nhẹ bụng mà vẫn đủ bốn món.' },
  { max: 130000, icon: '🙂', label: 'Vừa túi tiền', note: 'Hợp lý cho một bữa nhiều món.' },
  { max: 220000, icon: '😋', label: 'Ăn ngon', note: 'Đã là một bữa nổi bật rồi.' },
  { max: Infinity, icon: '👑', label: 'Ăn sang', note: 'Cả nhà ăn no là đủ luôn.' }
];

/* ===== Chọn món theo suất ===== */

/** Chế độ ưu tiên khi bốc món: tự do, bữa chay hay bữa mặn */
export const MEAL_PREFERENCE = {
  ALL: 'all',
  VEGETARIAN: 'chay',
  SAVORY: 'man'
};

/**
 * Danh sách chế độ ưu tiên, dùng để dựng thanh chọn và bảng màu của panel
 */
export const MEAL_PREFERENCES = [
  { id: MEAL_PREFERENCE.ALL, icon: '🍽️', name: 'Tất cả', hint: 'Bốc tự do mọi món' },
  { id: MEAL_PREFERENCE.VEGETARIAN, icon: '🥗', name: 'Bữa chay', hint: 'Ưu tiên món chay' },
  { id: MEAL_PREFERENCE.SAVORY, icon: '🍖', name: 'Bữa mặn', hint: 'Ưu tiên món mặn' }
];

/** Chú thích hiện dưới thanh chọn, đổi theo chế độ để người dùng biết phạm vi áp dụng */
const PREFERENCE_NOTES = {
  [MEAL_PREFERENCE.ALL]: 'Mọi món trong bộ lọc hiện tại đều có thể lên bàn.',
  [MEAL_PREFERENCE.VEGETARIAN]: 'Món chính và món ăn kèm sẽ ưu tiên món chay.',
  [MEAL_PREFERENCE.SAVORY]: 'Món chính và món ăn kèm sẽ ưu tiên món mặn. Đồ uống và tráng miệng vẫn tự do vì vốn vốn không có thịt.'
};

function isVegetarian(dish) {
  return String(dish.type).toLowerCase() === 'chay';
}

/** Món có đúng kiểu ăn đang ưu tiên không */
export function matchesPreference(dish, preference) {
  if (preference === MEAL_PREFERENCE.VEGETARIAN) return isVegetarian(dish);
  if (preference === MEAL_PREFERENCE.SAVORY) return !isVegetarian(dish);
  return true;
}

/**
 * Suất ăn có bị ép theo chế độ chay/mặn không.
 * Đồ uống và tráng miệng vốn không bị ép nên đổi chế độ cũng không phải dọn ô đó.
 * @param {string} courseId - Id suất ăn
 * @returns {boolean}
 */
export function isPreferenceBoundCourse(courseId) {
  return Boolean(MEAL_COURSES.find(course => course.id === courseId)?.savoryDecisive);
}

/* ===== Lọc mức giá cho bữa ăn ===== */

/** Chế độ không giới hạn mức giá, dùng chung id với bộ lọc ở trang Khám phá */
export const MEAL_BUDGET_ALL = 'tat-ca';

/**
 * Các mức giá của bữa ăn. Lấy thẳng BUDGET_GROUPS ở priceFilter.js để mốc 20k / 40k / 70k
 * luôn giống nhau giữa trang Khám phá, hòm thính và bữa ăn, không phải khai báo lần nữa.
 */
export const MEAL_BUDGETS = [
  { id: MEAL_BUDGET_ALL, name: 'Mọi mức giá', icon: '💰' },
  ...BUDGET_GROUPS
];

/**
 * Nhóm giá đang chọn, luôn trả về một nhóm hợp lệ để không phải kiểm tra null ở nơi dùng.
 * @param {string} budgetId
 * @returns {Object}
 */
export function getMealBudgetGroup(budgetId) {
  return MEAL_BUDGETS.find(item => item.id === budgetId) || MEAL_BUDGETS[0];
}

/** Món có nằm trong mức giá đang chọn không */
export function matchesBudget(dish, budgetId) {
  const group = getMealBudgetGroup(budgetId);
  if (group.id === MEAL_BUDGET_ALL) return true;
  return dish.price >= group.min && dish.price < group.max;
}

/**
 * Lọc pool món theo mức giá của bữa ăn. Dùng đúng hàm này ở cả phần dựng khay
 * và phần bốc món nên món hiện trên khay luôn nằm trong mức giá đang chọn.
 * @param {Array<Object>} dishes
 * @param {string} budgetId
 * @returns {Array<Object>}
 */
export function applyMealBudget(dishes, budgetId) {
  if (!Array.isArray(dishes)) return [];
  const group = getMealBudgetGroup(budgetId);
  if (group.id === MEAL_BUDGET_ALL) return dishes;
  return dishes.filter(dish => matchesBudget(dish, group.id));
}

/** Chú thích dưới thanh mức giá, đổi theo mức đang chọn */
const BUDGET_NOTES = {
  [MEAL_BUDGET_ALL]: 'Không giới hạn giá, bữa ăn bốc được mọi món đang mở.',
  'sinh-ton': 'Chỉ món dưới 20k, hợp bữa ăn tiết kiệm.',
  'sinh-vien': 'Chỉ món từ 20k đến dưới 40k, hợp túi tiền sinh viên.',
  'an-ngon': 'Chỉ món từ 40k đến dưới 70k, ưu tiên chất lượng hơn.',
  'choi-lon': 'Món từ 70k trở lên, bữa ăn thịt nhiều hơn.'
};

/**
 * Món ứng viên cho một suất, đã loại món đang có trên khay để không lặp món.
 * Nếu suất ăn quá hiếm món thì nới sang tiêu chí `fallback` để bữa vẫn dọn được.
 *
 * Điều kiện loại của suất ăn (`excludeCategories`, `excludeTags`) luôn được áp cho cả
 * đường chính lẫn `fallback`, vì vậy suất tráng miệng không thể ra đồ uống dù tiêu chí
 * fallback có nới rộng đến đâu.
 * @param {Array<Object>} pool - Pool món sau khi áp bộ lọc và loại trừ món đã bỏ
 * @param {Object} course - Suất ăn trong MEAL_COURSES
 * @param {Array<Object>} currentDishes - Các món đang nằm trên khay
 * @returns {Array<Object>}
 */
export function getCourseCandidates(pool, course, currentDishes = []) {
  if (!Array.isArray(pool) || !course) return [];

  const taken = new Set(currentDishes.map(dish => dish.id));
  const available = pool.filter(dish => !taken.has(dish.id));

  // Loại của suất ăn là điều kiện cứng, gộp thêm loại riêng của từng bộ tiêu chí
  const bannedCategories = course.excludeCategories || [];
  const bannedTags = course.excludeTags || [];

  const match = (rules) => {
    const skipCategories = [...bannedCategories, ...(rules.excludeCategories || [])];
    const skipTags = [...bannedTags, ...(rules.excludeTags || [])];
    return available.filter(dish => {
      if (rules.categories && !rules.categories.includes(dish.category)) return false;
      if (skipCategories.includes(dish.category)) return false;
      if (rules.tags && !(dish.tags || []).some(tag => rules.tags.includes(tag))) return false;
      if (skipTags.some(tag => (dish.tags || []).includes(tag))) return false;
      return true;
    });
  };

  let matched = match(course);
  if (matched.length === 0 && course.fallback) matched = match(course.fallback);
  if (matched.length === 0) return [];

  // Tráng miệng thường có món chay dễ ăn hơn nên xếp món chay lên trước,
  // bốc ngẫu nhiên trên danh sách này vẫn có thể ra món mặn nếu bữa đang là bữa mặn
  if (course.id === 'sweet' && matched.some(isVegetarian)) {
    return [...matched.filter(isVegetarian), ...matched.filter(dish => !isVegetarian(dish))];
  }

  return matched;
}

/**
 * Bốc một món ngẫu nhiên cho suất ăn.
 * Chế độ ưu tiên chỉ lọc trong khoảng ứng viên hợp lệ của suất ăn, nếu không có
 * món nào đúng kiểu thì vẫn bốc từ khoảng ứng viên còn lại chứ không bỏ trống suất.
 * Suất không phải `savoryDecisive` (đồ uống, tráng miệng) luôn bỏ qua chế độ ưu tiên.
 * @param {Array<Object>} pool - Pool món hiện tại
 * @param {Object} course - Suất ăn cần bốc
 * @param {Array<Object>} currentDishes - Các món đang nằm trên khay
 * @param {string} preference - MEAL_PREFERENCE
 * @returns {Object|null} Món được chọn, null nếu suất ăn không còn món phù hợp
 */
export function pickCourseDish(pool, course, currentDishes = [], preference = MEAL_PREFERENCE.ALL) {
  const candidates = getCourseCandidates(pool, course, currentDishes);
  if (candidates.length === 0) return null;

  const applyPreference = course?.savoryDecisive && preference !== MEAL_PREFERENCE.ALL;
  const preferred = applyPreference ? candidates.filter(dish => matchesPreference(dish, preference)) : candidates;
  const source = preferred.length > 0 ? preferred : candidates;

  return source[Math.floor(Math.random() * source.length)];
}

/**
 * Bữa vừa dọn thuộc kiểu nào, chỉ xét các suất quyết định (món chính và ăn kèm).
 * Trà sữa hay ly chè không làm một bữa bị tính nhầm sang "đa dạng".
 */
export function getMealKind(dishes) {
  const decisive = DECISIVE_COURSES
    .map(course => (dishes || [])[MEAL_COURSES.indexOf(course)])
    .filter(Boolean);

  if (decisive.length === 0) return null;
  if (decisive.every(isVegetarian)) return MEAL_PREFERENCE.VEGETARIAN;
  if (decisive.every(dish => !isVegetarian(dish))) return MEAL_PREFERENCE.SAVORY;
  return MEAL_PREFERENCE.ALL;
}

/** Nhận định mức giá của cả bữa */
export function getMealVerdict(total) {
  return VERDICTS.find(item => total <= item.max) || VERDICTS[VERDICTS.length - 1];
}

/** Bữa ăn có trọn bốn suất chưa */
export function isMealComplete(dishes) {
  return Array.isArray(dishes) && dishes.filter(Boolean).length === MEAL_COURSES.length;
}

/** Tổng giá của các món đang nằm trên khay */
export function getMealTotal(dishes) {
  if (!Array.isArray(dishes)) return 0;
  return dishes.filter(Boolean).reduce((sum, dish) => sum + (dish.price || 0), 0);
}

/**
 * Tạo state ban đầu của khay: mỗi suất ăn một ô trống.
 * @returns {Object}
 */
export function createMealState() {
  return {
    phase: MEAL_PHASE.BUILDING,
    slots: MEAL_COURSES.map(course => ({ courseId: course.id, dish: null })),
    rollingCourseId: null,
    preference: MEAL_PREFERENCE.ALL,
    budget: MEAL_BUDGET_ALL,
    servedMeal: null
  };
}

/** Lấy danh sách món đang nằm trên khay, bỏ qua ô trống */
export function getFilledDishes(state) {
  if (!state || !Array.isArray(state.slots)) return [];
  return state.slots.map(slot => slot.dish).filter(Boolean);
}

/* ===== Giao diện ===== */

function getTypeBadge(dish) {
  const type = DISH_TYPES.find(item => item.id === dish.type);
  if (!type) return '';
  return `<span class="meal-slot-badge meal-slot-badge--${type.id}">${type.icon} ${type.name}</span>`;
}

/** Vòng sáng quanh ô lúc món vừa lộ ra */
function renderBurst() {
  return `
    <span class="meal-slot-burst" aria-hidden="true">
      ${Array.from({ length: 10 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}
    </span>
  `;
}

/**
 * Một ô trên khay: ô trống gọi mời bấm, ô đang lắc hiện dải tên món chạy qua,
 * ô đã có món hiện ảnh + giá + nút xem chi tiết, ô không có món nào hợp lệ thì báo tắt.
 * @param {Object} slot - { courseId, dish }
 * @param {Object} state - State bữa ăn, gồm cả rollingCourseId và pool
 * @returns {string} HTML string
 */
function renderSlotHTML(slot, state, index = 0) {
  const course = MEAL_COURSES.find(item => item.id === slot.courseId);
  if (!course) return '';

  const isRolling = state.rollingCourseId === course.id;
  const dish = slot.dish;
  const otherDishes = getFilledDishes(state).filter(item => item.id !== dish?.id);

  if (isRolling) {
    const candidates = getCourseCandidates(state.pool || [], course, otherDishes);
    const names = candidates.length > 0
      ? Array.from({ length: 12 }, (_, i) => candidates[i % candidates.length].name)
      : Array(12).fill('…');

    return `
      <div class="meal-slot meal-slot--rolling" data-course="${course.id}" aria-live="polite">
        <span class="meal-slot-label">${course.icon} ${course.name}</span>
        <div class="meal-slot-roll">
          <div class="meal-slot-reel">
            ${names.map(name => `<span>${name}</span>`).join('')}
          </div>
          <span class="meal-slot-roll-fade" aria-hidden="true"></span>
        </div>
        <span class="meal-slot-hint">Đang lắc hộp...</span>
      </div>
    `;
  }

  // Bộ lọc hiện tại không còn món nào cho suất ăn này, đừng bắt người dùng bấm vô ích
  if (!dish && getCourseCandidates(state.pool || [], course, otherDishes).length === 0) {
    return `
      <div class="meal-slot meal-slot--unavailable" data-course="${course.id}">
        <span class="meal-slot-label">${course.icon} ${course.name}</span>
        <span class="meal-slot-icon" aria-hidden="true">🚫</span>
        <span class="meal-slot-hint">Bộ lọc hiện tại không có món cho suất này</span>
      </div>
    `;
  }

  if (!dish) {
    return `
      <button
        type="button"
        class="meal-slot meal-slot--empty"
        data-action="roll"
        data-course="${course.id}"
        aria-label="Bốc món cho suất ${course.name}"
      >
        <span class="meal-slot-icon" aria-hidden="true">${course.icon}</span>
        <span class="meal-slot-label">${course.name}</span>
        <span class="meal-slot-hint">${course.hint}</span>
        <span class="meal-slot-roll-btn">🎲 Bốc món</span>
      </button>
    `;
  }

  return `
    <article
      class="meal-slot meal-slot--filled${state.revealedCourseId === course.id ? ' meal-slot--pop' : ''}"
      data-course="${course.id}"
      style="--i:${index}"
    >
      <span class="meal-slot-label">${course.icon} ${course.name}</span>
      <div class="meal-slot-media">
        <img src="${dish.image}" alt="${dish.name}" loading="lazy" onerror="this.onerror=null;this.src='${foodImageFallback(dish.name)}';" />
        ${getTypeBadge(dish)}
      </div>
      <h3 class="meal-slot-name">${dish.name}</h3>
      <p class="meal-slot-meta">${getCategoryName(dish.category)}</p>
      <span class="meal-slot-price">${formatCurrency(dish.price)}</span>
      ${state.revealedCourseId === course.id ? renderBurst() : ''}
      <div class="meal-slot-actions">
        <button type="button" class="meal-slot-mini" data-action="detail" data-id="${dish.id}">Chi tiết</button>
        <button type="button" class="meal-slot-mini" data-action="roll" data-course="${course.id}">🔁 Bốc lại</button>
      </div>
    </article>
  `;
}

/** Thanh tổng tiền + nhận định ngân sách của bữa */
function renderTrayFooterHTML(dishes, isServing = false) {
  const total = getMealTotal(dishes);
  const verdict = getMealVerdict(total);
  const filled = dishes.filter(Boolean).length;
  const percent = Math.round((filled / MEAL_COURSES.length) * 100);

  return `
    <div class="meal-tray-foot">
      <div class="meal-tray-ring" style="--percent:${percent}" role="img" aria-label="Đã dựng ${filled} trên ${MEAL_COURSES.length} món">
        <span class="meal-tray-ring-core">
          <strong>${filled}<i>/${MEAL_COURSES.length}</i></strong>
          <em>món</em>
        </span>
      </div>
      <div class="meal-tray-steps" role="group" aria-label="Tiến độ dựng bữa ăn">
        ${MEAL_COURSES.map((course, index) => `
          <span class="meal-tray-step${dishes[index] ? ' is-done' : ''}" title="${course.name}">
            <i aria-hidden="true">${dishes[index] ? '✓' : course.icon}</i>
            <span>${course.name}</span>
          </span>
        `).join('')}
      </div>
      <div class="meal-tray-total">
        <span class="meal-tray-total-label">Tổng tiền</span>
        <strong class="meal-tray-total-value" data-role="total">${formatCurrency(total)}</strong>
        <span class="meal-tray-verdict">${verdict.icon} ${verdict.label}</span>
      </div>
    </div>
    <p class="meal-tray-hint" role="status" aria-live="polite">
      ${isServing
        ? 'Đang dọn món lên bàn...'
        : isMealComplete(dishes)
          ? 'Đủ bốn món rồi, bấm <b>Dọn món</b> để dọn bữa lên bàn.'
          : 'Bấm từng ô trên khay để bốc món, hoặc bấm <b>Bốc trọn bữa</b> để dựng nhanh cả bữa.'}
    </p>
  `;
}

/** Nhãn bàu trời cho kiểu bữa vừa dọn */
const MEAL_KIND_LABEL = {
  [MEAL_PREFERENCE.VEGETARIAN]: { kicker: '🥗 BỮA CHAY', title: 'Bữa chay đã dọn lên bàn' },
  [MEAL_PREFERENCE.SAVORY]: { kicker: '🍖 BỮA MẶN', title: 'Bữa mặn đã dọn lên bàn' },
  [MEAL_PREFERENCE.ALL]: { kicker: '🍽️ BỮA ĐA DẠNG', title: 'Bữa ăn đã dọn lên bàn' }
};

/** Lớp phủ khi dọn món xong: tia nắng, hơi nước và giấy phiếu bữa ăn */
function renderServedHTML(meal) {
  const verdict = getMealVerdict(meal.total);
  const kind = getMealKind(meal.dishes);
  const label = MEAL_KIND_LABEL[kind] || MEAL_KIND_LABEL[MEAL_PREFERENCE.ALL];
  const budgetGroup = getMealBudgetGroup(meal.budget);

  return `
    <div class="meal-served meal-served--${kind}" role="dialog" aria-label="Bữa ăn đã dọn">
      <div class="meal-served-backdrop" aria-hidden="true"></div>
      <div class="meal-served-card">
        <div class="meal-served-glow" aria-hidden="true"></div>
        <div class="meal-served-rays" aria-hidden="true"></div>
        <div class="meal-served-steam" aria-hidden="true">
          <i style="--i:0"></i><i style="--i:1"></i><i style="--i:2"></i>
        </div>
        <div class="meal-served-confetti" aria-hidden="true">
          ${Array.from({ length: 16 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}
        </div>

        <button type="button" class="meal-served-close" data-action="close-served" aria-label="Đóng bảng bữa ăn">✕</button>

        <span class="meal-served-kicker">${label.kicker}</span>
        <h2 class="meal-served-title">${label.title}</h2>

        <ul class="meal-served-list">
          ${MEAL_COURSES.map((course, index) => {
            const dish = meal.dishes[index];
            if (!dish) return '';
            return `
              <li class="meal-served-row">
                <span class="meal-served-thumb">
                  <img src="${dish.image}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${foodImageFallback(dish.name)}';" />
                </span>
                <span class="meal-served-course">${course.icon} ${course.name}</span>
                <span class="meal-served-dish">
                  <button type="button" class="meal-served-name" data-action="detail" data-id="${dish.id}">${dish.name}</button>
                  ${getTypeBadge(dish)}
                </span>
                <span class="meal-served-price">${formatCurrency(dish.price)}</span>
              </li>
            `;
          }).join('')}
        </ul>

        <div class="meal-served-foot">
          <div class="meal-served-total">
            <span>Tổng cộng</span>
            <strong>${formatCurrency(meal.total)}</strong>
          </div>
          <p class="meal-served-verdict">${verdict.icon} <b>${verdict.label}</b> — ${verdict.note}</p>
          <p class="meal-served-budget">${budgetGroup.icon} Mức giá đã dùng: <b>${budgetGroup.name}</b></p>
        </div>

        <div class="meal-served-actions">
          <button type="button" class="meal-btn meal-btn--primary" data-action="new">🍳 Dọn bữa mới</button>
          <button type="button" class="meal-btn" data-action="close-served">Xem lại trên khay</button>
        </div>
      </div>
    </div>
  `;
}

/** Sổ những bữa đã dọn, mới nhất trước */
function renderBookHTML(meals) {
  if (!Array.isArray(meals) || meals.length === 0) return '';

  return `
    <section class="meal-book">
      <h3 class="meal-book-title">📔 Sổ bữa đã dọn</h3>
      <ul class="meal-book-list">
        ${meals.slice(0, 6).map(meal => `
          <li class="meal-book-item">
            <span class="meal-book-time">${new Date(meal.at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span>
            <span class="meal-book-names">${meal.dishes.map(dish => dish.name).join(' · ')}</span>
            <span class="meal-book-total">${formatCurrency(meal.total)}</span>
          </li>
        `).join('')}
      </ul>
    </section>
  `;
}

/* ===== Hiệu ứng ===== */

/** Đếm tiền tăng dần thay vì nhảy thẳng, nghe sớm hơn giá */
function animateTotal(el, from, to) {
  if (!el) return;
  if (from === to) {
    el.textContent = formatCurrency(to);
    return;
  }

  const startedAt = performance.now();
  const duration = 420;
  const step = (now) => {
    const progress = Math.min((now - startedAt) / duration, 1);
    // easeOutCubic cho cảm giác tiền chạy nhanh rồi đứng lại
    const eased = 1 - (1 - progress) ** 3;
    el.textContent = formatCurrency(Math.round(from + (to - from) * eased));
    if (progress < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

/* ===== Panel ===== */

const ACTION_HANDLERS = {
  roll: (handlers, trigger) => handlers.onRollCourse?.(trigger.dataset.course),
  'roll-all': (handlers) => handlers.onRollAll?.(),
  serve: (handlers) => handlers.onServe?.(),
  new: (handlers) => handlers.onNewMeal?.(),
  'close-served': (handlers) => handlers.onCloseServed?.(),
  pref: (handlers, trigger) => handlers.onSetPreference?.(trigger.dataset.pref),
  budget: (handlers, trigger) => handlers.onSetBudget?.(trigger.dataset.budget),
  detail: (handlers, trigger) => handlers.onViewDetail?.(Number(trigger.dataset.id), trigger)
};

let activeMealHandlers = {};

/** Nghe sự kiện một lần trên container nên đổi bố cục không phải gắn lại listener */
function bindMealActions(container) {
  if (container.dataset.mealBound === 'true') return;
  container.dataset.mealBound = 'true';

  container.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger || !container.contains(trigger)) return;

    const run = ACTION_HANDLERS[trigger.dataset.action];
    if (!run || trigger.disabled) return;

    event.stopPropagation();
    run(activeMealHandlers, trigger);
  });

  // Nút bên trong khay không phải nút chính nên bỏ qua tiếng tap toàn cục
  container.addEventListener('mouseover', (event) => {
    const trigger = event.target.closest('.meal-slot--empty, .meal-pref-opt, .meal-budget-tab');
    if (!trigger || !container.contains(trigger)) return;

    if (trigger._mealSoundPlayed) return;
    trigger._mealSoundPlayed = true;
    window.setTimeout(() => { trigger._mealSoundPlayed = false; }, 120);
    activeMealHandlers.onHover?.();
  });
}

/** Thanh chọn 3 chế độ: tất cả / bữa chay / bữa mặn */
function renderPreferenceHTML(preference) {
  return `
    <div class="meal-pref" role="radiogroup" aria-label="Kiểu bữa ăn muốn ưu tiên">
      <span class="meal-pref-thumb" aria-hidden="true"></span>
      ${MEAL_PREFERENCES.map(item => `
        <button
          type="button"
          class="meal-pref-opt${item.id === preference ? ' is-active' : ''}"
          role="radio"
          aria-checked="${item.id === preference}"
          data-action="pref"
          data-pref="${item.id}"
          title="${item.hint}"
        >${item.icon} ${item.name}</button>
      `).join('')}
    </div>
    <p class="meal-pref-note">${PREFERENCE_NOTES[preference] || PREFERENCE_NOTES[MEAL_PREFERENCE.ALL]}</p>
  `;
}

/** Thanh chọn mức giá cho bữa ăn, dùng chung nhóm giá với trang Khám phá món */
function renderBudgetHTML(budget) {
  const group = getMealBudgetGroup(budget);

  return `
    <div class="meal-budget">
      <span class="meal-budget-label" id="meal-budget-label">💰 Mức giá</span>
      <div class="meal-budget-tabs" role="radiogroup" aria-labelledby="meal-budget-label">
        ${MEAL_BUDGETS.map(item => `
          <button
            type="button"
            class="meal-budget-tab${item.id === group.id ? ' is-active' : ''}"
            role="radio"
            aria-checked="${item.id === group.id}"
            data-action="budget"
            data-budget="${item.id}"
            title="${item.name}"
          ><span aria-hidden="true">${item.icon}</span>${item.name}</button>
        `).join('')}
      </div>
      <p class="meal-budget-note">${BUDGET_NOTES[group.id] || BUDGET_NOTES[MEAL_BUDGET_ALL]}</p>
    </div>
  `;
}

/**
 * Mã định danh một khung hình của khay. Chỉ khi mã này đổi thì mới dựng lại DOM,
 * nhờ vậy animation đang chạy không bị cắt, còn lần lọc không đổi gì thì không vẽ lại.
 */
function getFrameSignature(meal, dishes, spinningCourseId, revealedCourseId) {
  if (meal.phase === MEAL_PHASE.SERVED) return `served-${meal.servedMeal?.at ?? 0}`;
  return [
    meal.phase,
    spinningCourseId,
    revealedCourseId,
    meal.preference,
    meal.budget,
    dishes.map(dish => dish?.id ?? '-').join('_')
  ].join('|');
}

/**
 * Render chức năng dựng bữa cơm hoàn chỉnh
 * @param {HTMLElement} container - Container chứa panel
 * @param {Object} state - { meal, pool, history, spinningCourseId, revealedCourseId }
 * @param {Object} handlers - { onRollCourse, onRollAll, onServe, onNewMeal, onCloseServed, onSetPreference, onSetBudget, onViewDetail, onRattleEnd, onHover }
 */
export function renderMealPanel(container, state, handlers = {}) {
  if (!container) return;

  const {
    meal = createMealState(),
    pool = [],
    history = [],
    spinningCourseId = null,
    revealedCourseId = null
  } = state;

  const dishes = meal.slots.map(slot => slot.dish);
  const total = getMealTotal(dishes);
  const signature = getFrameSignature(meal, dishes, spinningCourseId, revealedCourseId);

  activeMealHandlers = handlers;
  bindMealActions(container);

  if (signature === container.dataset.mealSignature) return;
  container.dataset.mealSignature = signature;

  const previousTotal = Number(container.dataset.mealTotal || 0);
  container.dataset.mealTotal = String(total);

  container.innerHTML = buildPanelHTML(meal, pool, history, dishes, total, spinningCourseId, revealedCourseId);

  const totalEl = container.querySelector('[data-role="total"]');
  if (totalEl) animateTotal(totalEl, previousTotal, total);

  if (spinningCourseId) {
    // Chuông đóng lại đúng lúc hộp ngừng lắc
    window.setTimeout(() => activeMealHandlers.onRattleEnd?.(), MEAL_TIMING.RATTLE);
  }
}

function buildPanelHTML(meal, pool, history, dishes, total, spinningCourseId, revealedCourseId) {
  const isServing = meal.phase === MEAL_PHASE.SERVING;
  const isServed = meal.phase === MEAL_PHASE.SERVED;
  const filled = dishes.filter(Boolean).length;
  const isBusy = isServing || Boolean(spinningCourseId);

  const slotState = { ...meal, pool, rollingCourseId: spinningCourseId, revealedCourseId };
  const budgetGroup = getMealBudgetGroup(meal.budget);

  // Suất ăn nào không còn món nào hợp lệ thì nói rõ thay vì để người dùng bấm hoài
  const blockedCourses = MEAL_COURSES.filter(course => {
    const slot = meal.slots.find(item => item.courseId === course.id);
    if (!slot || slot.dish) return false;
    return getCourseCandidates(pool, course, getFilledDishes(meal).filter(item => item.id !== slot.dish?.id)).length === 0;
  });

  const warnings = [
    pool.length === 0
      ? budgetGroup.id === MEAL_BUDGET_ALL
        ? 'Bộ lọc hiện tại không còn món nào. Hãy nới bộ lọc ở trang Khám phá món rồi quay lại đây.'
        : `Mức giá "${budgetGroup.name}" không còn món nào khớp. Chọn mức giá khác hoặc nới bộ lọc ở trang Khám phá món.`
      : '',
    blockedCourses.length > 0
      ? `Mức giá "${budgetGroup.name}" hiện tại không có món cho ${blockedCourses.map(c => `${c.icon} ${c.name}`).join(', ')}.`
      : ''
  ].filter(Boolean);

  return `
    <section class="meal-panel meal-panel--${meal.preference}${isServing ? ' is-serving' : ''}" data-pref="${meal.preference}" data-budget="${budgetGroup.id}" aria-labelledby="meal-title">
      <header class="meal-heading">
        <div class="meal-heading-main">
          <span class="section-kicker">BẾP MỞ CỬA</span>
          <h2 class="meal-title" id="meal-title">🍽️ Dựng bữa cơm hoàn chỉnh</h2>
          <p class="meal-hint">
            Bốc từng suất một để dựng ra một bữa ăn trọn vẹn, rồi dọn lên bàn và xem tổng chi phí.
          </p>
          ${renderPreferenceHTML(meal.preference)}
          ${renderBudgetHTML(meal.budget)}
        </div>
        <div class="meal-heading-tools">
          <span class="meal-pool-hint" role="status" aria-live="polite">${pool.length} món đang mở</span>
        </div>
      </header>

      ${warnings.map(text => `<p class="meal-warning" role="alert">${text}</p>`).join('')}

      <div class="meal-tray${isBusy || isServed ? ' is-served' : ''}">
        <div class="meal-tray-glow" aria-hidden="true"></div>
        <div class="meal-slots">
          ${meal.slots.map((slot, index) => renderSlotHTML(slot, slotState, index)).join('')}
        </div>
        ${renderTrayFooterHTML(dishes, isServing)}
      </div>

      <div class="meal-actions">
        <button type="button" class="meal-btn meal-btn--primary" data-action="roll-all" ${isBusy || pool.length === 0 ? 'disabled' : ''}>
          🎲 Bốc trọn bữa
        </button>
        <button type="button" class="meal-btn meal-btn--serve" data-action="serve" ${isBusy || filled === 0 ? 'disabled' : ''}>
          🍽️ Dọn món
        </button>
        <button type="button" class="meal-btn" data-action="new" ${isBusy || filled === 0 ? 'disabled' : ''}>
          🔄 Xóa khay
        </button>
      </div>

      ${renderBookHTML(history)}

      ${isServed && meal.servedMeal ? renderServedHTML(meal.servedMeal) : ''}
    </section>
  `;
}
