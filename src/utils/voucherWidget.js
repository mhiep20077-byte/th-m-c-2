// ============================================================
// 🎟️ BungOiAnGi – Voucher Widget Helper
// Dùng chung cho tất cả các màn hình & 4 mini-game
// ============================================================

import { getLocalVouchers, getLocalClaimedVoucherIds } from '../data/vouchers.js';
import {
  getActiveVoucherCode,
  setActiveVoucherCode,
  clearActiveVoucherCode,
  calculateVoucherDiscount
} from '../data/adminStorage.js';
import { formatCurrency } from './formatCurrency.js';
import { playClick, playWin } from './uiAudio.js';

function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}

/**
 * Trả về thông tin voucher hiện tại và mức giảm cho một mức giá
 */
export function getCurrentVoucherCalculation(price = 0, vouchersList = null) {
  const activeCode = (getActiveVoucherCode() || '').trim().toUpperCase();
  if (!activeCode) return null;
  const allVouchers = Array.isArray(vouchersList) && vouchersList.length > 0 ? vouchersList : getLocalVouchers();
  const matchedVoucher = allVouchers.find(v => v.code.toUpperCase() === activeCode);
  if (!matchedVoucher) return null;
  return {
    code: activeCode,
    voucher: matchedVoucher,
    result: calculateVoucherDiscount(matchedVoucher, Number(price) || 0)
  };
}

/**
 * Tạo mã HTML cho widget voucher
 */
export function buildVoucherWidgetHTML({
  targetPrice = 0,
  contextTitle = 'Ưu Đãi & Mã Giảm Giá',
  idPrefix = 'vw',
  showWalletLink = true,
  customActiveCode = null,
  vouchersList = null
}) {
  const price = Number(targetPrice) || 0;
  const activeCode = (customActiveCode !== null ? customActiveCode : (getActiveVoucherCode() || '')).trim().toUpperCase();
  const allVouchers = Array.isArray(vouchersList) && vouchersList.length > 0 ? vouchersList : getLocalVouchers();
  const matchedVoucher = activeCode ? allVouchers.find(v => v.code.toUpperCase() === activeCode) : null;
  const calcResult = matchedVoucher ? calculateVoucherDiscount(matchedVoucher, price) : null;
  const claimedIds = new Set(getLocalClaimedVoucherIds());
  const availableVouchers = allVouchers.filter(v => v.active !== false).slice(0, 6);

  return `
    <div class="modal-voucher-box voucher-widget" id="${idPrefix}-box">
      <div class="mv-header">
        <span class="mv-title">🎟️ ${escapeHTML(contextTitle)}</span>
        ${showWalletLink ? `<a href="#vouchers" class="mv-link-wallet" id="${idPrefix}-wallet-link">Xem kho voucher ➔</a>` : ''}
      </div>

      <div class="mv-input-row">
        <div class="mv-input-wrapper">
          <input
            type="text"
            id="${idPrefix}-input"
            class="mv-input"
            placeholder="Nhập mã ưu đãi (VD: BUNGNEW30)..."
            value="${escapeHTML(activeCode)}"
            autocomplete="off"
            spellcheck="false"
          />
          ${activeCode ? `<button type="button" id="${idPrefix}-clear-btn" class="mv-clear-btn" title="Gỡ mã">✕</button>` : ''}
        </div>
        <button type="button" id="${idPrefix}-apply-btn" class="mv-apply-btn">
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
                data-widget-code="${escapeHTML(v.code)}"
                title="${escapeHTML(v.title)} (Đơn tối thiểu ${formatCurrency(v.minOrder)})"
              >
                ${isMine ? '⭐ ' : ''}${escapeHTML(v.code)} (${badge})
              </button>
            `;
          }).join('')}
        </div>
      ` : ''}

      <div id="${idPrefix}-result" class="mv-result">
        ${calcResult ? `
          <div class="mv-result-card ${calcResult.isValid ? 'mv-result-card--success' : 'mv-result-card--error'}">
            <div class="mv-result-top">
              <span class="mv-result-badge">
                ${calcResult.isValid ? `🎉 ${escapeHTML(matchedVoucher.title || matchedVoucher.code)}` : '⚠️ Chưa đủ điều kiện'}
              </span>
              <button type="button" id="${idPrefix}-remove-btn" class="mv-result-remove">Gỡ mã</button>
            </div>
            ${calcResult.isValid ? `
              <div class="mv-result-prices">
                <span class="mv-price-orig">${formatCurrency(price)}</span>
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
}

/**
 * Gắn sự kiện cho widget voucher và re-render linh hoạt
 */
export function mountVoucherWidget({
  container,
  targetPrice = 0,
  contextTitle = 'Ưu Đãi & Mã Giảm Giá',
  idPrefix = 'vw',
  showWalletLink = true,
  vouchersList = null,
  onApplied = null,
  onRemoved = null,
  onNavigateToWallet = null,
  showToast = null
}) {
  if (!container) return;

  function render(currentPrice = targetPrice) {
    container.innerHTML = buildVoucherWidgetHTML({
      targetPrice: currentPrice,
      contextTitle,
      idPrefix,
      showWalletLink,
      vouchersList
    });

    const inputEl = container.querySelector(`#${idPrefix}-input`);
    const applyBtn = container.querySelector(`#${idPrefix}-apply-btn`);
    const clearBtn = container.querySelector(`#${idPrefix}-clear-btn`);
    const removeBtn = container.querySelector(`#${idPrefix}-remove-btn`);
    const walletLink = container.querySelector(`#${idPrefix}-wallet-link`);

    const allVouchers = Array.isArray(vouchersList) && vouchersList.length > 0 ? vouchersList : getLocalVouchers();

    const doApply = (code) => {
      const codeUpper = String(code !== undefined ? code : (inputEl?.value || '')).trim().toUpperCase();
      if (!codeUpper) {
        clearActiveVoucherCode();
        render(currentPrice);
        onRemoved?.();
        return;
      }

      const found = allVouchers.find(v => v.code.toUpperCase() === codeUpper);
      if (!found) {
        showToast?.(`Mã "${codeUpper}" không tồn tại hoặc đã hết hạn!`, 'error');
        setActiveVoucherCode(codeUpper);
        render(currentPrice);
        return;
      }

      const res = calculateVoucherDiscount(found, currentPrice);
      setActiveVoucherCode(codeUpper);
      playClick();
      if (res.isValid) {
        playWin();
        showToast?.(`🎉 Áp dụng mã "${codeUpper}" thành công! Tiết kiệm ${formatCurrency(res.discount)}.`, 'success');
      } else {
        showToast?.(res.message, 'error');
      }
      render(currentPrice);
      onApplied?.({ voucher: found, calcResult: res, code: codeUpper });
    };

    applyBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      doApply();
    });

    inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        doApply();
      }
    });

    clearBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      clearActiveVoucherCode();
      render(currentPrice);
      onRemoved?.();
    });

    removeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      clearActiveVoucherCode();
      showToast?.('Đã gỡ mã ưu đãi.', 'info');
      render(currentPrice);
      onRemoved?.();
    });

    container.querySelectorAll('[data-widget-code]').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = chip.dataset.widgetCode;
        if (inputEl) inputEl.value = code;
        doApply(code);
      });
    });

    walletLink?.addEventListener('click', (e) => {
      if (onNavigateToWallet) {
        e.preventDefault();
        e.stopPropagation();
        onNavigateToWallet();
      }
    });
  }

  render(targetPrice);

  return {
    updatePrice: (newPrice) => {
      targetPrice = Number(newPrice) || 0;
      render(targetPrice);
    }
  };
}
