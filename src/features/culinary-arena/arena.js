/**
 * =========================================================================
 * CHIÊM TINH ẨM THỰC (CULINARY ORACLE & FOOD TAROT) - CORE CONTROLLER
 * Trải bài Tarot 3D thần bí, bắt mạch cảm xúc và sổ tay lưu quẻ
 * =========================================================================
 */

import {
    playUiClick,
    playCardFlip,
    playOracleChime,
    playRevelationGong,
    isSoundEnabled,
    toggleSound
} from './sound.js';

import { launchConfetti } from './confetti.js';
import { getSavedFortunes, saveFortune, clearFortuneHistory } from './storage.js';
import { pickWeightedDishes, trackAnalyticsEvent } from '../../utils/weightEngine.js';

// Danh sách các kiểu trải bài
const SPREAD_CONFIGS = {
    single: {
        id: 'single',
        name: 'Quẻ Một Chạm (1 Lá Thần Tốc)',
        count: 1,
        slots: [
            { label: 'Chân Ái Định Mệnh', icon: '⚡', desc: 'Lựa chọn vũ trụ dành riêng cho bạn lúc này' }
        ]
    },
    pair: {
        id: 'pair',
        name: 'Song Hỷ Ẩm Thực (2 Lá Cặp Đôi)',
        count: 2,
        slots: [
            { label: 'Món Chính Ấm Lòng', icon: '🍲', desc: 'Trọng tâm thỏa mãn cơn đói của bạn' },
            { label: 'Thanh Mát Giải Ngấy', icon: '🧋', desc: 'Thức uống hoặc món ngọt điểm xuyết hoàn hảo' }
        ]
    },
    three: {
        id: 'three',
        name: 'Tam Hợp Ẩm Thực (3 Lá Truyền Thống)',
        count: 3,
        slots: [
            { label: 'Thực Tại Bao Tử', icon: '🔮', desc: 'Tiếng gọi từ chiếc bụng đói hiện tại' },
            { label: 'Thử Thách Vị Giác', icon: '✨', desc: 'Hương vị đưa bạn thoát khỏi sự nhàm chán' },
            { label: 'Chân Ái Cứu Rỗi', icon: '🌟', desc: 'Món ăn định mệnh mang lại bình yên hôm nay' }
        ]
    },
    elemental: {
        id: 'elemental',
        name: 'Ngũ Hành Vị Giác (5 Lá Thịnh Soạn)',
        count: 5,
        slots: [
            { label: 'Kim • Giòn Tan', icon: '🪙', desc: 'Khai vị giòn rụm kích thích vị giác' },
            { label: 'Mộc • Tươi Xanh', icon: '🌿', desc: 'Rau củ tươi mát, cân bằng dinh dưỡng' },
            { label: 'Thủy • Đậm Đà', icon: '🌊', desc: 'Món nước ngọt lành xoa dịu tâm hồn' },
            { label: 'Hỏa • Bùng Cháy', icon: '🔥', desc: 'Món cay nồng đánh thức năng lượng' },
            { label: 'Thổ • No Đủ', icon: '🌾', desc: 'Cơm xôi chắc dạ, nền tảng bình an' }
        ]
    }
};

// Bộ lọc bắt mạch cảm xúc
const MOODS = [
    { id: 'all', label: '🔮 Tự Nhiên (Tùy Duyên)', filter: () => true },
    { id: 'stress', label: '😫 Đang Căng Thẳng', filter: (d) => ['mon-nuoc', 'mon-ngot'].includes(d.category) || (d.tags || []).includes('dam-da') },
    { id: 'tired', label: '🥱 Cần Năng Lượng', filter: (d) => d.category === 'mon-com' || (d.tags || []).includes('no') },
    { id: 'budget', label: '💸 Ví Tiền Đang Mỏng', filter: (d) => Number(d.price) <= 35000 },
    { id: 'chill', label: '🥰 Muốn Yêu Đời', filter: (d) => ['an-vat', 'do-uong', 'mon-ngot'].includes(d.category) },
    { id: 'spicy', label: '🌶️ Muốn Bùng Nổ', filter: (d) => (d.tags || []).includes('cay') || d.category === 'mon-nuoc' }
];

