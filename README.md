# Mon TriNote

Ghi chú 3 màu, đồng bộ PC và điện thoại. Created by Mondiro.

| Tab | Màu | Dùng để |
|---|---|---|
| 1 | Xanh lá | Sticker việc cần làm, tick là vào "Đã xong" |
| 2 | Xanh dương | Ghi chú dài theo từng phần mềm |
| 3 | Đỏ | Tài khoản, khóa PIN + vân tay, mã hóa |

## Tải và cài

Vào [Releases](https://github.com/satthupc00/Mon-ColorNote/releases/latest):
- **PC:** tải `Mon-TriNote-Setup-x.y.z.exe`, bấm đúp để cài. Windows có thể hiện "Windows protected your PC" vì app chưa ký số: bấm **More info → Run anyway**.
- **Android:** tải `Mon-TriNote-x.y.z.apk` trên điện thoại, mở file, cho phép "Cài ứng dụng không rõ nguồn" khi được hỏi.

App tự kiểm tra bản mới mỗi lần mở. Có bản mới thì nút xanh "Cập nhật" hiện trên đầu app.

## Kết nối Firebase để đồng bộ (làm 1 lần)

1. Vào https://console.firebase.google.com → **Create a project** → đặt tên `mon-trinote` → tắt Google Analytics → Create.
2. Menu trái **Build → Authentication** → Get started → tab **Sign-in method** → bật **Email/Password** → Save.
3. Menu trái **Build → Firestore Database** → Create database → chọn vùng `asia-southeast1` → **Start in production mode**.
4. Trong Firestore, tab **Rules** → xóa hết, dán nội dung file [`firestore.rules`](firestore.rules) → **Publish**.
5. Bánh răng cạnh "Project Overview" → **Project settings** → kéo xuống "Your apps" → bấm biểu tượng **</>** (Web) → đặt tên `trinote` → Register app.
6. Copy đoạn `const firebaseConfig = { ... }` và gửi cho Claude (hoặc dán vào `src/firebase-config.js`). Các khóa này không phải mật khẩu, để công khai được.
7. Có bản mới, mở app → Cài đặt → **Tạo tài khoản** bằng email + mật khẩu. Máy còn lại thì **Đăng nhập** cùng tài khoản đó.

## Bảo mật Tab Đỏ

- Lần đầu mở Tab Đỏ: tạo PIN 6 số, app đưa **mã khôi phục**. Hãy chép ra giấy, đây là cách duy nhất mở lại khi quên PIN.
- Dữ liệu Tab Đỏ được mã hóa (AES-256) trên máy trước khi gửi lên Firebase, Firebase không đọc được.
- Mỗi máy mới cần nhập PIN 1 lần, sau đó dùng vân tay (Android) hoặc Windows Hello (PC).
- Nên đăng nhập trước khi tạo PIN để mọi máy dùng chung một két.

## Dành cho người build

```bash
npm install
npm run dev          # chạy thử trên trình duyệt
npm start            # chạy bản PC (Electron)
npm run dist:win     # đóng gói .exe
npm run android:sync # đồng bộ code web sang android/
```

Phát hành: tăng `version` trong `package.json`, thêm `release-notes/vX.Y.Z.md`, tạo tag `vX.Y.Z` và push. GitHub Actions tự build `.exe` + `.apk` và tạo Release.

APK đang ký bằng `android/app/trinote-release.jks` đi kèm repo. Muốn an toàn hơn thì thêm GitHub Secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` (dùng đúng keystore cũ, nếu đổi keystore thì phải gỡ app cũ rồi cài lại).
