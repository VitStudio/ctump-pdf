# CTUMP PNG to PDF
Tiện ích tải tài liệu từ trang sinh viên trường Đại học Y dược Cần Thơ.

## 📋 Mô tả
Công cụ chuyển đổi tài liệu từ CTUMP DocImage sang PDF với giao diện đồ họa đơn giản và tự động phát hiện token. Hỗ trợ tải xuống bất đồng bộ với hiệu suất cao và tự động dọn dẹp cache.

## ✨ Tính năng chính

### 🔄 Xử lý bất đồng bộ
- Tải xuống đồng thời nhiều trang với HTTP/2
- Xử lý theo phân đoạn để tiết kiệm RAM
- Hỗ trợ hủy bỏ quá trình bất cứ lúc nào

### 🎯 Tự động phát hiện Token
- Dán URL viewer để tự động lấy token
- Quét cả trang chính và các script bên ngoài
- Hỗ trợ nhập token thủ công

### 🎨 Giao diện đơn giản
- Theme đen trắng tối giản
- Font Tahoma dễ đọc
- Các trường cấu hình chỉ đọc (readonly)
- Hiển thị tiến trình real-time

### 🧹 Tự động dọn dẹp
- Xóa cache và file tạm sau khi hoàn thành
- Giải phóng dung lượng ổ đĩa
- Tối ưu hiệu suất hệ thống

## 🚀 Cài đặt và Chạy

### Yêu cầu hệ thống
- Python 3.7 trở lên
- Hệ điều hành: Windows, macOS, Linux

### Cài đặt
```bash
# Clone hoặc tải file ct_gui.py (Desktop GUI) hoặc ctsample.py (Web UI)
# Công cụ sẽ tự động cài đặt các thư viện cần thiết:
# - httpx[http2]>=0.26
# - img2pdf>=0.6.0  
# - pikepdf>=9.0
# - flask>=2.0.0 (chỉ cho ctsample.py)
```

### Chạy ứng dụng

**Desktop GUI (Tkinter):**
```bash
python ct_gui.py
```

**Web Interface (Flask) - MỚI:**
```bash
python ctsample.py
# Sau đó mở trình duyệt tại: http://localhost:5000
```

> 📝 **Lưu ý**: `ctsample.py` là phiên bản web UI mới, cho phép truy cập qua trình duyệt. Xem chi tiết trong [CTSAMPLE_README.md](CTSAMPLE_README.md)

## 📖 Hướng dẫn sử dụng

### 1. Thêm tài liệu
1. Nhấn nút **"Add Document"**
2. Dán URL viewer vào chỗ **"Viewer URL"** - Hướng dẫn lấy URL Viewer: bằng cách chuột phải chọn "View Frame Source" sau đó copy URL và xoá phần "view-source:" (nếu có)
3. Nhấn **"Auto Detect Token"** để tự động lấy token
4. Điền thông tin:
   - **Start page**: Trang bắt đầu (mặc định: 1)
   - **End page**: Trang kết thúc (mặc định: 1)
   - **Output PDF**: Đường dẫn file PDF đầu ra
5. Nhấn **"Add"** để thêm vào danh sách

### 2. Quản lý tài liệu
- **Remove Selected**: Xóa tài liệu đã chọn
- **Load Manifest**: Tải danh sách tài liệu từ file JSON
- **Save Manifest**: Lưu danh sách tài liệu ra file JSON

### 3. Bắt đầu xử lý
1. Kiểm tra cấu hình:
   - **Base URL**: `https://media.ctump.edu.vn/DocImage.axd`
   - **Concurrency**: 6
   - **Segment size**: 200
2. Nhấn **"Start"** để bắt đầu
3. Theo dõi tiến trình trong phần **"Progress"** và **"Logs"**
4. Nhấn **"Cancel"** nếu muốn dừng

### 4. Theo dõi tiến trình
- **Progress bar**: Hiển thị tổng tiến trình
- **Segment**: Hiển thị phân đoạn đang xử lý
- **Logs**: Chi tiết quá trình xử lý với màu sắc:
  - 🔵 **INFO**: Thông tin bình thường
  - 🟡 **WARN**: Cảnh báo
  - 🔴 **ERROR**: Lỗi
  - 🟢 **DONE**: Hoàn thành

