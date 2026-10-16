## Hướng dẫn tạo Release tag

Quy ước tag: `vMAJOR.MINOR.PATCH` (ví dụ: `v0.1.0`).

1. Cập nhật mã nguồn mới nhất

```bash
git checkout main
git pull origin main
```

2. (Tuỳ chọn) Kiểm tra build trước khi phát hành

```bash
npm install
npm run build
npm run tauri:build
```

3. Cập nhật version

Sửa `version` trong `package.json`, `src-tauri/tauri.conf.json` và `src-tauri/Cargo.toml` thành `X.Y.Z`, rồi commit. Workflow sẽ báo lỗi nếu version không khớp với tag.

4. Tạo và đẩy tag

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

5. Chờ workflow chạy

- Workflow `.github/workflows/release.yml` sẽ tự động build ứng dụng trên Windows và tạo GitHub Release kèm file `.msi`, `.exe` và binary.

6. Kiểm tra kết quả

- Truy cập https://github.com/hoan02/open-port/releases để xác nhận assets đã được đính kèm.

## Ký bản cập nhật (auto-update)

Mỗi bản release được ký và kèm `latest.json`, để updater trong app dùng được ngay khi bật.

> **Trạng thái:** app chưa có plugin `tauri-plugin-updater`. Mọi bản của plugin đều phụ thuộc crate `zip` 4.x, mà crates.io đã yank gần như toàn bộ phiên bản `zip` (10/2026). Khi Tauri phát hành bản dùng `zip` hợp lệ, chỉ cần thêm `tauri-plugin-updater` + `tauri-plugin-process` và nút "Kiểm tra cập nhật"; cấu hình `plugins.updater` trong `tauri.conf.json` đã có sẵn.

Workflow cần 2 secret trong *Settings → Secrets and variables → Actions*:

| Secret | Giá trị |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | Nội dung file `~/.tauri/open-port.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Nội dung file `~/.tauri/open-port.key.password` |

Public key tương ứng nằm trong `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`).

- **Không commit private key.** Hãy sao lưu 2 file trên ở nơi an toàn: nếu mất khoá, các bản đã cài sẽ không nhận được cập nhật nữa.
- Nếu tạo khoá mới, phải thay `pubkey` và phát hành lại; người dùng bản cũ sẽ phải cài thủ công một lần.
- Muốn build có ký trên máy cục bộ, đặt 2 biến môi trường cùng tên trước khi chạy `npm run tauri:build`.