// Kho lời sấm tiên tri vũ trụ
const PROPHECIES_BY_SLOT = {
    0: [
        'Chiếc bụng đang khao khát một sự vỗ về ấm nóng và đậm đà hơn bao giờ hết.',
        'Bao tử không hề nói dối: Bạn đã làm việc vất vả, hãy nạp năng lượng ngay!',
        'Một cảm giác trống trải cần được lấp đầy bằng hương vị quen thuộc.',
        'Vị giác đang đánh tín hiệu SOS: Đừng trì hoãn bữa ăn thêm một phút nào nữa!'
    ],
    1: [
        'Hãy thử một lần bước ra khỏi vùng an toàn ẩm thực, bạn sẽ bất ngờ đấy!',
        'Vũ trụ khuyên bạn hôm nay hãy tự thưởng cho mình một chút phá cách.',
        'Sự kết hợp này sẽ đánh thức các giác quan đang ngủ quên của bạn.',
        'Đừng ngần ngại gọi thêm chút gia vị hoặc món ăn kèm để trọn vẹn hơn.'
    ],
    2: [
        'Đây chính là chân ái của ngày hôm nay, ăn xong tinh thần ắt sẽ thăng hoa!',
        'Không còn nghi ngờ gì nữa, lựa chọn này sẽ đem lại sự no đủ và may mắn trọn vẹn.',
        'Hương vị này được sinh ra để xoa dịu tâm hồn bạn sau những giờ tập trung cao độ.',
        'Chốt đơn ngay và tận hưởng từng miếng ngon với lòng biết ơn nhé!'
    ],
    3: [
        'Ngọn lửa nhiệt huyết và đam mê ẩm thực bùng cháy trong từng miếng ngon!',
        'Một chút nồng nàn và mãnh liệt sẽ xua tan đi tất cả mệt mỏi trong ngày.',
        'Đậm đà hương vị cuộc sống, tiếp thêm sinh khí và may mắn cho bạn.'
    ],
    4: [
        'Vững chãi và no ấm trọn vẹn, chiếc bụng no sẽ đem lại tâm an lành.',
        'Một bữa ăn trọn vẹn như đất mẹ bao dung, nuôi dưỡng cả thể xác lẫn tinh thần.'
    ]
};

// Trạng thái cục bộ của Chiêm Tinh
let allDishes = [];
let currentSpread = 'three'; // 'single' | 'pair' | 'three' | 'elemental'
let currentMood = 'all';
let altarCards = []; // Mảng chứa các lá bài hiện tại trên bàn thờ
let isRevealingAll = false;
let oracleCallbacks = {};
let journalSearchQuery = '';

/* ==========================================================================
   KHỞI TẠO ỨNG DỤNG
   ========================================================================== */
export async function initCulinaryOracle(options = {}) {
    oracleCallbacks = options;
    if (options.dishes && Array.isArray(options.dishes) && options.dishes.length > 0) {
        allDishes = options.dishes;
    } else {
        await loadDishDatabase();
    }
    setupHeaderEvents();
    renderRitualPanel();
    drawTarotCards();
}

async function loadDishDatabase() {
    const candidatePaths = [
        new URL(/* @vite-ignore */ '../data/dishes.json', import.meta.url).href,
        './data/dishes.json',
        '../data/dishes.json',
        '/data/dishes.json',
        '/src/meal-feature/data/dishes.json'
    ];

    for (const path of candidatePaths) {
        try {
            const res = await fetch(path);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    allDishes = data;
                    break;
                }
            }
        } catch (_) { }
    }

    if (!allDishes || allDishes.length === 0) {
        allDishes = getFallbackDishes();
    }
}

