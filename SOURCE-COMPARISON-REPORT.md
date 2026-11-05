# Báo cáo đối chiếu mã nguồn

**Ngày lập báo cáo:** 2026-11-05  
**Đối tượng đối chiếu:** hai tệp do người yêu cầu cung cấp trong cuộc trò chuyện:

- `popup.js`
- `popup.html`

**Nguồn đối chiếu chính:** repository `VitStudio/ctump-pdf`, thư mục `EdgeCTUMP/`, đặc biệt:

- `EdgeCTUMP/popup.js`
- `EdgeCTUMP/popup.html`
- `EdgeCTUMP/sidepanel.js`
- `EdgeCTUMP/README.md`
- `LICENSE`

## 1. Kết luận tóm tắt

Chưa có đủ cơ sở kỹ thuật để kết luận hai tệp được cung cấp là bản sao trực tiếp của mã trong `VitStudio/ctump-pdf`. Có sự tương đồng đáng kể về **mục đích, quy trình và giao thức đặc thù của CTUMP**, nhưng chưa quan sát thấy đoạn mã, tên biến, cấu trúc DOM, giao diện hoặc thuật toán PDF nào trùng nguyên văn ở mức đủ để chứng minh sao chép mã nguồn.

Đánh giá hiện tại:

| Vấn đề | Mức đánh giá | Cơ sở |
|---|---:|---|
| Cùng giải quyết một bài toán CTUMP | Cao | Cùng truy cập `DocImage.axd`, token, page và xuất PDF |
| Có thể đã tham khảo ý tưởng/quy trình | Trung bình đến cao | Cùng chuỗi thao tác mở viewer, đọc token, tải slide và ghép PDF |
| Sao chép trực tiếp mã JavaScript của repository | Thấp đến chưa chứng minh | Khác thư viện, khác cấu trúc, khác tên biến, khác pipeline |
| Vi phạm MIT License của repository | Chưa xác định | Chỉ phát sinh nếu chứng minh có sao chép phần mã được bảo hộ; tệp cung cấp không có attribution |
| Có thể báo cáo yêu cầu làm rõ nguồn gốc | Có | Có mốc công khai và bằng chứng đối chiếu để yêu cầu cung cấp lịch sử phát triển |

## 2. Bằng chứng về thời điểm mã trong repository

GitHub API ghi nhận commit phát hành:

- **Commit:** `9a07e0bb2bd4d66acd01604cbe7072f3a81a51a9`
- **Ngày:** 2026-09-21 08:07:29 UTC
- **Tác giả/committer:** `VitStudio`
- **Thông điệp:** `Release extension for fasting download study resource. Current version: v2.3 - Standalone`
- **Cây thư mục của commit:** chứa toàn bộ thư mục `EdgeCTUMP/`, bao gồm `popup.js`, `popup.html`, `sidepanel.js`, `manifest.json` và tài liệu.

Commit kế tiếp `c84b4e9bdf6fa1c1b40a6d028096010f1323f7ed` cập nhật README và là phiên bản đang được đối chiếu trong workspace. Lịch sử public của repository vì vậy chứng minh rằng mã `EdgeCTUMP` đã tồn tại công khai ít nhất từ commit phát hành ngày 2026-09-21.

**Giới hạn quan trọng:** chưa có URL, repository, commit, file gốc hoặc timestamp đáng tin cậy của hai tệp mang tên tác giả bên kia. Vì vậy chưa thể xác định bên nào công bố trước chỉ từ hai tệp được dán vào cuộc trò chuyện.

## 3. Các điểm tương đồng đáng chú ý

### 3.1. Endpoint và mô hình dữ liệu đặc thù

Hai bên cùng sử dụng:

```text
DocImage.axd?page=<page>&token=<token>&zoom=100&format=png
```

Trong repository, mẫu này xuất hiện tại `EdgeCTUMP/popup.js:12`, `:228` và `:285`, cũng như `EdgeCTUMP/sidepanel.js`. Tệp được cung cấp xây dựng URL tương tự trong vòng lặp xuất PDF.

Đây là dấu hiệu liên quan trực tiếp đến cùng hệ thống CTUMP, nhưng bản thân endpoint, tên tham số và định dạng ảnh là dữ liệu kỹ thuật của dịch vụ đích; chúng không đủ để chứng minh sao chép biểu đạt mã nguồn.

### 3.2. Cùng quy trình nghiệp vụ

Cả hai implementation đều có các bước:

