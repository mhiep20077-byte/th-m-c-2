/**
 * Bậc hiếm của món, quyết định từ mức giá.
 * Bộ âm thanh chia theo 4 bậc hiếm (rare → ancient) để lúc lộ món nghe hợp với giá trị món.
 */

export const RARITY_ORDER = ['common', 'rare', 'mythical', 'legendary', 'ancient'];

export const RARITY_TIERS = [
    { id: 'common', label: 'Phổ thông', min: 0, max: 19999, sound: 'revealRare', gain: 0.6, icon: '🥄' },
    { id: 'rare', label: 'Hiếm', min: 20000, max: 34999, sound: 'revealRare', gain: 0.8, icon: '🔹' },
    { id: 'mythical', label: 'Huyền thoại nhẹ', min: 35000, max: 54999, sound: 'revealMythical', gain: 0.9, icon: '💠' },
    { id: 'legendary', label: 'Huyền thoại', min: 55000, max: 99999, sound: 'revealLegendary', gain: 1, icon: '🔶' },
    { id: 'ancient', label: 'Cổ đại', min: 100000, max: Infinity, sound: 'revealAncient', gain: 1, icon: '💎' }
];

const DEFAULT_RARITY = RARITY_TIERS[0];

export function rarityForPrice(price) {
    const value = Number(price);
    if (!Number.isFinite(value) || value < RARITY_TIERS[0].min) return DEFAULT_RARITY;
    return RARITY_TIERS.find(tier => value <= tier.max) || RARITY_TIERS[RARITY_TIERS.length - 1];
}

export function rarityOf(dish) {
    if (!dish) return DEFAULT_RARITY;
    if (dish.rarity) {
        const preset = RARITY_TIERS.find(tier => tier.id === dish.rarity);
        if (preset) return preset;
    }
    return rarityForPrice(dish.price);
}

export function rarityLabel(dish) {
    const rarity = rarityOf(dish);
    return `${rarity.icon} ${rarity.label}`;
}
