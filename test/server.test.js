import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolveClose, rejectClose) => server.close(error => error ? rejectClose(error) : resolveClose()));
  return port;
}

async function waitForServer(baseUrl, child) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    if (child.exitCode !== null) throw new Error('API process exited before becoming ready.');
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      await new Promise(resolveWait => setTimeout(resolveWait, 75));
    }
  }
  throw new Error('API did not become ready within twelve seconds.');
}

async function jsonRequest(url, { token, method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { response, data: text ? JSON.parse(text) : null };
}

test('roles protect admin APIs and customer data is scoped to its owner', { timeout: 20000 }, async t => {
  const port = await freePort();
  const databaseDirectory = mkdtempSync(join(tmpdir(), 'bungoiangi-api-'));
  const databasePath = join(databaseDirectory, 'db.json');
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      API_PORT: String(port),
      DATABASE_PATH: databasePath,
      ADMIN_EMAIL: 'admin@test.local',
      ADMIN_PASSWORD: 'SecureAdmin123!',
      JWT_SECRET: 'test-secret-that-is-long-enough-for-jwt-validation',
      CORS_ORIGINS: 'https://webb-bung-oi-an-gi.vercel.app',
      NODE_ENV: 'test',
    },
    stdio: 'ignore',
  });

  t.after(async () => {
    if (child.exitCode === null) {
      child.kill();
      await Promise.race([once(child, 'exit'), new Promise(resolveWait => setTimeout(resolveWait, 1000))]);
    }
    rmSync(databaseDirectory, { recursive: true, force: true });
  });

  await waitForServer(baseUrl, child);

  const preflight = await fetch(`${baseUrl}/660/api/admin/dishes`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://webb-bung-oi-an-gi.vercel.app',
      'Access-Control-Request-Method': 'PATCH',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://webb-bung-oi-an-gi.vercel.app');
  assert.match(preflight.headers.get('access-control-allow-headers'), /authorization/i);

  const allowedOriginResponse = await fetch(`${baseUrl}/health`, {
    headers: { Origin: 'https://webb-bung-oi-an-gi.vercel.app' },
  });
  assert.equal(allowedOriginResponse.headers.get('access-control-allow-origin'), 'https://webb-bung-oi-an-gi.vercel.app');

  const rejectedOrigin = await fetch(`${baseUrl}/660/api/admin/dishes`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://untrusted.example',
      'Access-Control-Request-Method': 'PATCH',
    },
  });
  assert.equal(rejectedOrigin.status, 403);
  assert.equal(rejectedOrigin.headers.get('access-control-allow-origin'), null);

  const anonymousStats = await jsonRequest(`${baseUrl}/660/api/admin/stats`);
  assert.equal(anonymousStats.response.status, 401);

  for (const resource of ['stats', 'dishes', 'users']) {
    const response = await jsonRequest(`${baseUrl}/660/api/admin/${resource}`);
    assert.equal(response.response.status, 401, `Anonymous GET /admin/${resource} must be rejected.`);
  }

  const adminLogin = await jsonRequest(`${baseUrl}/login`, {
    method: 'POST',
    body: { email: 'admin@test.local', password: 'SecureAdmin123!' },
  });
  assert.equal(adminLogin.response.status, 200);
  const adminToken = adminLogin.data.accessToken;

  const stats = await jsonRequest(`${baseUrl}/660/api/admin/stats`, { token: adminToken });
  assert.equal(stats.response.status, 200);
  assert.equal(stats.data.userCount, 1);

  const createdDish = await jsonRequest(`${baseUrl}/660/api/admin/dishes`, {
    token: adminToken,
    method: 'POST',
    body: { name: 'Món kiểm thử', price: 25000, type: 'man', tags: ['test'] },
  });
  assert.equal(createdDish.response.status, 201);
  const updatedDish = await jsonRequest(`${baseUrl}/660/api/admin/dishes/${createdDish.data.id}`, {
    token: adminToken,
    method: 'PATCH',
    body: { name: 'Món đã cập nhật' },
  });
  assert.equal(updatedDish.data.name, 'Món đã cập nhật');

  const quickToggleDish = await jsonRequest(`${baseUrl}/660/api/admin/dishes/${createdDish.data.id}/quick-toggle`, {
    token: adminToken,
    method: 'PATCH',
    body: { field: 'sponsored', value: true },
  });
  assert.equal(quickToggleDish.response.status, 200);
  assert.equal(quickToggleDish.data.isSponsored, true);

  const adminDishesList = await jsonRequest(`${baseUrl}/660/api/admin/dishes`, { token: adminToken });
  const fetchedDish = adminDishesList.data.find(d => d.id === createdDish.data.id);
  assert.equal(fetchedDish.isSponsored, true);

  const deletedDish = await jsonRequest(`${baseUrl}/660/api/admin/dishes/${createdDish.data.id}`, {
    token: adminToken,
    method: 'DELETE',
  });
  assert.equal(deletedDish.response.status, 204);

  const registration = await jsonRequest(`${baseUrl}/register`, {
    method: 'POST',
    body: { name: 'Khách kiểm thử', email: 'customer@test.local', password: ' Customer123! ', role: 'admin' },
  });
  assert.equal(registration.response.status, 201);
  assert.equal(registration.data.user.role, 'customer');
  const customerToken = registration.data.accessToken;

  const anonymousNearby = await jsonRequest(`${baseUrl}/660/api/nearby?lat=10&lng=106&radiusKm=5`);
  assert.equal(anonymousNearby.response.status, 401);

  const invalidNearbyQuery = await jsonRequest(`${baseUrl}/660/api/nearby?lat=91&lng=106&radiusKm=5`, {
    token: customerToken,
  });
  assert.equal(invalidNearbyQuery.response.status, 400);

  const customerLogin = await jsonRequest(`${baseUrl}/login`, {
    method: 'POST',
    body: { email: 'customer@test.local', password: ' Customer123! ' },
  });
  assert.equal(customerLogin.response.status, 200);
  assert.ok(customerLogin.data.accessToken);

  const forbiddenStats = await jsonRequest(`${baseUrl}/660/api/admin/stats`, { token: customerToken });
  assert.equal(forbiddenStats.response.status, 403);

  for (const resource of ['stats', 'dishes', 'users']) {
    const response = await jsonRequest(`${baseUrl}/660/api/admin/${resource}`, { token: customerToken });
    assert.equal(response.response.status, 403, `Customer GET /admin/${resource} must be forbidden.`);
  }

  const forbiddenAdminMutations = [
    { path: '/660/api/admin/dishes', method: 'POST', body: { name: 'Không được tạo', price: 1 } },
    { path: '/660/api/admin/dishes/1', method: 'PATCH', body: { name: 'Không được sửa' } },
    { path: '/660/api/admin/dishes/1', method: 'DELETE' },
    { path: '/660/api/admin/users', method: 'POST', body: { name: 'Không được tạo', email: 'forbidden@test.local', password: 'Customer123!' } },
    { path: '/660/api/admin/users/1', method: 'PATCH', body: { role: 'admin' } },
    { path: '/660/api/admin/users/1', method: 'DELETE' },
  ];
  for (const request of forbiddenAdminMutations) {
    const response = await jsonRequest(`${baseUrl}${request.path}`, {
      token: customerToken,
      method: request.method,
      body: request.body,
    });
    assert.equal(response.response.status, 403, `Customer ${request.method} ${request.path} must be forbidden.`);
  }

  const syncedFavorites = await jsonRequest(`${baseUrl}/660/api/customer/favorites`, {
    token: customerToken,
    method: 'PUT',
    body: { dishIds: [1, 2] },
  });
  assert.deepEqual(syncedFavorites.data.dishIds, [1, 2]);
  const customerHistory = await jsonRequest(`${baseUrl}/660/api/customer/history`, {
    token: customerToken,
    method: 'POST',
    body: { dishId: 1 },
  });
  assert.equal(customerHistory.response.status, 201);
  assert.equal(customerHistory.data.dish.name.length > 0, true);

  // Kiểm tra phân quyền Admin Gốc và Cộng Tác Viên (CTV)
  // 1. Admin gốc tạo tài khoản CTV
  const createCtvResponse = await jsonRequest(`${baseUrl}/660/api/admin/users`, {
    token: adminToken,
    method: 'POST',
    body: { name: 'Cộng Tác Viên 1', email: 'ctv1@test.local', password: 'CtvPassword123!', role: 'admin' },
  });
  assert.equal(createCtvResponse.response.status, 201);
  assert.equal(createCtvResponse.data.role, 'admin');
  assert.equal(createCtvResponse.data.isRootAdmin, false);
  assert.equal(createCtvResponse.data.isCtv, true);
  assert.equal(createCtvResponse.data.roleTitle, 'Cộng tác viên (CTV)');
  const ctvId = createCtvResponse.data.id;

  // 2. CTV đăng nhập thành công
  const ctvLogin = await jsonRequest(`${baseUrl}/login`, {
    method: 'POST',
    body: { email: 'ctv1@test.local', password: 'CtvPassword123!' },
  });
  assert.equal(ctvLogin.response.status, 200);
  const ctvToken = ctvLogin.data.accessToken;

  // 3. CTV không thể tùy chỉnh luật chơi / cài đặt hệ thống (403 Forbidden)
  const ctvUpdateSettings = await jsonRequest(`${baseUrl}/660/api/admin/settings`, {
    token: ctvToken,
    method: 'PUT',
    body: { gameRules: { sponsoredMultiplier: 10 } },
  });
  assert.equal(ctvUpdateSettings.response.status, 403);
  assert.match(ctvUpdateSettings.data.message, /Chỉ có Admin gốc/);

  // 4. CTV không thể tạo tài khoản Admin/CTV mới (403 Forbidden)
  const ctvCreateAdmin = await jsonRequest(`${baseUrl}/660/api/admin/users`, {
    token: ctvToken,
    method: 'POST',
    body: { name: 'Admin Lậu', email: 'adminlau@test.local', password: 'Password123!', role: 'admin' },
  });
  assert.equal(ctvCreateAdmin.response.status, 403);
  assert.match(ctvCreateAdmin.data.message, /Cộng tác viên/);

  // 5. CTV không thể phân quyền admin cho khách hàng khác (403 Forbidden)
  const customerId = registration.data.user.id;
  const ctvPromoteUser = await jsonRequest(`${baseUrl}/660/api/admin/users/${customerId}`, {
    token: ctvToken,
    method: 'PATCH',
    body: { role: 'admin' },
  });
  assert.equal(ctvPromoteUser.response.status, 403);
  assert.match(ctvPromoteUser.data.message, /Chỉ có Admin gốc/);

  // 6. CTV không thể xóa tài khoản admin khác (403 Forbidden)
  const createCtv2Response = await jsonRequest(`${baseUrl}/660/api/admin/users`, {
    token: adminToken,
    method: 'POST',
    body: { name: 'Cộng Tác Viên 2', email: 'ctv2@test.local', password: 'CtvPassword123!', role: 'admin' },
  });
  const ctv2Id = createCtv2Response.data.id;

  const ctvDeleteCtv2 = await jsonRequest(`${baseUrl}/660/api/admin/users/${ctv2Id}`, {
    token: ctvToken,
    method: 'DELETE',
  });
  assert.equal(ctvDeleteCtv2.response.status, 403);
  assert.match(ctvDeleteCtv2.data.message, /Chỉ có Admin gốc/);

  // 7. Admin gốc có quyền lưu cài đặt hệ thống (200 OK)
  const rootUpdateSettings = await jsonRequest(`${baseUrl}/660/api/admin/settings`, {
    token: adminToken,
    method: 'PUT',
    body: { gameRules: { sponsoredMultiplier: 10 } },
  });
  assert.equal(rootUpdateSettings.response.status, 200);

  // 7b. CTV có quyền cập nhật các ô văn bản CMS (Tiêu đề, Nội dung...) nhưng checkbox bật/tắt được bảo toàn
  const ctvUpdateTextSettings = await jsonRequest(`${baseUrl}/660/api/admin/settings`, {
    token: ctvToken,
    method: 'PUT',
    body: {
      announcement: { title: 'Thông Báo Mới Bởi CTV', text: 'Giảm giá 50k', enabled: false }, // CTV tries to disable, but backend preserves enabled flag
      ads: { title: 'Banner Mới Bởi CTV' },
      features: { maintenanceNotice: 'Bảo trì lúc 2h sáng' },
    },
  });
  assert.equal(ctvUpdateTextSettings.response.status, 200);
  assert.equal(ctvUpdateTextSettings.data.announcement.title, 'Thông Báo Mới Bởi CTV');
  assert.equal(ctvUpdateTextSettings.data.announcement.text, 'Giảm giá 50k');
  assert.equal(ctvUpdateTextSettings.data.ads.title, 'Banner Mới Bởi CTV');
  assert.equal(ctvUpdateTextSettings.data.features.maintenanceNotice, 'Bảo trì lúc 2h sáng');
  // Flag toggle is preserved from current settings
  assert.equal(ctvUpdateTextSettings.data.announcement.enabled, true);

  // 7c. CTV có thể tạo tài khoản Khách hàng mới (201 Created)
  const ctvCreateCustomer = await jsonRequest(`${baseUrl}/660/api/admin/users`, {
    token: ctvToken,
    method: 'POST',
    body: { name: 'Khách Tạo Bởi CTV', email: 'khach_ctv@test.local', password: 'Password123!', role: 'customer' },
  });
  assert.equal(ctvCreateCustomer.response.status, 201);
  assert.equal(ctvCreateCustomer.data.role, 'customer');

  // 7d. Admin Gốc Chính tạo Admin Gốc Phụ (sub_root)
  const createSubRoot = await jsonRequest(`${baseUrl}/660/api/admin/users`, {
    token: adminToken,
    method: 'POST',
    body: { name: 'Admin Gốc Phụ Test', email: 'subroot@test.local', password: 'Password123!', role: 'sub_root' },
  });
  assert.equal(createSubRoot.response.status, 201);
  assert.equal(createSubRoot.data.adminLevel, 'sub_root');

  const subRootLogin = await jsonRequest(`${baseUrl}/login`, {
    method: 'POST',
    body: { email: 'subroot@test.local', password: 'Password123!' },
  });
  assert.equal(subRootLogin.response.status, 200);
  const subRootToken = subRootLogin.data.accessToken;

  // 7e. Admin Gốc Phụ có thể tạo Khách hàng (201 Created)
  const subRootCreateCustomer = await jsonRequest(`${baseUrl}/660/api/admin/users`, {
    token: subRootToken,
    method: 'POST',
    body: { name: 'Khách Tạo Bởi SubRoot', email: 'khach_subroot@test.local', password: 'Password123!', role: 'customer' },
  });
  assert.equal(subRootCreateCustomer.response.status, 201);

  // 7f. Admin Gốc Phụ có thể tạo Cộng tác viên CTV (201 Created)
  const subRootCreateCtv = await jsonRequest(`${baseUrl}/660/api/admin/users`, {
    token: subRootToken,
    method: 'POST',
    body: { name: 'CTV Tạo Bởi SubRoot', email: 'ctv_subroot@test.local', password: 'Password123!', role: 'ctv' },
  });
  assert.equal(subRootCreateCtv.response.status, 201);
  assert.equal(subRootCreateCtv.data.adminLevel, 'ctv');

  // 7g. Admin Gốc Phụ KHÔNG THỂ tạo thêm Admin Gốc Phụ khác (403 Forbidden - Chỉ Admin Gốc Chính mới có quyền)
  const subRootCreateAnotherSubRoot = await jsonRequest(`${baseUrl}/660/api/admin/users`, {
    token: subRootToken,
    method: 'POST',
    body: { name: 'SubRoot Trai Phep', email: 'subroot_illegal@test.local', password: 'Password123!', role: 'sub_root' },
  });
  assert.equal(subRootCreateAnotherSubRoot.response.status, 403);
  assert.match(subRootCreateAnotherSubRoot.data.message, /Chỉ có Admin Gốc Chính/);

  // 8. Admin gốc có quyền xóa các tài khoản CTV khác (204 No Content)
  const rootDeleteCtv = await jsonRequest(`${baseUrl}/660/api/admin/users/${ctvId}`, {
    token: adminToken,
    method: 'DELETE',
  });
  assert.equal(rootDeleteCtv.response.status, 204);

  const rootDeleteCtv2 = await jsonRequest(`${baseUrl}/660/api/admin/users/${ctv2Id}`, {
    token: adminToken,
    method: 'DELETE',
  });
  assert.equal(rootDeleteCtv2.response.status, 204);
});

test('sanitizeUser retains sub_root adminLevel and roles without demoting to CTV', async () => {
  const { sanitizeUser } = await import('../src/utils/auth.js');
  const user = {
    id: 4,
    name: '10',
    email: 'hhiepm003@gmail.com',
    role: 'admin',
    adminLevel: 'sub_root'
  };
  const sanitized = sanitizeUser(user);
  assert.equal(sanitized.adminLevel, 'sub_root');
  assert.equal(sanitized.isSubRootAdmin, true);
  assert.equal(sanitized.isCtv, false);
  assert.equal(sanitized.roleTitle, 'Admin Gốc Phụ');
  assert.equal(sanitized.canManageSettings, true);
});