function getFallbackDishes() {
    return [
        { id: 1, name: 'Phở Bò Tái Lăn', price: 50000, category: 'mon-nuoc', type: 'man', description: 'Nước dùng trong veo ngọt thanh xương bò', image: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=800&q=80', tags: ['no', 'dam-da'] },
        { id: 2, name: 'Cơm Tấm Sườn Bì Chả', price: 45000, category: 'mon-com', type: 'man', description: 'Sườn nướng mật ong thơm phức', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80', tags: ['no', 'phobien'] },
        { id: 3, name: 'Bún Đậu Mắm Tôm', price: 40000, category: 'mon-kho', type: 'man', description: 'Đậu rán vàng giòn chấm mắm tôm sủi bọt', image: 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=800&q=80', tags: ['an-vui', 'dam-da'] },
        { id: 4, name: 'Bánh Mì Chảo Đặc Biệt', price: 35000, category: 'mon-kho', type: 'man', description: 'Pate béo ngậy, trứng ốp la lòng đào', image: 'https://images.unsplash.com/photo-1526318896980-cf78c088247c?auto=format&fit=crop&w=800&q=80', tags: ['gion-rum', 'no'] },
        { id: 5, name: 'Bún Chả Hà Nội', price: 45000, category: 'mon-kho', type: 'man', description: 'Chả nướng than hoa đượm khói thơm nức', image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80', tags: ['ngon-lanh'] },
        { id: 6, name: 'Mì Cay Hàn Quốc', price: 48000, category: 'mon-nuoc', type: 'man', description: 'Tôm mực tươi rói 7 cấp độ cay xé lưỡi', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80', tags: ['cay', 'no'] },
        { id: 7, name: 'Bánh Tráng Nướng Đà Lạt', price: 20000, category: 'an-vat', type: 'man', description: 'Pizza Việt Nam giòn rụm béo ngậy', image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80', tags: ['an-vui', 'tiet-kiem'] },
        { id: 8, name: 'Trà Sữa Trân Châu Hoàng Gia', price: 32000, category: 'do-uong', type: 'chay', description: 'Trà đen đậm vị sữa thơm béo', image: 'https://images.unsplash.com/photo-1558857563-b37cf5bc8db3?auto=format&fit=crop&w=800&q=80', tags: ['ngot-ngao'] }
    ];
}

/* ==========================================================================
   CÀI ĐẶT SỰ KIỆN THANH ĐIỀU HƯỚNG
   ========================================================================== */
function setupHeaderEvents() {
    const soundBtns = [
        document.getElementById('sound-toggle-btn'),
        document.getElementById('arena-sound-toggle-btn')
    ].filter(Boolean);

    function updateIcons() {
        soundBtns.forEach(btn => {
            btn.textContent = isSoundEnabled() ? '🔊' : '🔇';
            btn.title = isSoundEnabled() ? 'Tắt âm thanh' : 'Bật âm thanh';
        });
    }

    soundBtns.forEach(btn => {
        btn.onclick = () => {
            toggleSound();
            playUiClick();
            updateIcons();
        };
    });
    updateIcons();

    // Nút mở Sổ Quẻ (Lịch sử)
    const journalBtns = [
        document.getElementById('open-journal-btn'),
        document.getElementById('arena-journal-btn')
    ].filter(Boolean);

    journalBtns.forEach(btn => {
        btn.onclick = () => {
            playUiClick();
            openJournalModal();
        };
    });
}

/* ==========================================================================
   RENDER KHUNG ĐIỀU KHIỂN RÚT QUẺ (RITUAL PANEL)
   ========================================================================== */
function renderRitualPanel() {
    const container = document.getElementById('ritual-panel-container');
    if (!container) return;

    const moodChipsHtml = MOODS.map(m => `
    <button class="mood-chip ${m.id === currentMood ? 'active' : ''}" data-mood="${m.id}">
      ${m.label}
    </button>
  `).join('');

    container.innerHTML = `
    <div class="ritual-panel">
      <!-- Dòng 1: Kiểu trải bài -->
      <div class="ritual-row">
        <div class="ritual-label">
          <span>✨</span> Kiểu Trải Bài:
        </div>
        <div class="spread-type-selector">
          <button class="spread-btn ${currentSpread === 'single' ? 'active' : ''}" data-spread="single">
            ⚡ 1 Lá (Một Chạm)
          </button>
          <button class="spread-btn ${currentSpread === 'pair' ? 'active' : ''}" data-spread="pair">
            🍲 2 Lá (Song Hỷ)
          </button>
          <button class="spread-btn ${currentSpread === 'three' ? 'active' : ''}" data-spread="three">
            🌟 3 Lá (Tam Hợp)
          </button>
          <button class="spread-btn ${currentSpread === 'elemental' ? 'active' : ''}" data-spread="elemental">
            👑 5 Lá (Ngũ Hành)
          </button>
        </div>
      </div>

      <!-- Dòng 2: Bắt mạch cảm xúc -->
      <div class="ritual-row">
        <div class="ritual-label">
          <span>🎭</span> Bắt Mạch Cảm Xúc:
        </div>
        <div class="mood-selector">
          ${moodChipsHtml}
        </div>
      </div>
    </div>
  `;

    // Sự kiện chọn Kiểu trải bài
    container.querySelectorAll('.spread-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const spread = btn.dataset.spread;
            if (spread === currentSpread) return;
            playUiClick();
            currentSpread = spread;
            renderRitualPanel();
            drawTarotCards();
        });
    });

    // Sự kiện chọn Tâm trạng
    container.querySelectorAll('.mood-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            const mood = btn.dataset.mood;
            if (mood === currentMood) return;
            playUiClick();
            currentMood = mood;
            renderRitualPanel();
            drawTarotCards();
        });
    });
}

