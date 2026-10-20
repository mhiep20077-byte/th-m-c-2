# 🍽️ Bản sao độc lập: Chức năng Dựng bữa cơm hoàn chỉnh (Meal Feature)

Module này được tách riêng hoàn chỉnh từ ứng dụng **BUNGOIANGI**, bao gồm toàn bộ mã nguồn, logic điều phối, giao diện (CSS), âm thanh (Web Audio API), dữ liệu mẫu và cơ chế lưu trữ (LocalStorage) liên quan đến chức năng **F11 - Dựng bữa cơm hoàn chỉnh**.

---

## 📁 Cấu trúc thư mục `src/meal-feature`

```text
src/meal-feature/
├── data/
│   └── dishes.json       # Cơ sở dữ liệu món ăn đầy đủ cho module
├── dishDetail.js         # Modal xem chi tiết món ăn (F04) tích hợp
├── dishRender.js         # Các hàm tiện ích định dạng tiền tệ và tên danh mục
├── filterUtils.js        # Định nghĩa các loại món ăn (Chay / Mặn)
├── foodImages.js         # Quản lý ánh xạ ảnh món ăn và fallback SVG
├── foodRarity.js         # Phân cấp độ hiếm của món theo giá
├── index.html            # Trang HTML độc lập để chạy thử & demo riêng tính năng
├── main.js               # Controller điều phối state, sự kiện và vòng đời tính năng
├── meal.css              # File stylesheet CSS độc lập đầy đủ hiệu ứng và responsive
├── meal.js               # Logic cốt lõi của Meal Builder (4 suất ăn, thuật toán bốc món, render panel)
├── priceFilter.js        # Định nghĩa 4 nhóm ngân sách (sinh-ton, sinh-vien, an-ngon, choi-lon)
├── sound.js              # Hệ thống âm thanh tổng hợp và hiệu ứng âm thanh
├── storage.js            # Lưu trữ LocalStorage (Sổ bữa ăn đã dọn, món thích/không thích)
└── README.md             # Hướng dẫn chi tiết
```

---

## 🎯 Các tính năng đã được tách riêng

1. **Khung mâm cơm 4 suất ăn chuẩn:**
   - 🍚 **Món chính:** Món quyết định bữa ăn (`mon-com`, `mon-nuoc`, `mon-kho`), có cờ quyết định tính chất chay/mặn (`savoryDecisive: true`).
   - 🥗 **Ăn kèm:** Đỡ ngán (`an-vat`, `mon-kho`), loại trừ món ngọt.
   - 🥤 **Đồ uống:** Giải khát trọn bữa (`do-uong`), tự do không ép chay/mặn.
   - 🍮 **Tráng miệng:** Chè hoặc món ngọt cuối bữa (`mon-ngot`, tag `ngot-ngao`), không lấy đồ uống, có fallback linh hoạt sang ăn vặt.

2. **Chế độ ưu tiên bữa ăn (Meal Preference):**
   - 🍽️ **Tất cả:** Bốc tự do mọi món.
   - 🥗 **Bữa chay:** Ép suất chính và suất ăn kèm vào món chay (chuyển theme xanh ngọc mát mắt).
   - 🍖 **Bữa mặn:** Ép suất chính và suất ăn kèm vào món mặn (chuyển theme đỏ cam ấm cúng).

3. **Lọc theo ngân sách (Budget Tiers):**
   - 💰 Mọi mức giá
   - 💸 Sinh tồn (dưới 20.000đ)
   - 🎓 Sinh viên (20.000đ - 40.000đ)
   - 😋 Ăn ngon (40.000đ - 70.000đ)
   - 👑 Chơi lớn (trên 70.000đ)

4. **Cơ chế bốc món & Hiệu ứng tương tác:**
   - Bốc từng suất riêng lẻ: hiệu ứng rung lắc hộp (`meal-rattle`) và âm thanh sạo hòm.
   - Bốc trọn bữa (`handleMealRollAll`): tự động bốc lần lượt từng suất trống theo nhịp mượt mà.
   - Vòng tròn tiến độ (`meal-tray-ring`) hiển thị tỷ lệ đã dựng trên 4 suất.
   - Bộ đếm tiền động dạng số chạy mềm mại (`animateTotal`).

5. **Dọn món (Serve Meal) & Phiếu bữa ăn:**
   - Animation các món bay vào mâm (`meal-plate-fly`).
   - Bảng tổng kết dọn món với hiệu ứng hơi nước nóng bốc lên (`meal-steam`), pháo hoa giấy bay (`meal-confetti`), tia sáng tỏa ra (`meal-served-rays`).
   - Nhận định bữa ăn (Tiết kiệm, Vừa túi tiền, Ăn ngon, Ăn sang).
   - Tự động lưu vào **Sổ bữa đã dọn** (tối đa 20 bữa gần nhất) trong LocalStorage.

6. **Chi tiết món ăn (Dish Detail Modal):**
   - Bấm vào tên món hoặc nút "Chi tiết" ở từng ô để mở modal xem ảnh to, mô tả, thẻ tag, giá, và nút yêu thích/bỏ qua.

---

## 🚀 Cách chạy thử tính năng độc lập

### Cách 1: Chạy trực tiếp qua máy chủ Vite đang có
Mở trình duyệt truy cập đường dẫn:
```
http://localhost:5173/src/meal-feature/index.html
```
(hoặc cổng dev server hiện tại của Vite)

### Cách 2: Nhúng vào một trang HTML bất kỳ
```html
<!-- 1. Thêm CSS -->
<link rel="stylesheet" href="/src/meal-feature/meal.css">

<!-- 2. Thêm các container -->
<div id="meal-container"></div>
<div id="dish-detail-container"></div>

<!-- 3. Nhập module điều phối -->
<script type="module">
  import { initMealFeature } from '/src/meal-feature/main.js';
  
  // Khởi động với dữ liệu mặc định
  initMealFeature();
  
  // Hoặc khởi động với danh sách món tùy biến của bạn:
  // initMealFeature({ dishes: customDishArray });
</script>
```
