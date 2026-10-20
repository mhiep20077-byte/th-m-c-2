/**
 * =========================================================================
 * QUẢN LÝ LƯU TRỮ SỔ QUẺ CHIÊM TINH (ORACLE FORTUNE JOURNAL)
 * =========================================================================
 */

const STORAGE_KEY_ORACLE_HISTORY = 'culinary-oracle-history';

/**
 * Lấy lịch sử các quẻ chiêm tinh đã gieo
 */
export function getSavedFortunes() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_ORACLE_HISTORY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

/**
 * Lưu một quẻ bói mới vào sổ tay chiêm tinh
 */
export function saveFortune(fortuneData) {
    try {
        const list = getSavedFortunes();
        const entry = {
            id: 'fortune_' + Date.now(),
            spreadType: fortuneData.spreadType || 'Tam Hợp Ẩm Thực',
            mood: fortuneData.mood || 'Tự do',
            cards: fortuneData.cards.map(c => ({
                dishName: c.dish.name,
                price: c.dish.price,
                image: c.dish.image,
                category: c.dish.category,
                slotLabel: c.slotLabel,
                prophecy: c.prophecy
            })),
            date: new Date().toISOString()
        };

        list.unshift(entry);
        // Giữ tối đa 25 quẻ gần nhất
        const trimmed = list.slice(0, 25);
        localStorage.setItem(STORAGE_KEY_ORACLE_HISTORY, JSON.stringify(trimmed));
        return trimmed;
    } catch (e) {
        console.error('Không thể lưu quẻ chiêm tinh:', e);
        return [];
    }
}

/**
 * Xóa toàn bộ lịch sử quẻ
 */
export function clearFortuneHistory() {
    try {
        localStorage.removeItem(STORAGE_KEY_ORACLE_HISTORY);
    } catch (_) { }
}