## ⚙️ Cấu hình mặc định

| Tham số | Giá trị | Mô tả |
|---------|---------|-------|
| Base URL | `https://media.ctump.edu.vn/DocImage.axd` | URL cơ sở của CTUMP |
| Concurrency | 6 | Số kết nối đồng thời |
| Segment Size | 200 | Số trang mỗi phân đoạn |
| Connect Timeout | 5.0s | Thời gian chờ kết nối |
| Read Timeout | 30.0s | Thời gian chờ đọc dữ liệu |
| Retry Total | 6 | Số lần thử lại tối đa |

## 🎨 Giao diện

### Theme đen trắng
- **Background**: Đen tuyệt đối (#000000)
- **Text**: Trắng tuyệt đối (#ffffff)
- **Cards**: Xám đậm (#1a1a1a)
- **Accent**: Xanh navy (#213448)

### Font Tahoma
- Tất cả text sử dụng font Tahoma 14pt
- Dễ đọc trên mọi kích thước màn hình
- Hỗ trợ đa ngôn ngữ

## 🔧 Xử lý sự cố

### Lỗi thường gặp

#### 1. Token không được phát hiện
- **Nguyên nhân**: URL viewer không hợp lệ hoặc trang đã thay đổi
- **Giải pháp**: 
  - Kiểm tra lại URL viewer
  - Thử nhập token thủ công
  - Kiểm tra kết nối internet

#### 2. Lỗi tải xuống
- **Nguyên nhân**: Mạng chậm hoặc server quá tải
- **Giải pháp**:
  - Chờ và thử lại
  - Kiểm tra kết nối internet
  - Giảm số lượng tài liệu xử lý cùng lúc

#### 3. Lỗi tạo PDF
- **Nguyên nhân**: Dữ liệu hình ảnh bị lỗi
- **Giải pháp**:
  - Thử lại với trang cụ thể
  - Kiểm tra token còn hợp lệ
  - Thử với phạm vi trang nhỏ hơn

### Log messages quan trọng

```
[INFO] Token detected: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
[INFO] Doc 1/3 document.pdf : 1–50
[INFO] Segment 1: downloading 1–200
[INFO] Segment 1: ✓200  ✗0  -> /tmp/segment_1_200.pdf
[INFO] Merging segments and linearizing…
[DONE] Wrote document.pdf
[INFO] Clearing cache and temporary files...
[DONE] Cache cleared successfully
```

## 💡 Mẹo sử dụng

### 1. Tối ưu hiệu suất
- Xử lý nhiều tài liệu cùng lúc thay vì từng cái một
- Sử dụng phạm vi trang hợp lý (không quá lớn)
- Lưu manifest để tái sử dụng danh sách tài liệu

### 2. Quản lý tài liệu
- Đặt tên file PDF có ý nghĩa
- Sử dụng chức năng Save/Load Manifest
- Kiểm tra kết quả trước khi xử lý hàng loạt

### 3. Xử lý lỗi
- Luôn kiểm tra logs để hiểu nguyên nhân lỗi
- Thử lại với phạm vi trang nhỏ hơn nếu gặp lỗi
- Sử dụng chức năng Cancel khi cần thiết

## 🔒 Bảo mật

- Token được xử lý an toàn trong bộ nhớ
- Không lưu trữ thông tin nhạy cảm
- Tự động dọn dẹp file tạm
- Sử dụng HTTPS cho tất cả kết nối

## 📞 Hỗ trợ

Nếu gặp vấn đề, hãy kiểm tra:
1. Logs trong ứng dụng để xem thông báo lỗi chi tiết
2. Kết nối internet và URL viewer
3. Quyền ghi file tại thư mục đích
4. Dung lượng ổ đĩa còn trống

## 📄 Giấy phép

Công cụ này được phát triển để hỗ trợ việc chuyển đổi tài liệu từ trang Sinh viên CTUMP sang PDF một cách hiệu quả và an toàn.

---

**Lưu ý**: Công cụ này chỉ dành cho mục đích học tập và nghiên cứu. Vui lòng tuân thủ các quy định của Trường Đại học Y Dược Cần Thơ khi sử dụng.
