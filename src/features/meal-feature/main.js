/**
 * =========================================================================
 * BẢN SAO ĐIỀU PHỐI CHỨC NĂNG DỰNG BỮA CƠM (MEAL BUILDER FEATURE)
 * Tách riêng từ src/main.js và src/js/meal.js
 * Có thể chạy độc lập hoàn toàn hoặc nhúng vào ứng dụng khác.
 * =========================================================================
 */

import './meal.css';
import { formatCurrency } from './dishRender.js';
import {
  MEAL_BUDGETS,
  MEAL_COURSES,
  MEAL_PREFERENCE,
  MEAL_PHASE,
  MEAL_TIMING,
  applyMealBudget,
  createMealState,
  getFilledDishes,
  getMealTotal,
  isPreferenceBoundCourse,
  matchesBudget,
  matchesPreference,
  pickCourseDish,
  renderMealPanel
} from './meal.js';

import {
  playCrateRattleSound,
  playUiSound
} from './sound.js';

import {
  addExcluded,
  addHistory,
  getExcludedIds,
  getHistory,
  getMealRecords,
  isExcluded,
  isFavorite,
  removeExcluded,
  saveMealRecord,
  toggleFavorite
} from './storage.js';

import {
  findDishById,
  pickRandomSimilar,
  renderDishDetail
} from './dishDetail.js';

import { applyFoodImages } from './foodImages.js';
import bundledDishes from './data/dishes.json';

// Trạng thái cục bộ của bữa cơm
let allDishes = [];
let mealState = createMealState();
let mealPool = [];
let mealRecords = [];
let mealRollingCourseId = null;
let mealRevealedCourseId = null;
let mealRevealTimer = null;
let mealTimers = [];

// Trạng thái modal xem chi tiết món ăn
let selectedDishId = null;
let detailReturnFocus = null;
let detailNotice = '';

// DOM Containers
let mealContainer = null;
let detailContainer = null;

/**
 * Lấy pool món ăn để dựng bữa cơm:
 * Loại bỏ các món trong danh sách không thích (excluded),
 * sau đó áp dụng bộ lọc mức giá ngân sách của bữa ăn.
 */
export function getMealPool() {
  const excludedIds = getExcludedIds();
  const poolWithoutExcluded = allDishes.filter(d => !excludedIds.includes(d.id));
  return applyMealBudget(poolWithoutExcluded, mealState.budget);
}

/** Hủy mọi hẹn giờ đang chờ của bữa ăn */
export function clearMealTimers() {
  mealTimers.forEach(id => window.clearTimeout(id));
  mealTimers = [];
}

export function scheduleMeal(delay, callback) {
  mealTimers.push(window.setTimeout(callback, delay));
}

/** Bốc một món cho đúng suất ăn, ghi đè món cũ nếu ô đó đã có món */
export function fillMealSlot(courseId) {
  const course = MEAL_COURSES.find(item => item.id === courseId);
  if (!course) return false;

  const slotIndex = mealState.slots.findIndex(slot => slot.courseId === courseId);
  if (slotIndex === -1) return false;

  const otherDishes = mealState.slots
    .filter((slot, index) => index !== slotIndex)
    .map(slot => slot.dish)
    .filter(Boolean);

  const dish = pickCourseDish(getMealPool(), course, otherDishes, mealState.preference);
  if (!dish) return false;

  mealState.slots[slotIndex].dish = dish;
  return true;
}

/** Món vừa lộ ra khỏi hộp */
export function revealMealSlot(courseId) {
  fillMealSlot(courseId);
  mealRollingCourseId = null;
  mealRevealedCourseId = courseId;
  renderMealState();

  window.clearTimeout(mealRevealTimer);
  mealRevealTimer = window.setTimeout(() => {
    mealRevealedCourseId = null;
  }, MEAL_TIMING.REVEAL);
}

/** Bốc một suất ăn riêng lẻ */
export function handleMealRoll(courseId) {
  if (mealRollingCourseId || mealState.phase !== MEAL_PHASE.BUILDING) return;
  if (!getMealPool().length) return;

  clearMealTimers();
  mealRevealedCourseId = null;
  mealRollingCourseId = courseId;
  playCrateRattleSound();
  renderMealState();

  scheduleMeal(MEAL_TIMING.RATTLE, () => revealMealSlot(courseId));
}

