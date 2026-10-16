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