1. Tìm viewer/iframe hoặc trang View document.
2. Tìm URL ảnh có `DocImage.axd`.
3. Đọc `token` và số trang từ URL/DOM.
4. Tải ảnh theo từng trang.
5. Đóng gói các ảnh thành PDF phía client.

Repository mô tả và triển khai bộ quét nhiều tầng tại `EdgeCTUMP/popup.js:119-221`; tệp cung cấp dùng việc quét `input[type="image"][src*="DocImage.axd"]` và tìm `maxPage`. Sự giống nhau này có giá trị như bằng chứng về **ý tưởng/quy trình**, nhưng các bước đều là cách tiếp cận tự nhiên khi làm việc với viewer CTUMP.

### 3.3. Cùng tối ưu hình ảnh để đưa vào PDF

Tệp cung cấp:

- tạo PDF khổ A4 ngang bằng `jsPDF`;
- tính tỷ lệ ảnh/PDF;
- căn giữa ảnh trong trang;
- chuyển canvas thành JPEG;
- gọi `addImage`.

Repository:

- dùng `pdf-lib` local thay vì `jsPDF`;
- nhúng PNG/JPEG trực tiếp tại `EdgeCTUMP/popup.js:433-455`;
- tạo trang theo kích thước ảnh;
- tải theo chunk/concurrency tại `EdgeCTUMP/popup.js:509-565`.

Mục tiêu giống nhau, nhưng biểu đạt và pipeline khác nhau rõ rệt.

## 4. Các điểm khác biệt loại trừ khả năng kết luận sao chép trực tiếp

### 4.1. Khác thư viện và mô hình xuất file

| Tệp được cung cấp | Repository |
|---|---|
| Nạp `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js` khi chạy | Nạp `EdgeCTUMP/lib/pdf-lib.min.js` từ extension |
| `new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })` | `PDFLib.PDFDocument.create()` |
| Canvas rồi `toDataURL("image/jpeg", 0.95)` | `Uint8Array` và `embedPng`/`embedJpg` |
| `doc.save(...)` | `chrome.downloads.download(...)` |
| Tải tuần tự, dừng khi lỗi | Worker pool, retry/backoff, AbortController, cleanup bộ nhớ |

### 4.2. Khác cấu trúc và tên định danh

Repository dùng các định danh như `scanDocumentFramesMultiTier`, `fastBinaryProbeTotalPages`, `fetchPageImage`, `detectedData`, `chunkBuffers`, `CONCURRENCY`, `CHUNK_SIZE`, `RETRY_MAX`. Các định danh này không xuất hiện trong tệp cung cấp.

Tệp cung cấp dùng các định danh như `btnOpen`, `guideToggle`, `showToast`, `loadImage`, `renderedPages`, `sampleSrc`, `maxPage`, `doc`. Không thấy dấu hiệu đổi tên máy móc từ các định danh của `EdgeCTUMP`.

### 4.3. Khác giao diện HTML

`EdgeCTUMP/popup.html:10-180` có layout card, trạng thái dò bài giảng, live monitor, range strip, progress card, nút hủy và các trường tùy chỉnh. Tệp cung cấp có popup rộng 320px, hai nút thao tác, accordion hướng dẫn và disclaimer. Không có chuỗi class/id có tính đặc trưng của `EdgeCTUMP` được tái sử dụng.

### 4.4. Khác cách tìm số trang

Repository sử dụng:

- ảnh/input/data-src;
- placeholder ID;
- toolbar;
- biến cấu hình trong `<script>`;
- exponential leap và binary search;
- `Range: bytes=0-128`.

Tệp cung cấp chủ yếu lấy các `input[type="image"]` đang hiện diện và lấy trang lớn nhất. Đây là implementation đơn giản hơn, không cho thấy việc sao chép bộ quét bốn tầng.

## 5. Đánh giá về bản quyền và license

Repository có `LICENSE` với MIT License và dòng:

```text
Copyright (c) 2024 Vũ Tuấn David
```

MIT License cho phép sử dụng, sao chép, sửa đổi và phân phối, nhưng yêu cầu giữ thông báo bản quyền và thông báo license trong các bản sao hoặc phần đáng kể của phần mềm.

Tệp `popup.html` được cung cấp tự nhận diện:

```text
Bản quyền phát triển: Lý Gia Huy
```

Tuy nhiên, việc tự nhận diện tác giả không tự nó chứng minh đã sao chép mã của repository. Nếu sau này có bằng chứng cho thấy một phần đáng kể của `EdgeCTUMP` đã được sao chép, việc không giữ attribution/license của MIT sẽ là điểm cần nêu riêng trong báo cáo bản quyền.

