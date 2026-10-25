// ============================================================
// 🎁 BungOiAnGi – Airdrop / Hòm Thính Integration Manager
// ============================================================

import {
  AIRDROP_PHASE,
  AIRDROP_TIMING,
  applyAirdropFilters,
  isAirdropBusy,
  renderAirdropPanel,
  resetAirdropFilters,
  setAirdropPickFilter,
  setAirdropPickSort
} from './airdropView.js';

import { playCrateOpenSound, playRevealSound, playUiSound } from './airdropAudio.js';
import { pickWeightedDish, trackAnalyticsEvent } from '../../utils/weightEngine.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { mountVoucherWidget } from '../../utils/voucherWidget.js';

let airdropPhase = AIRDROP_PHASE.READY;
let airdropDishId = null;
let lastAirdropId = null;
let airdropMessage = '';
let airdropTimers = [];
let excludedIds = new Set();

let containerEl = null;
let dishesData = [];
let getFavoritesFn = () => [];
let toggleFavoriteFn = () => { };
let openModalFn = () => { };
let mountNearbyPanelFn = () => { };

export function initAirdropManager(container, dishes, getFavorites, toggleFavorite, openModal, mountNearbyPanel) {
  containerEl = container;
  dishesData = dishes || [];
  getFavoritesFn = getFavorites || (() => []);
  toggleFavoriteFn = toggleFavorite || (() => { });
  openModalFn = openModal || (() => { });
  mountNearbyPanelFn = mountNearbyPanel || (() => { });

  renderAirdropState();
}

function clearTimers() {
  airdropTimers.forEach(timer => window.clearTimeout(timer));
  airdropTimers = [];
}

function schedulePhase(nextPhase, delay, onDone) {
  const timer = window.setTimeout(() => {
    airdropTimers = airdropTimers.filter(item => item !== timer);
    airdropPhase = nextPhase;
    onDone?.();
    renderAirdropState();
  }, delay);

  airdropTimers.push(timer);
}

function getAvailablePool() {
  return dishesData.filter(d => !excludedIds.has(d.id));
}