/** Bốc dần từng suất cho cả bữa ăn */
export function handleMealRollAll() {
  if (mealRollingCourseId || mealState.phase !== MEAL_PHASE.BUILDING) return;
  if (!getMealPool().length) return;

  clearMealTimers();
  const queue = MEAL_COURSES
    .map(course => course.id)
    .filter(courseId => !mealState.slots.find(slot => slot.courseId === courseId)?.dish);

  if (queue.length === 0) return;
  let index = 0;

  const rollNext = () => {
    if (index >= queue.length) return;

    const courseId = queue[index];
    mealRevealedCourseId = null;
    mealRollingCourseId = courseId;
    playCrateRattleSound();
    renderMealState();

    scheduleMeal(MEAL_TIMING.RATTLE, () => {
      revealMealSlot(courseId);
      index += 1;

      if (index < queue.length) scheduleMeal(280, rollNext);
    });
  };

  rollNext();
}

/** Dọn bữa: kích hoạt animation dọn mâm và hiển thị phiếu tổng kết */
export function handleMealServe() {
  const dishes = getFilledDishes(mealState);
  if (dishes.length === 0 || mealState.phase !== MEAL_PHASE.BUILDING) return;

  clearMealTimers();
  mealState.phase = MEAL_PHASE.SERVING;
  renderMealState();

  scheduleMeal(MEAL_TIMING.SERVE, () => {
    const servedDishes = MEAL_COURSES.map(course => mealState.slots.find(slot => slot.courseId === course.id)?.dish || null);
    const filledDishes = servedDishes.filter(Boolean);
    const total = getMealTotal(servedDishes);

    mealRecords = saveMealRecord(filledDishes, total);
    filledDishes.forEach(dish => addHistory(dish.id, dish.name));

    mealState.phase = MEAL_PHASE.SERVED;
    mealState.servedMeal = { dishes: servedDishes, total, budget: mealState.budget, at: Date.now() };
    renderMealState();

    playUiSound('plate');
    window.setTimeout(() => playUiSound('steam'), 420);
  });
}

/** Xóa sạch khay để dựng bữa mới */
export function handleMealNew() {
  clearMealTimers();
  window.clearTimeout(mealRevealTimer);
  const keepPreference = mealState.preference;
  const keepBudget = mealState.budget;
  mealState = createMealState();
  mealState.preference = keepPreference;
  mealState.budget = keepBudget;
  mealRollingCourseId = null;
  mealRevealedCourseId = null;
  renderMealState();
}

/** Đóng popup mâm cơm đã dọn để xem lại trên khay */
export function handleMealCloseServed() {
  clearMealTimers();
  mealState.phase = MEAL_PHASE.BUILDING;
  renderMealState();
}

/** Sao chép thực đơn mâm cơm đã dọn */
export function handleMealShareMenu() {
  const served = mealState.servedMeal;
  if (!served || !served.dishes) return;
  const totalCalo = (served.dishes || []).reduce((sum, d) => sum + (d?.calo || d?.calories || 0), 0);
  const menuLines = served.dishes
    .map((dish, i) => {
      const course = MEAL_COURSES[i];
      return course ? `${course.icon} ${course.name}: ${dish.name} (${formatCurrency(dish.price)})` : `• ${dish.name}`;
    })
    .join('\n');

  const shareText = `🍱 [MÂM CƠM HÔM NAY - BUNG OI AN GI]\n${menuLines}\n💵 Tổng cộng: ${formatCurrency(served.total)}${totalCalo > 0 ? `\n🔥 Năng lượng: ~${totalCalo} kcal` : ''}\n👉 Xem thêm tại BungOiAnGi!`;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(shareText).then(() => {
      const btn = mealContainer?.querySelector('[data-action="share-menu"]');
      if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = '✅ Đã sao chép!';
        setTimeout(() => { btn.innerHTML = originalText; }, 2000);
      }
    }).catch(() => {
      prompt('Sao chép thực đơn mâm cơm:', shareText);
    });
  } else {
    prompt('Sao chép thực đơn mâm cơm:', shareText);
  }
}

/** Đổi chế độ bữa ăn: Tất cả / Bữa chay / Bữa mặn */
export function handleMealSetPreference(preference) {
  if (!Object.values(MEAL_PREFERENCE).includes(preference)) return;
  if (mealState.preference === preference) return;

  mealState.preference = preference;
  mealState.slots.forEach((slot, index) => {
    if (slot.dish && isPreferenceBoundCourse(slot.courseId) && !matchesPreference(slot.dish, preference)) {
      mealState.slots[index].dish = null;
    }
  });

  playUiSound('tap');
  renderMealState();
}