Ngược lại, nếu chỉ chứng minh được việc cùng sử dụng endpoint CTUMP và cùng ý tưởng xuất PDF, thì chưa đủ để kết luận vi phạm copyright; ý tưởng, chức năng và API thường không được đánh giá giống với phần biểu đạt mã nguồn cụ thể.

## 6. Lỗi kỹ thuật trong tệp được cung cấp

Các lỗi sau không chứng minh nguồn gốc, nhưng hữu ích để phân biệt implementation:

1. `loadImage` tạo `new Promise((resolve) => { ... img.onerror = () => reject(...) })` nhưng không khai báo tham số `reject`. Khi ảnh lỗi, callback có thể phát sinh `ReferenceError` thay vì reject đúng cách.
2. Khi `executeScript` thất bại hoặc không tìm thấy ảnh, nút tải không luôn được khôi phục về trạng thái ban đầu.
3. `catch (err) { break; }` dừng toàn bộ vòng lặp khi một trang lỗi và vẫn có thể xuất PDF thiếu trang mà không báo rõ trang nào lỗi.
4. Script `jsPDF` được tải từ CDN trong execution context của trang, tạo phụ thuộc mạng và phụ thuộc chính sách CSP/CORS.

Các khác biệt này cho thấy tệp cung cấp không phải là bản sao nguyên trạng của pipeline `EdgeCTUMP`, vốn có retry, hủy tải, kiểm tra HTTP status, progress và cleanup.

## 7. Mức độ chứng cứ hiện tại

| Mức | Nội dung | Trạng thái |
|---|---|---|
| A - trực tiếp | Trùng đoạn code dài, trùng tên biến/hàm/class, cùng lỗi đặc thù | Chưa thấy |
| B - mạnh | Cùng thuật toán đặc thù không bắt buộc bởi CTUMP, cùng thứ tự và cấu trúc xử lý | Một phần, nhưng chưa đủ |
| C - hoàn cảnh | Cùng endpoint, token, tham số page và mục tiêu | Có |
| D - chưa kiểm chứng | Có lịch sử công bố trước hoặc file trung gian của bên kia | Thiếu dữ liệu |

**Kết luận chứng cứ:** hiện tại phù hợp nhất với nhận định “có khả năng tham khảo cùng ý tưởng hoặc cùng reverse-engineer một hệ thống CTUMP”, chưa phù hợp với nhận định chắc chắn “đã ăn cắp source code của repository”.

## 8. Dữ liệu cần thu thập trước khi gửi khiếu nại

Để nâng chứng cứ từ mức C/B lên mức A, cần lưu:

1. URL chính xác của bài đăng hoặc repository của bên kia.
2. Ngày giờ công khai đầu tiên, commit đầu tiên và lịch sử chỉnh sửa.
3. File gốc tải trực tiếp, không chỉ ảnh chụp hoặc đoạn code copy vào chat.
4. SHA-256 của từng file gốc.
5. Bản diff đầy đủ, bao gồm cả CSS, manifest, icon, README và asset.
6. Các bản archive/web cache hoặc screenshot có timestamp.
7. Bằng chứng cho thấy bên kia đã tiếp cận repository trước thời điểm công bố.
8. Nếu cần yêu cầu gỡ nội dung, nên nêu cụ thể các đoạn code trùng và quyền sở hữu/license tương ứng, không chỉ nêu việc cùng dùng `DocImage.axd`.

## 9. Cách trích dẫn nguồn trong báo cáo khiếu nại

Nên dẫn tới commit cố định thay vì chỉ dẫn `main`, ví dụ:

- `EdgeCTUMP/popup.js` tại commit `9a07e0bb2bd4d66acd01604cbe7072f3a81a51a9`
- `EdgeCTUMP/popup.html` tại commit `9a07e0bb2bd4d66acd01604cbe7072f3a81a51a9`
- `EdgeCTUMP/README.md` tại commit `c84b4e9bdf6fa1c1b40a6d028096010f1323f7ed`
- `LICENSE` trong repository `VitStudio/ctump-pdf`

Không nên ghi “đã chứng minh ăn cắp” nếu chưa có file gốc và mốc công bố của bên bị cáo buộc. Cách diễn đạt an toàn, chính xác là: **“Có dấu hiệu tương đồng về quy trình và giao thức đặc thù; chưa đủ dữ liệu để kết luận sao chép trực tiếp mã nguồn.”**