/* ==========================================================================
   XÀO BÀI & RÚT QUẺ (DRAW TAROT CARDS)
   ========================================================================== */
function drawTarotCards() {
    playCardFlip();
    const config = SPREAD_CONFIGS[currentSpread];
    const moodObj = MOODS.find(m => m.id === currentMood) || MOODS[0];

    // Lọc món theo cảm xúc
    let candidateDishes = allDishes.filter(moodObj.filter);
    if (candidateDishes.length < config.count) {
        candidateDishes = allDishes;
    }

    // Xáo trộn và lấy đủ số lượng lá bài theo trọng số tỉ lệ cấu hình
    const chosenDishes = pickWeightedDishes(candidateDishes, config.count);
    trackAnalyticsEvent('game_roll', {
      game: 'arena_tarot',
      spread: currentSpread,
      mood: currentMood,
      dishes: chosenDishes.map(d => ({ id: d.id, name: d.name, isSponsored: d.isSponsored, isBestseller: d.isBestseller })),
    });

    altarCards = chosenDishes.map((dish, i) => {
        const slot = config.slots[i] || config.slots[0];
        const pool = PROPHECIES_BY_SLOT[i] || PROPHECIES_BY_SLOT[2];
        const prophecy = pool[Math.floor(Math.random() * pool.length)];

        return {
            dish,
            slotLabel: slot.label,
            slotIcon: slot.icon,
            slotDesc: slot.desc,
            prophecy,
            flipped: false
        };
    });

    renderAltar();
}

/* ==========================================================================
   HIỂN THỊ BÀN THỜ TAROT (RENDER ALTAR)
   ========================================================================== */
