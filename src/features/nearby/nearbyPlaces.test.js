import test from 'node:test';
import assert from 'node:assert/strict';
import { doesPlaceMatchDish, getCurrentPosition, serviceSearchUrl, googleMapsDirectionsUrl, estimateRoadDistanceKm } from './nearbyPlaces.js';

test('nearby results must identify the selected dish, ignoring Vietnamese accents', () => {
  assert.equal(doesPlaceMatchDish({
    name: 'Bún bò Huế O Xuân',
    tags: { cuisine: 'vietnamese' }
  }, 'Bún Bò Huế Đặc Biệt'), true);

  assert.equal(doesPlaceMatchDish({
    name: 'Quán cà phê bên đường',
    tags: { amenity: 'cafe', cuisine: 'coffee_shop' }
  }, 'Bún Bò Huế Đặc Biệt'), false);

  assert.equal(doesPlaceMatchDish({
    name: 'Bún bò Nam Bộ',
    tags: {}
  }, 'Bún Bò Huế Đặc Biệt'), false);
});

test('dish tags can identify a restaurant even when its name is generic', () => {
  assert.equal(doesPlaceMatchDish({
    name: 'Quán ăn gia đình',
    tags: { dish: 'Cơm tấm sườn bì chả' }
  }, 'Cơm Tấm Sườn Bì Chả'), true);
});

test('specialties can identify a restaurant with a different or generic name', () => {
  assert.equal(doesPlaceMatchDish({
    name: 'Bếp Cơm Cô Ba 1985',
    specialties: ['Cơm Tấm Sườn Bì Chả', 'Canh Khổ Qua']
  }, 'Cơm Tấm Sườn Bì Chả'), true);
});

test('denied GPS permission is reported without retrying the location request', async t => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let callCount = 0;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      geolocation: {
        getCurrentPosition(_resolve, reject) {
          callCount += 1;
          reject({ code: 1 });
        },
      },
    },
  });
  t.after(() => {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
  });

  await assert.rejects(getCurrentPosition(), /Bạn đã chặn quyền vị trí/);
  assert.equal(callCount, 1);
});

for (const platform of ['iOS', 'Android', 'PC']) {
  test(`delivery service links are HTTPS universal-link fallbacks on ${platform}`, () => {
    const grab = new URL(serviceSearchUrl('grab', 'bún bò Huế'));
    const shopee = new URL(serviceSearchUrl('shopee', 'bún bò Huế'));

    assert.equal(grab.protocol, 'https:');
    assert.equal(grab.hostname, 'food.grab.com');
    assert.equal(grab.searchParams.get('search'), 'bún bò Huế');
    assert.equal(shopee.protocol, 'https:');
    assert.equal(shopee.hostname, 'shopeefood.vn');
    assert.equal(shopee.searchParams.get('keyword'), 'bún bò Huế');
  });
}

test('googleMapsDirectionsUrl uses exact destination coordinates to prevent fuzzy search divergence', () => {
  const origin = { lat: 21.08, lng: 105.83 };
  const destination = {
    lat: 21.0739421,
    lng: 105.7741668,
    name: 'Bún bò Huế chất',
    address: '1 Ng. 59 P. Lê Văn Hiến, Đông Ngạc, Từ Liêm, Hà Nội'
  };

  const url = new URL(googleMapsDirectionsUrl(origin, destination));
  assert.equal(url.searchParams.get('api'), '1');
  assert.equal(url.searchParams.get('origin'), '21.08,105.83');
  assert.equal(url.searchParams.get('destination'), '21.0739421,105.7741668');
  assert.equal(url.searchParams.get('travelmode'), 'driving');
});

test('estimateRoadDistanceKm accurately scales urban straight-line distance to driving distance', () => {
  assert.equal(estimateRoadDistanceKm(0), 0);
  assert.equal(estimateRoadDistanceKm(0.5), 0.6); // 0.5 * 1.18 = 0.59 -> 0.6
  assert.equal(estimateRoadDistanceKm(2.0), 2.6); // 2.0 * 1.28 = 2.56 -> 2.6
  assert.equal(estimateRoadDistanceKm(5.8), 8.0); // 5.8 * 1.38 = 8.004 -> 8.0
});