/** Đổi mức giá trần cho bữa ăn */
export function handleMealSetBudget(budget) {
  if (!MEAL_BUDGETS.some(item => item.id === budget)) return;
  if (mealState.budget === budget) return;

  mealState.budget = budget;
  mealState.slots.forEach((slot, index) => {
    if (slot.dish && !matchesBudget(slot.dish, budget)) mealState.slots[index].dish = null;
  });

  playUiSound('tap');
  renderMealState();
}

/** Render giao diện mâm cơm chính */
export function renderMealState() {
  if (!mealContainer) return;

  mealPool = getMealPool();
  if (mealRecords.length === 0) mealRecords = getMealRecords();

  renderMealPanel(mealContainer, {
    meal: mealState,
    pool: mealPool,
    history: mealRecords,
    dishHistory: getHistory(),
    spinningCourseId: mealRollingCourseId,
    revealedCourseId: mealRevealedCourseId
  }, {
    onRollCourse: handleMealRoll,
    onRollAll: handleMealRollAll,
    onServe: handleMealServe,
    onNewMeal: handleMealNew,
    onCloseServed: handleMealCloseServed,
    onShareMenu: handleMealShareMenu,
    onSetPreference: handleMealSetPreference,
    onSetBudget: handleMealSetBudget,
    onViewDetail: (id, trigger) => openDishDetail(id, trigger),
    onRattleEnd: () => playUiSound('plating'),
    onHover: () => playUiSound('tap')
  });
}

/* ============ Modal chi tiết món ăn ============ */

export function openDishDetail(id, triggerEl) {
  const dish = findDishById(allDishes, id);
  if (!dish) return;

  if (selectedDishId === null) {
    detailReturnFocus = triggerEl || null;
    document.body.classList.add('modal-open');
  }

  selectedDishId = dish.id;
  detailNotice = '';
  addHistory(dish.id, dish.name);
  renderMealState();
  renderSelectedDetail();
}

export function closeDishDetail() {
  const dishId = selectedDishId;
  const returnFocus = detailReturnFocus;
  selectedDishId = null;
  detailNotice = '';
  if (detailContainer) detailContainer.innerHTML = '';
  document.body.classList.remove('modal-open');

  const fallbackFocus = mealContainer?.querySelector(`[data-action="detail"][data-id="${dishId}"]`);
  const focusTarget = returnFocus && document.contains(returnFocus) ? returnFocus : fallbackFocus;
  focusTarget?.focus();
  detailReturnFocus = null;
}

function renderSelectedDetail() {
  if (!detailContainer) return;
  const dish = findDishById(allDishes, selectedDishId);
  if (!dish) {
    closeDishDetail();
    return;
  }

  renderDishDetail(detailContainer, dish, {
    isFavorite: isFavorite(dish.id),
    isExcluded: isExcluded(dish.id),
    notice: detailNotice,
    celebrate: false,
    onClose: closeDishDetail,
    onToggleFavorite: () => {
      toggleFavorite(dish.id);
      renderSelectedDetail();
    },
    onExclude: () => {
      const removed = !isExcluded(dish.id);
      if (removed) {
        addExcluded(dish.id);
        detailNotice = `Đã thêm vào danh sách không thích.`;
      } else {
        removeExcluded(dish.id);
        detailNotice = `Đã bỏ khỏi danh sách không thích.`;
      }
      playUiSound(removed ? 'error' : 'success');
      renderMealState();
      renderSelectedDetail();
    },
    onSimilar: () => {
      const similar = pickRandomSimilar(allDishes, dish, getExcludedIds());
      if (similar) {
        openDishDetail(similar.id, null);
      } else {
        detailNotice = 'Không tìm thấy món tương tự phù hợp!';
        renderSelectedDetail();
      }
    }
  });
}

/** Tải dữ liệu món ăn và khởi động tính năng */
export async function initMealFeature(options = {}) {
  const {
    container = document.getElementById('meal-container'),
    detailModalContainer = document.getElementById('dish-detail-container'),
    dishes = null
  } = options;

  mealContainer = container;
  detailContainer = detailModalContainer;

  const sourceDishes = Array.isArray(dishes) && dishes.length > 0 ? dishes : bundledDishes;
  if (!Array.isArray(sourceDishes) || sourceDishes.length === 0) {
    throw new Error('Không có dữ liệu món ăn để khởi động chức năng dựng bữa.');
  }

  allDishes = applyFoodImages(sourceDishes.map(dish => ({ ...dish })));
  renderMealState();
}

// Lắng nghe sự kiện phím Escape để đóng modal chi tiết
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && selectedDishId !== null) {
    closeDishDetail();
  }
});

// Tự động khởi động nếu chạy trong trang HTML có container tương ứng
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('meal-feature-standalone')) {
      initMealFeature();
    }
  });
}