export function renderAirdropState() {
  if (!containerEl) return;

  const basePool = getAvailablePool();
  const pool = applyAirdropFilters(basePool);
  const currentDish = airdropDishId !== null ? dishesData.find(d => d.id === airdropDishId) : null;
  const favorites = getFavoritesFn();

  renderAirdropPanel(containerEl, {
    phase: airdropPhase,
    dish: currentDish,
    message: airdropMessage,
    basePool: basePool,
    isFavorite: airdropDishId !== null ? favorites.includes(airdropDishId) : false,
    isExcluded: airdropDishId !== null ? excludedIds.has(airdropDishId) : false
  }, {
    onLaunch: handleLaunch,
    onOpen: handleOpen,
    onViewDetail: (id) => {
      const dish = dishesData.find(d => d.id === id);
      if (dish) openModalFn(dish, false);
    },
    onToggleFavorite: (id) => {
      toggleFavoriteFn(id);
      renderAirdropState();
    },
    onToggleExclude: (id) => {
      const dish = dishesData.find(d => d.id === id);
      const name = dish?.name || 'món này';
      if (excludedIds.has(id)) {
        excludedIds.delete(id);
        airdropMessage = `Đã cho "${name}" quay lại hòm thính.`;
        playUiSound('success');
      } else {
        excludedIds.add(id);
        airdropMessage = `Đã bỏ "${name}" khỏi hòm thính.`;
        playUiSound('error');
      }
      renderAirdropState();
    },
    onSortPick: (sort) => {
      setAirdropPickSort(sort);
      renderAirdropState();
    },
    onSearchPick: (keyword) => {
      setAirdropPickFilter({ keyword });
      renderAirdropState();
    },
    onFilterPick: (filters) => {
      setAirdropPickFilter(filters);
      renderAirdropState();
    },
    onResetFilters: () => {
      resetAirdropFilters();
      airdropMessage = 'Đã bỏ lọc, hòm thính bốc lại toàn bộ danh sách.';
      playUiSound('stop');
      renderAirdropState();
    },
    onClose: () => {
      clearTimers();
      airdropPhase = AIRDROP_PHASE.READY;
      airdropDishId = null;
      airdropMessage = 'Đã đóng hòm thính. Bắn pháo để gọi máy bay lần nữa.';
      playUiSound('stop');
      renderAirdropState();
    }
  });

  if (airdropPhase === AIRDROP_PHASE.REVEALED && currentDish) {
    const voucherHost = containerEl.querySelector('.airdrop-voucher-host');
    if (voucherHost) {
      mountVoucherWidget({
        container: voucherHost,
        targetPrice: currentDish.price,
        contextTitle: 'Ưu Đãi Món Từ Hòm Thính',
        idPrefix: `airdrop-vw-${currentDish.id}`,
        showWalletLink: true,
        onApplied: ({ calcResult }) => {
          const priceEl = containerEl.querySelector('.airdrop-reward-price');
          if (priceEl && calcResult?.isValid) {
            priceEl.innerHTML = `<del style="opacity:0.6;font-size:0.85em;margin-right:6px;font-weight:normal">${formatCurrency(currentDish.price)}</del> 👉 <span style="color:#ea580c;font-weight:800">${formatCurrency(calcResult.finalPrice)}</span>`;
          }
        },
        onRemoved: () => {
          const priceEl = containerEl.querySelector('.airdrop-reward-price');
          if (priceEl) priceEl.textContent = formatCurrency(currentDish.price);
        },
        onNavigateToWallet: () => {
          window.location.hash = '#vouchers';
        }
      });
    }

    const nearbyHost = containerEl.querySelector('.airdrop-nearby-host');
    if (nearbyHost) mountNearbyPanelFn(currentDish, nearbyHost);
  }
}

function handleLaunch() {
  if (isAirdropBusy(airdropPhase)) return;

  const pool = applyAirdropFilters(getAvailablePool());
  if (pool.length === 0) {
    playUiSound('error');
    airdropMessage = 'Không có món nào phù hợp để hòm thính rơi xuống!';
    renderAirdropState();
    return;
  }

  playUiSound('launch');
  airdropDishId = null;
  airdropMessage = '';
  clearTimers();
  airdropPhase = AIRDROP_PHASE.LAUNCHING;
  renderAirdropState();

  schedulePhase(AIRDROP_PHASE.INCOMING, AIRDROP_TIMING.LAUNCHING, () => {
    playUiSound('drop');
    schedulePhase(AIRDROP_PHASE.DROPPED, AIRDROP_TIMING.INCOMING, () => {
      playUiSound('thud');
    });
  });
}

function handleOpen() {
  if (airdropPhase !== AIRDROP_PHASE.DROPPED) return;

  const pool = applyAirdropFilters(getAvailablePool());
  if (pool.length === 0) {
    playUiSound('error');
    airdropMessage = 'Không có món nào phù hợp để mở hòm!';
    renderAirdropState();
    return;
  }

  const candidatePool = pool.filter(d => d.id !== lastAirdropId);
  const finalPool = candidatePool.length > 0 ? candidatePool : pool;
  const picked = pickWeightedDish(finalPool) || finalPool[0];

  trackAnalyticsEvent('game_roll', {
    game: 'airdrop',
    dishId: picked.id,
    dishName: picked.name,
    isSponsored: picked.isSponsored,
    isBestseller: picked.isBestseller,
  });

  lastAirdropId = picked.id;
  airdropDishId = picked.id;
  airdropMessage = '';
  playCrateOpenSound();

  airdropPhase = AIRDROP_PHASE.OPENING;
  renderAirdropState();

  clearTimers();
  schedulePhase(AIRDROP_PHASE.REVEALED, AIRDROP_TIMING.OPENING, () => {
    playRevealSound(picked);
  });
}
