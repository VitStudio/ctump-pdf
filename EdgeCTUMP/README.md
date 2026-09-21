# EdgeCTUMP - Tài liệu CTUMP (Manifest V3 Standalone)

Tiện ích chuyên nghiệp dành cho **Microsoft Edge** và **Google Chrome**, hỗ trợ số hóa và lưu trữ bài giảng, sách chuyên khảo từ Thư viện số CTUMP (`media.ctump.edu.vn`) thành file PDF phục vụ học tập lâm sàng — **100% Client-side JavaScript, hoàn toàn KHÔNG cần Python, KHÔNG bị hệ thống chặn mã nguồn**.

---

## 🌟 Điểm nổi bật trong bản v2.3

### 1. Branding Chuyên Nghiệp (Không AI-Slop)
* **Tiêu đề & Định danh**: **EdgeCTUMP | Tài liệu CTUMP** với huy hiệu **Thư Viện Số**.
* **Nhận diện bài giảng thông minh**: Tự động lấy tên môn học / bài giảng từ tab trình duyệt (ví dụ: *Liệu Pháp Tâm Lý - Bs. Phạm Trung Từ*) để đặt tên file tải về chuẩn mực (`Lieu_Phap_Tam_Ly_Trang_1-26.pdf`), không còn dùng tên khô khan vô nghĩa.

### 2. Giám sát Hình ảnh Trực tiếp Thời gian thực (Live Inspection Monitor)
* **Xác thực token ngay khi mở popup**: Tải và hiển thị ngay ảnh xem trước của slide đầu tiên kèm kích thước phân giải thực (`1120 × 791 px`). Bạn có thể nhìn thấy ngay slide bài giảng thật, xác nhận 100% token còn sống và dữ liệu ảnh hợp lệ trước khi bấm Tải.
* **Theo dõi trực quan từng slide khi tải**: Trong quá trình tải, khung preview sẽ lật từng slide theo thời gian thực (real-time stream). Nếu token bị đứt quãng hoặc gặp trang trắng, extension sẽ cảnh báo ngay lập tức, triệt tiêu hoàn toàn nguy cơ file PDF xuất ra bị lỗi thiếu nội dung (miss-content).
* **Quản lý RAM không rò rỉ (Stream & Dispose)**: Cơ chế xoay vòng `URL.revokeObjectURL()` cho ảnh thumbnail kết hợp giải phóng mảng nhị phân giúp bộ nhớ trình duyệt luôn phẳng đều, tải mượt mà bài giảng hàng trăm slide.

### 3. Bộ Quét Tự Động 4 Tầng (Không cần cuộn trang)
* Tự động nhận diện tổng số trang thật qua DOM placeholders, thanh công cụ, cấu hình script và thuật toán dò tìm nhị phân nhanh (Fast Binary Probe).

---

## 🚀 Hướng dẫn cập nhật & Sử dụng

1. Mở `edge://extensions/` (hoặc `chrome://extensions/`).
2. Bật **Developer mode** (*Chế độ cho nhà phát triển*).
3. Bấm nút biểu tượng **Tải lại (Reload / ↻)** trên thẻ tiện ích **EdgeCTUMP**.
4. Mở bài giảng cần tải trên `media.ctump.edu.vn`.
5. Bấm vào icon **EdgeCTUMP**:
   - Popup mở lên, hiển thị ngay slide bài giảng đầu tiên trong khung **Giám sát trực tiếp**.
   - Tên bài giảng và tổng số trang được tự động điền sẵn.
6. Bấm **Tải bài giảng**:
   - Theo dõi từng slide được nạp trực tiếp qua khung preview.
   - File PDF hoàn chỉnh sẽ tự động lưu về thư mục **Downloads**!
