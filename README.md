# BungOiAnGi

Ung dung Vite cho khach hang va quan tri vien. Dang nhap, du lieu mon an va quan tri deu dung JSON Server local.

## Chay local

1. Cai dependency: `npm install`
2. Chay ca API va giao dien: `npm run dev:all`
3. Mo dia chi Vite hien trong terminal. JSON Server Auth chay tai `http://127.0.0.1:3000`.

Dang ky va dang nhap duoc xu ly boi cac endpoint `/register` va `/login` cua JSON Server Auth. Tai khoan duoc luu trong `server/db.json`; tai khoan admin mac dinh la `admin@bungoiangi.com` / `Admin123!` (nen doi mat khau trong moi truong production). De chi chay rieng API hoac giao dien, dung `npm run api` hoac `npm run dev`.

## Luu y backend

JSON Server Auth phu hop cho chay local/offline; no khong duoc Vercel static hosting khoi dong cung frontend. Neu deploy, can host `server.js` tren mot backend rieng va dat `VITE_API_URL` tro den backend do; backend production bat buoc co `JWT_SECRET`, `ADMIN_PASSWORD` va `CORS_ORIGINS`. Khong dung tai khoan/mat khau admin mac dinh tren backend cong khai.

Luong "Tim quan gan toi" gui truy van OpenStreetMap Overpass qua backend da xac thuc de tranh loi CORS khi trinh duyet goi truc tiep dich vu ban do. Sau khi cap nhat code, can deploy ca backend va frontend.

## Deploy Backend len Render (Mien phi)

File cấu hình [`render.yaml`](file:///c:/Users/Admin/Downloads/nangcapv2/render.yaml) đã được thiết lập sẵn:

1. Đăng nhập [render.com](https://render.com), chọn **New** -> **Blueprint**.
2. Chọn repository này. Render sẽ tự động phát hiện `render.yaml` và tạo web service `bungoiangi-backend`.
3. Render sẽ tự động sinh `JWT_SECRET`, `ADMIN_PASSWORD` và mở CORS (`*` và các tên miền `*.vercel.app`).
4. Endpoint kiểm tra sức khỏe hệ thống: `GET /health` (trả về `{ "ok": true }`).
5. Sau khi Render deploy xong, sao chép URL backend (ví dụ: `https://bungoiangi-backend.onrender.com`).

## Deploy Frontend len Vercel

1. Import repository vào Vercel (file [`vercel.json`](file:///c:/Users/Admin/Downloads/nangcapv2/vercel.json) đã có sẵn cấu hình Vite SPA).
2. Trong mục **Settings** -> **Environment Variables** trên Vercel, cấu hình:
   - `VITE_API_URL`: URL của backend Render vừa tạo ở trên (ví dụ: `https://bungoiangi-backend.onrender.com`).
   - `VITE_CLOUDINARY_CLOUD_NAME`: (tùy chọn) Cloudinary cloud name.
   - `VITE_CLOUDINARY_UPLOAD_PRESET`: (tùy chọn) Cloudinary upload preset.
3. Bấm **Deploy**. Giao diện và API sẽ kết nối hoàn chỉnh.

## Kiem thu cac luong bao mat va lien ket

- `npm test` kiem tra phan quyen API local, tu choi quyen GPS, URL dich vu tren iOS/Android/PC va dang xuat khi JWT het han.
- GrabFood va ShopeeFood duoc mo bang HTTPS universal-link fallback. Viec he dieu hanh chuyen tiep sang app native phu thuoc app da cai va cau hinh universal/app links cua nha cung cap; can xac nhan them tren iPhone va Android that. Tren PC, link mo trang web dich vu.

## Cloudinary

Tao unsigned upload preset gioi han dinh dang va kich thuoc anh trong Cloudinary, sau do khai bao `VITE_CLOUDINARY_CLOUD_NAME` va `VITE_CLOUDINARY_UPLOAD_PRESET`. Khong dat API secret Cloudinary trong frontend.

## Gioi han

JSON Server luu du lieu vao file JSON; khi deploy cong khai can co backup va bao ve backend, thay thong tin admin mac dinh, va khong de database co the bi truy cap truc tiep.
