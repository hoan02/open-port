![Open Port thumbnail](.github/assets/thumbnail.png)

# Open Port

Ứng dụng desktop giúp xem và quản lý các cổng mạng cục bộ, xây dựng bằng Tauri, React, TypeScript và Tailwind.

## Tải bản phát hành

- Trang tải xuống: https://github.com/hoan02/open-port/releases
- Chọn bản mới nhất và tải file cài đặt `.msi` hoặc `.exe` (NSIS) tương ứng cho Windows.

## Chức năng chính

- Danh sách thời gian thực các cổng TCP đang lắng nghe và cổng UDP đang bind (IPv4 + IPv6 gộp một dòng), kèm tiến trình, PID, địa chỉ bind và tên cổng phổ biến.
- Hiện dòng lệnh của tiến trình (phân biệt nhiều `node.exe`) và tên dịch vụ bên trong `svchost.exe`.
- Ẩn tiến trình hệ thống/dịch vụ chỉ với một nút; lọc nhanh TCP/UDP và theo tiến trình đang chạy.
- Tìm kiếm theo cổng (`:3000` để khớp chính xác), tiến trình, dòng lệnh, PID hoặc địa chỉ; lưu bộ lọc hay dùng.
- Kết thúc tiến trình (tuỳ chọn cả tiến trình con), mở `localhost:<port>` trong trình duyệt, mở thư mục chứa file chạy, sao chép thông tin qua menu chuột phải.
- Theo dõi cổng: thông báo Windows khi cổng bị chiếm hoặc được giải phóng, kể cả khi app đang ở khay hệ thống.
- Phím tắt: `Ctrl+K` bảng lệnh, `Ctrl+F` tìm kiếm, `F5` làm mới, `↑/↓` chọn dòng, `Enter` xem chi tiết, `Delete` kết thúc tiến trình.
- Tự làm mới (tạm dừng khi đang trỏ chuột vào danh sách để các dòng không xê dịch), đánh dấu cổng vừa mở, nút chạy lại với quyền Administrator.

## Yêu cầu

- Node.js 20+
- Rust (toolchain stable)
- npm (đi kèm Node.js)

## Cài đặt nhanh

```bash
npm install
npm run dev          # Chạy Vite (web)
npm run tauri:dev    # Chạy app Tauri với live reload
```

## Các lệnh hữu ích

- `npm run dev` – khởi động Vite dev server.
- `npm run build` – kiểm tra kiểu và build web assets.
- `npm run preview` – xem trước bản build Vite.
- `npm run tauri:dev` – mở app Tauri ở chế độ dev.
- `npm run tauri:build` – đóng gói app desktop (msi/nsis trên Windows).

## Đóng gói phát hành

```bash
npm run tauri:build
```

Gói cài đặt nằm tại `src-tauri/target/release/bundle/` (thư mục `msi/`, `nsis/`).

## CI/CD

Khi đẩy tag dạng `v*`, workflow `.github/workflows/release.yml` sẽ build ứng dụng Tauri trên Windows và tạo GitHub Release kèm bộ cài đặt và binary.