function renderAltar() {
    const container = document.getElementById('altar-container');
    if (!container) return;

    const config = SPREAD_CONFIGS[currentSpread];
    const cardsClass = `cards-${config.count}`;

    const cardsHtml = altarCards.map((card, idx) => {
        const priceFormatted = Number(card.dish.price).toLocaleString('vi-VN') + ' đ';
        const fallbackImg = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80';
        const tagsHtml = (card.dish.tags || []).slice(0, 3).map(t => `<span class="tarot-tag">#${t}</span>`).join('');

        return `
      <div class="tarot-slot">
        <div class="slot-header">
          <span>${card.slotIcon}</span>
          <span>${card.slotLabel}</span>
        </div>

        <div class="tarot-card ${card.flipped ? 'flipped' : ''}" data-index="${idx}">
          <!-- MẶT SAU THẦN BÍ (BACK FACE) -->
          <div class="tarot-face tarot-back">
            <div class="tarot-shimmer-layer"></div>
            <div class="tarot-back-top">★ ✦ ✦ ★</div>
            <div class="tarot-mandala">
              <div class="tarot-cosmic-glyph">🔯</div>
              <div class="tarot-touch-hint">Chạm để khai mở</div>
            </div>
            <div class="tarot-back-bottom">★ ✦ ✦ ★</div>
          </div>

          <!-- MẶT TRƯỚC TIẾT LỘ MÓN ĂN (FRONT FACE) -->
          <div class="tarot-face tarot-front">
            <div class="tarot-shimmer-layer"></div>
            <div class="tarot-dish-img-wrap">
              <img class="tarot-dish-img" src="${card.dish.image || fallbackImg}" alt="${card.dish.name}" onerror="this.src='${fallbackImg}'" />
              <div class="tarot-dish-gradient"></div>
              <div class="tarot-type-badge">
                ${card.dish.type === 'chay' ? '🥗 Món Chay' : '🍖 Món Mặn'}
              </div>
              <div class="tarot-price-badge">${priceFormatted}</div>
            </div>

            <div class="tarot-front-body">
              <h3 class="tarot-dish-title">${card.dish.name}</h3>
              <div class="tarot-tags-row">
                ${tagsHtml}
              </div>
              <div class="tarot-prophecy-quote">
                "${card.prophecy}"
              </div>
              <div class="tarot-card-actions">
                <button type="button" class="btn-tarot-action btn-tarot-fav ${oracleCallbacks.isFav?.(card.dish.id) ? 'active' : ''}" data-dish-id="${card.dish.id}" title="Lưu vào Gu của tôi">
                  ${oracleCallbacks.isFav?.(card.dish.id) ? '❤️ Đã lưu gu' : '🤍 Lưu gu'}
                </button>
                <button type="button" class="btn-tarot-action btn-tarot-meal" data-dish-id="${card.dish.id}" title="Dựng mâm cơm ngay với món này">
                  🍽️ Dựng bữa
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    }).join('');

    const allFlipped = altarCards.every(c => c.flipped);

    container.innerHTML = `
    <div class="tarot-altar">
      <div class="tarot-cards-container ${cardsClass}">
        ${cardsHtml}
      </div>

      <!-- Thanh thao tác dưới bàn thờ -->
      <div class="altar-actions">
        ${!allFlipped ? `
          <button class="btn-mystic-primary" id="btn-reveal-all">
            ✨ Khai Mở Toàn Bộ Quẻ
          </button>
        ` : `
          <button class="btn-mystic-primary" id="btn-save-fortune">
            📖 Lưu Quẻ Vào Sổ Chiêm Tinh
          </button>
          <button class="btn-mystic-secondary" id="btn-altar-build-meal" style="background:linear-gradient(135deg, rgba(234,88,12,0.35), rgba(245,158,11,0.25)); border-color:rgba(245,158,11,0.6); color:#ffedd5; font-weight:700;">
            🍽️ Dựng Mâm Cơm Từ Quẻ
          </button>
        `}
        <button class="btn-mystic-secondary" id="btn-redraw">
          🔄 Gieo Quẻ Khác
        </button>
        <button class="btn-mystic-secondary" id="btn-share-fortune">
          🔗 Chia Sẻ Quẻ Này
        </button>
      </div>
    </div>
  `;

    // Gắn sự kiện lật từng thẻ
    container.querySelectorAll('.tarot-card').forEach(cardEl => {
        cardEl.addEventListener('click', () => {
            const idx = Number(cardEl.dataset.index);
            flipCard(idx, cardEl);
        });
    });

    // Nút Khai mở toàn bộ
    const revealBtn = container.querySelector('#btn-reveal-all');
    if (revealBtn) {
        revealBtn.addEventListener('click', revealAllCards);
    }

    // Nút Lưu quẻ
    const saveBtn = container.querySelector('#btn-save-fortune');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            playUiClick();
            saveFortune({
                spreadType: SPREAD_CONFIGS[currentSpread].name,
                mood: (MOODS.find(m => m.id === currentMood) || {}).label,
                cards: altarCards
            });
            alert('🌟 Đã lưu quẻ bói thành công vào Sổ Tay Chiêm Tinh!');
        });
    }

    // Nút Gieo lại
    const redrawBtn = container.querySelector('#btn-redraw');
    if (redrawBtn) {
        redrawBtn.addEventListener('click', () => {
            playUiClick();
            drawTarotCards();
        });
    }

    // Nút Chia sẻ quẻ
    const shareBtn = container.querySelector('#btn-share-fortune');
    if (shareBtn) {
        shareBtn.addEventListener('click', shareFortune);
    }

    // Hiệu ứng nghiêng 3D Hologram theo vị trí chuột
    attachCardTiltEffects(container);

    // Gắn sự kiện các nút tương tác trên mặt thẻ bài
    container.querySelectorAll('.btn-tarot-fav').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            playUiClick();
            const dishId = Number(btn.dataset.dishId);
            if (oracleCallbacks.onToggleFav) {
                oracleCallbacks.onToggleFav(dishId);
                const isNowFav = oracleCallbacks.isFav ? oracleCallbacks.isFav(dishId) : false;
                btn.classList.toggle('active', isNowFav);
                btn.textContent = isNowFav ? '❤️ Đã lưu gu' : '🤍 Lưu gu';
            }
        });
    });

    // Nút Dựng mâm cơm từ quẻ trên Altar
    const altarBuildMealBtn = container.querySelector('#btn-altar-build-meal');
    if (altarBuildMealBtn) {
        altarBuildMealBtn.addEventListener('click', () => {
            playUiClick();
            const dishesToBuild = altarCards.map(c => c.dish).filter(Boolean);
            if (oracleCallbacks.onGoToMeal) {
                oracleCallbacks.onGoToMeal(dishesToBuild);
            }
        });
    }

    container.querySelectorAll('.btn-tarot-meal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            playUiClick();
            const dishId = Number(btn.dataset.dishId);
            const foundCard = altarCards.find(c => c.dish && c.dish.id === dishId);
            const dish = foundCard ? foundCard.dish : allDishes.find(d => d.id === dishId);
            if (oracleCallbacks.onGoToMeal) {
                oracleCallbacks.onGoToMeal(dish ? [dish] : []);
            }
        });
    });
}

function attachCardTiltEffects(container) {
    container.querySelectorAll('.tarot-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            const isFlipped = card.classList.contains('flipped');
            const baseRotateY = isFlipped ? 180 : 0;
            const tiltX = -y * 14;
            const tiltY = baseRotateY + x * (isFlipped ? -14 : 14);
            card.style.transform = `perspective(1000px) translateY(-8px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
        });

        card.addEventListener('mouseleave', () => {
            const isFlipped = card.classList.contains('flipped');
            card.style.transform = isFlipped ? 'rotateY(180deg)' : '';
        });
    });
}

