# CTUMP PDF

Tiện ích tải tài liệu từ trang sinh viên trường Đại học Y dược Cần Thơ dưới dạng PDF.

Dự án này hỗ trợ chuyển đổi tài liệu CTUMP DocImage sang PDF bằng nhiều cách khác nhau: giao diện desktop, web UI, CLI và tiện ích trình duyệt.

## Tính năng chính

- Tải tài liệu từ CTUMP DocImage theo token
- Chuyển từng trang thành ảnh PNG và gom lại thành PDF
- Hỗ trợ thực thi theo nhiều phiên bản giao diện
- Tự động phát hiện token từ URL viewer
- Xử lý theo từng đoạn (segment) để tiết kiệm bộ nhớ
- Hỗ trợ retry/backoff khi truy cập gặp lỗi
- Có thể chạy local hoặc tích hợp với tiện ích Chrome/Edge

## Cấu trúc repo

```text
.
├── ct_gui.py                 # Giao diện desktop Tkinter
├── ctsample.py               # Web UI bằng Flask
├── pdfCLI.py                 # CLI để chạy batch / script
├── requirements.txt          # Dependency cần thiết
├── README.md                 # Tài liệu chính
├── CTSAMPLE_README.md        # Hướng dẫn web UI
├── LICENSE                   # Giấy phép
├── Procfile                  # Deploy hỗ trợ Heroku/Railway style
├── build-extension.sh        # Script build extension
├── chrome-extension/         # Tiện ích Chrome/Edge (Manifest V3)
│   ├── README.md
│   ├── RAILWAY.md
│   ├── RENDER.md
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   └── popup/
├── EdgeCTUMP/                # Bản tiện ích Edge/Chrome chuyên biệt
│   └── README.md
└── .gitignore
```

## Các phiên bản hiện có

### 1) Desktop GUI

File: `ct_gui.py`

- Giao diện Tkinter
- Phù hợp cho người dùng chạy trên máy tính cá nhân
- Hỗ trợ thêm nhiều tài liệu, tự động phát hiện token, quản lý manifest

Khởi chạy:

```bash
python ct_gui.py
```

### 2) Web UI

File: `ctsample.py`

- Giao diện web trên Flask
- Hỗ trợ dùng qua trình duyệt
- Có sẵn API để tích hợp với extension

Khởi chạy:

```bash
python ctsample.py
```

Sau đó mở:

```text
http://localhost:5000
```

Chi tiết: [CTSAMPLE_README.md](CTSAMPLE_README.md)

### 3) CLI

File: `pdfCLI.py`

- Chạy theo lệnh dòng hoặc batch manifest JSON
- Phù hợp cho xử lý hàng loạt và automation

Ví dụ:

```bash
python pdfCLI.py --manifest jobs.json --concurrency 6 --segment-size 200
```

### 4) Chrome / Edge Extension

Thư mục: `chrome-extension/` và `EdgeCTUMP/`

- Extension có thể tự động điền token từ trang CTUMP
- Hỗ trợ tải tài liệu nhanh từ trình duyệt
- Có thể dùng kèm server local hoặc deployment cloud

Hướng dẫn chi tiết:

- [chrome-extension/README.md](chrome-extension/README.md)
- [EdgeCTUMP/README.md](EdgeCTUMP/README.md)

## Yêu cầu hệ thống

- Python 3.7+
- Hệ điều hành: Windows, macOS, Linux
- Kết nối internet để truy cập CTUMP

## Cài đặt

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/macOS
source .venv/bin/activate

pip install -r requirements.txt
```

## Chạy nhanh

### Desktop GUI

```bash
python ct_gui.py
```

### Web UI

```bash
python ctsample.py
```

### CLI

```bash
python pdfCLI.py
```

## Hướng dẫn sử dụng cơ bản

1. Mở trang tài liệu CTUMP cần tải.
2. Copy URL viewer hoặc dán URL vào ứng dụng.
3. Tự động phát hiện token hoặc nhập thủ công.
4. Chọn phạm vi trang bắt đầu/kết thúc.
5. Chọn tên file PDF đầu ra.
6. Bắt đầu xử lý để tạo PDF.

## Lưu ý quan trọng

- Công cụ này được xây dựng cho mục đích học tập và nghiên cứu.
- Người dùng cần tuân thủ nội quy của Trường Đại học Y dược Cần Thơ khi sử dụng.
- Một số tính năng phụ thuộc vào cấu trúc URL và token CTUMP hiện tại, có thể cần cập nhật khi trang web thay đổi.

## Giấy phép

Dự án được cấp phép theo [LICENSE](LICENSE).

## Hỗ trợ

Nếu gặp lỗi, kiểm tra:

- README liên quan tương ứng với phiên bản bạn đang dùng
- Log trong ứng dụng / server
- Kết nối internet và token CTUMP
- Đường dẫn file đầu ra / quyền ghi file

## Mục tiêu của repo

Repo này tập trung vào việc hỗ trợ tải và lưu trữ tài liệu CTUMP dưới dạng PDF với các giao diện đa dạng, từ desktop đến browser extension, đáp ứng nhu cầu nhanh, tiện lợi và dễ tích hợp.

---

Được phát triển bởi VitStudio.
