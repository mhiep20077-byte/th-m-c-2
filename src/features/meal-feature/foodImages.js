/**
 * Quản lý ảnh món ăn cho chức năng dựng bữa cơm.
 */
const IMAGE_POOLS = {
    'mon-nuoc': [0, 1, 2, 3, 4].map(i => `food-hd-${i}.webp`),
    'mon-com': [0, 1, 2, 3].map(i => `food-lunch-${i}.webp`),
    'mon-kho': [0, 1, 2].map(i => `food-expanded-${i}.webp`),
    'an-vat': [5, 6, 7, 8].map(i => `food-hd-${i}.webp`).concat('food-common-0.webp'),
    'mon-ngot': [5, 6, 7, 8].map(i => `food-hd-${i}.webp`).concat('food-common-0.webp'),
    'do-uong': [5, 6, 7].map(i => `food-hd-${i}.webp`).concat('food-common-0.webp')
};

export const FALLBACK_FOOD_IMAGE = '/food-common-0.webp';
export const ALL_FOOD_IMAGES = Array.from(new Set(Object.values(IMAGE_POOLS).flat()));

export function pickFoodImage(categoryId, indexInCategory) {
    const pool = IMAGE_POOLS[categoryId];
    if (!pool || pool.length === 0) return FALLBACK_FOOD_IMAGE;
    const index = Number.isInteger(indexInCategory) && indexInCategory >= 0 ? indexInCategory : 0;
    return `/${pool[index % pool.length]}`;
}

export function applyFoodImages(dishes) {
    if (!Array.isArray(dishes)) return dishes;

    const counters = new Map();
    dishes.forEach(dish => {
        const categoryId = dish.category;
        const index = counters.get(categoryId) ?? 0;
        counters.set(categoryId, index + 1);
        dish.image = pickFoodImage(categoryId, index);
    });

    return dishes;
}

export function foodImageFallback(alt = 'Món ăn') {
    const label = String(alt).replace(/[<>&"']/g, '').slice(0, 18);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
<rect width="400" height="300" fill="#1c1a17"/>
<text x="200" y="150" fill="#8d8477" font-family="system-ui,sans-serif" font-size="22"
 text-anchor="middle">${label}</text>
</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