function flipCard(idx, cardEl) {
    if (altarCards[idx].flipped) return;

    altarCards[idx].flipped = true;
    cardEl.classList.add('flipped');
    playOracleChime();

    // Kiểm tra nếu tất cả các lá bài đã được lật
    if (altarCards.every(c => c.flipped)) {
        setTimeout(() => {
            playRevelationGong();
            launchConfetti(3500);
            renderAltar();
        }, 500);
    }
}

function revealAllCards() {
    if (isRevealingAll) return;
    isRevealingAll = true;

    const cardEls = document.querySelectorAll('.tarot-card');
    let delay = 0;

    cardEls.forEach((cardEl, idx) => {
        if (!altarCards[idx].flipped) {
            setTimeout(() => {
                altarCards[idx].flipped = true;
                cardEl.classList.add('flipped');
                playOracleChime();
            }, delay);
            delay += 320;
        }
    });

    setTimeout(() => {
        playRevelationGong();
        launchConfetti(3500);
        isRevealingAll = false;
        renderAltar();
    }, delay + 300);
}

function shareFortune() {
    playUiClick();
    const summary = altarCards.map(c => `• ${c.slotLabel}: ${c.dish.name} (${Number(c.dish.price).toLocaleString('vi-VN')}đ)`).join('\n');
    const shareText = `🔮 [QUẺ CHIÊM TINH BỮA ĂN HÔM NAY]\n${summary}\n👉 Cùng đi ăn thôi nào!`;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(shareText).then(() => {
            alert('📋 Đã sao chép nội dung quẻ chiêm tinh vào bộ nhớ tạm để gửi bạn bè:\n\n' + shareText);
        }).catch(() => {
            prompt('Sao chép quẻ chiêm tinh của bạn:', shareText);
        });
    } else {
        prompt('Sao chép quẻ chiêm tinh của bạn:', shareText);
    }
}

/* ==========================================================================
   MODAL SỔ TAY QUẺ CHIÊM TINH (JOURNAL MODAL)
   ========================================================================== */
function openJournalModal() {
    const modal = document.getElementById('journal-modal-backdrop');
    if (!modal) return;

    renderJournalEntries();
    modal.classList.add('open');

    const closeBtn = document.getElementById('journal-close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => modal.classList.remove('open');
    }

    modal.onclick = (e) => {
        if (e.target === modal) modal.classList.remove('open');
    };
}

function renderJournalEntries() {
    const container = document.getElementById('journal-entries-container');
    if (!container) return;

    const fortunes = getSavedFortunes();

    if (fortunes.length === 0) {
        container.innerHTML = `
      <div style="text-align: center; padding: 50px 20px; color: var(--text-dim);">
        <div style="font-size: 3rem; margin-bottom: 12px;">📖</div>
        <h4>Sổ tay chiêm tinh còn trống</h4>
        <p style="font-size: 0.88rem; margin-top: 6px;">Hãy gieo quẻ và bấm "Lưu Quẻ Vào Sổ Chiêm Tinh" để lưu lại những dự cảm may mắn!</p>
      </div>
    `;
        return;
    }

    const filteredFortunes = fortunes.filter(f => {
        if (!journalSearchQuery) return true;
        const q = journalSearchQuery.toLowerCase();
        const matchesType = (f.spreadType || '').toLowerCase().includes(q);
        const matchesMood = (f.mood || '').toLowerCase().includes(q);
        const matchesDish = (f.cards || []).some(c => (c.dishName || '').toLowerCase().includes(q));
        return matchesType || matchesMood || matchesDish;
    });

    const entriesHtml = filteredFortunes.map((f, idx) => {
        const dateFormatted = new Date(f.date).toLocaleDateString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        const chipsHtml = f.cards.map(c => `
      <div class="journal-dish-chip">
        <span>${c.slotLabel}:</span> <strong>${c.dishName}</strong>
      </div>
    `).join('');

        return `
      <div class="journal-entry-card">
        <div class="journal-entry-meta">
          <span style="color:#fbbf24; font-weight:700;">${f.spreadType} &bull; ${f.mood}</span>
          <div style="display:flex; align-items:center; gap:8px;">
            <span>${dateFormatted}</span>
            <button type="button" class="btn-copy-fortune-item" data-idx="${idx}" title="Sao chép quẻ này">📋</button>
          </div>
        </div>
        <div class="journal-dishes-chips">
          ${chipsHtml}
        </div>
      </div>
    `;
    }).join('');

    container.innerHTML = `
    <div class="journal-toolbar">
      <input type="text" id="journal-search-input" class="journal-search" placeholder="🔍 Tìm quẻ theo món, kiểu trải bài..." value="${escapeHTML(journalSearchQuery)}">
      <button class="btn-mystic-link" id="btn-clear-journal" style="font-size:0.78rem; padding:4px 10px; white-space:nowrap;">
        🗑️ Xóa Lịch Sử
      </button>
    </div>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-size:0.82rem; color:var(--text-muted);">
      <span>Hiển thị ${filteredFortunes.length} / ${fortunes.length} quẻ đã lưu</span>
    </div>
    ${filteredFortunes.length > 0 ? entriesHtml : '<p style="text-align:center; color:var(--text-dim); padding:24px;">Không tìm thấy quẻ phù hợp với từ khóa.</p>'}
  `;

    const searchInput = container.querySelector('#journal-search-input');
    if (searchInput) {
        searchInput.oninput = (e) => {
            journalSearchQuery = e.target.value;
            renderJournalEntries();
            const reInput = container.querySelector('#journal-search-input');
            if (reInput) {
                reInput.focus();
                reInput.setSelectionRange(reInput.value.length, reInput.value.length);
            }
        };
    }

    container.querySelectorAll('.btn-copy-fortune-item').forEach(btn => {
        btn.onclick = () => {
            const idx = Number(btn.dataset.idx);
            const fortune = filteredFortunes[idx];
            if (!fortune) return;
            const summary = (fortune.cards || []).map(c => `• ${c.slotLabel}: ${c.dishName}`).join('\n');
            const text = `🔮 [QUẺ CHIÊM TINH: ${fortune.spreadType} - ${fortune.mood}]\n${summary}\n👉 BungOiAnGi Food Tarot`;
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(() => {
                    btn.textContent = '✅';
                    setTimeout(() => { btn.textContent = '📋'; }, 1500);
                });
            } else {
                prompt('Sao chép quẻ:', text);
            }
        };
    });

    const clearBtn = container.querySelector('#btn-clear-journal');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử trong sổ chiêm tinh?')) {
                clearFortuneHistory();
                journalSearchQuery = '';
                renderJournalEntries();
            }
        });
    }
}

function escapeHTML(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/* ==========================================================================
   TIỆN ÍCH
   ========================================================================== */
function shuffleArray(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

// Tự khởi chạy khi DOM sẵn sàng nếu chạy độc lập
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        if (document.body.classList.contains('culinary-arena-standalone')) {
            initCulinaryOracle();
        }
    });
}
