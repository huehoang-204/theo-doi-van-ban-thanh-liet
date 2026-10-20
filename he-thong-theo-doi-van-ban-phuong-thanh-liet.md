# ĐẶC TẢ HỆ THỐNG: THEO DÕI VĂN BẢN, BÁO CÁO & CÔNG VIỆC — PHƯỜNG THANH LIỆT

> Tài liệu này vừa là **phân tích nghiệp vụ**, vừa là **đặc tả kỹ thuật** để Claude Code triển khai trực tiếp.
> Claude Code: hãy đọc toàn bộ file trước khi viết code, sau đó làm lần lượt theo **Mục 14 – Lộ trình triển khai**. Mọi chỗ ghi `[CẦN XÁC NHẬN]` thì làm theo phương án mặc định đã nêu và để dễ sửa sau.

---

## MỤC LỤC

1. Bối cảnh & mục tiêu
2. Đối tượng sử dụng & vai trò
3. Phân tích nghiệp vụ chi tiết
4. Mô hình cây văn bản 5 cấp
5. Theo dõi báo cáo & công việc
6. Danh mục địa bàn (trường học, TDP, tổ chức đảng)
7. Dashboard
8. Nguyên tắc UI/UX "thân thuộc – dễ nhìn – dễ dùng"
9. Kiến trúc & công nghệ
10. Mô hình dữ liệu (Prisma schema)
11. API
12. Phân quyền
13. Yêu cầu phi chức năng
14. Lộ trình triển khai & tiêu chí nghiệm thu
15. Dữ liệu mẫu (seed)
16. Câu hỏi mở cần xác nhận với phường
17. Hướng dẫn riêng cho Claude Code

---

## 1. BỐI CẢNH & MỤC TIÊU

### 1.1 Bối cảnh

- Phường Thanh Liệt (TP Hà Nội) là đơn vị hành chính mới, hình thành từ 01/07/2025 sau sắp xếp chính quyền 2 cấp, trên cơ sở toàn bộ hoặc một phần các đơn vị cũ: Tả Thanh Oai, Đại Kim, Thanh Xuân Bắc, Hạ Đình, Văn Quán, Thanh Liệt, Tân Triều.
- Đảng bộ phường tổ chức Đại hội lần thứ I, nhiệm kỳ 2025–2030 (15/08/2025).
- Số liệu nền do phường cung cấp:
  - Diện tích tự nhiên: **6,44 km²**
  - Dân số: **~92.000 người** → mật độ ≈ **14.286 người/km²**
  - Tổ chức đảng: **63** (xem câu hỏi mở 16.1)
- Vì là phường mới sáp nhập, dữ liệu địa bàn (TDP, trường học, chi bộ) **còn biến động** → hệ thống phải cho phép cập nhật dễ dàng, **không hard-code** con số nào trên dashboard.

### 1.2 Vấn đề hiện tại (giả định điển hình, cần xác nhận)

| # | Vấn đề | Hệ quả |
|---|--------|--------|
| 1 | Văn bản lưu rải rác (giấy, Zalo, email, máy cá nhân) | Khó tìm, thất lạc, không biết bản nào mới nhất |
| 2 | Không thấy được mối quan hệ "chương trình → kế hoạch → quyết định → văn bản kèm theo" | Lãnh đạo khó nắm bức tranh tổng thể một chương trình |
| 3 | Theo dõi hạn báo cáo bằng sổ tay/Excel | Trễ hạn báo cáo lên cấp trên, nhắc việc thủ công |
| 4 | Giao việc miệng/Zalo, không lưu tiến độ | Không đánh giá được ai làm gì, đến đâu |
| 5 | Số liệu địa bàn (trường, TDP, chi bộ) nằm ở nhiều bộ phận | Mỗi lần họp phải tổng hợp lại từ đầu |

### 1.3 Mục tiêu hệ thống

1. **Một nơi duy nhất** lưu trữ & tra cứu văn bản theo cấu trúc cây (tối đa 5 cấp).
2. **Theo dõi hạn**: văn bản yêu cầu báo cáo, công việc được giao → cảnh báo sắp đến hạn / quá hạn.
3. **Dashboard trực quan** cho lãnh đạo: nhìn 1 màn hình nắm được địa bàn + tình hình thực hiện nhiệm vụ.
4. **Dễ dùng cho cán bộ không chuyên CNTT**, kể cả người lớn tuổi: chữ to, ít bước, tiếng Việt hoàn toàn.

### 1.4 Ngoài phạm vi (giai đoạn 1)

- Không thay thế hệ thống quản lý văn bản điều hành chính thức của thành phố (iOffice / hệ thống QLVB&ĐH). Hệ thống này là công cụ **theo dõi – tổng hợp nội bộ**.
- Không ký số, không liên thông văn bản điện tử.
- **Không lưu văn bản mật** (xem 13.3).

---

## 2. ĐỐI TƯỢNG SỬ DỤNG & VAI TRÒ

| Mã vai trò | Tên | Ai | Việc chính trên hệ thống |
|-----------|-----|-----|--------------------------|
| `ADMIN` | Quản trị hệ thống | Cán bộ CNTT / văn phòng được giao | Quản lý tài khoản, danh mục, cấu hình, xem nhật ký |
| `LEADER` | Lãnh đạo | Bí thư, Phó Bí thư, Chủ tịch, Phó Chủ tịch UBND, Chủ tịch HĐND | Xem dashboard, xem mọi văn bản, giao việc, cho ý kiến, duyệt gia hạn |
| `CLERK` | Văn thư / Văn phòng | Văn phòng HĐND-UBND, Văn phòng Đảng ủy | Nhập văn bản, dựng cây, đính kèm tệp, tạo yêu cầu báo cáo |
| `OFFICER` | Cán bộ / Chuyên viên | Cán bộ các phòng chuyên môn, các ban Đảng | Xem văn bản được giao, cập nhật tiến độ công việc, nộp báo cáo |
| `PARTY_ADMIN` | Ban Xây dựng Đảng | Cán bộ Ban XD Đảng | Quản lý danh mục tổ chức đảng, chi bộ, số đảng viên |
| `VIEWER` | Chỉ xem | Tổ trưởng TDP, Bí thư chi bộ (tùy chọn) | Xem văn bản được chia sẻ, xem dashboard rút gọn |

Một người có thể có nhiều vai trò. Mỗi người thuộc **một đơn vị** (`Department`): Văn phòng Đảng ủy, Ban Xây dựng Đảng, UB MTTQ, Văn phòng HĐND-UBND, Phòng Kinh tế – Hạ tầng – Đô thị, Phòng Văn hóa – Xã hội, Trung tâm phục vụ hành chính công, Công an phường… (danh mục sửa được).

---

## 3. PHÂN TÍCH NGHIỆP VỤ CHI TIẾT

### 3.1 Các khái niệm nghiệp vụ

| Khái niệm | Định nghĩa trong hệ thống |
|-----------|---------------------------|
| **Chương trình** | Gốc của một cây. Là một chủ trương/nhiệm vụ lớn, thường kéo dài nhiều tháng/năm. VD: *"Chương trình hành động thực hiện Nghị quyết Đại hội Đảng bộ phường lần thứ I, nhiệm kỳ 2025–2030"*, *"Chương trình chuyển đổi số năm 2026"*. |
| **Văn bản** | Một nút trong cây. Có số/ký hiệu, trích yếu, loại văn bản, ngày ban hành, cơ quan ban hành, tệp đính kèm. VD: Kế hoạch, Quyết định, Công văn, Thông báo, Báo cáo… |
| **Văn bản con** | Văn bản được ban hành **để triển khai / kèm theo / phản hồi** văn bản cha. |
| **Yêu cầu báo cáo** | Một văn bản có thể đặt ra nghĩa vụ "phải báo cáo kết quả trước ngày X" — một lần hoặc định kỳ. |
| **Công việc** | Nhiệm vụ cụ thể giao cho đơn vị/cá nhân, phát sinh từ một văn bản, có hạn và tiến độ. |
| **Kỳ báo cáo** | Một lần phải nộp báo cáo (VD: báo cáo tháng 10/2026). Yêu cầu định kỳ sinh ra nhiều kỳ. |

### 3.2 Quy trình nghiệp vụ chính

#### QT-01: Tạo chương trình & dựng cây văn bản

```
Văn thư/Lãnh đạo tạo Chương trình (cấp 1)
   → Thêm văn bản con (Kế hoạch triển khai) (cấp 2)
      → Thêm Quyết định (thành lập BCĐ, phân công...) (cấp 3)
         → Thêm văn bản kèm theo (Quy chế, Danh sách...) (cấp 4)
            → Thêm Báo cáo/Văn bản phản hồi (cấp 5)
```
- Ở mỗi nút: nhập thông tin, đính kèm tệp (PDF/DOCX/XLSX/ảnh), gắn đơn vị chủ trì/phối hợp.
- Có thể **kéo-thả** để chuyển văn bản sang nhánh khác (không vượt quá 5 cấp).
- Có thể **sao chép cấu trúc** một chương trình năm trước làm khung cho năm sau (giai đoạn 2).

#### QT-02: Giao việc từ văn bản

```
Lãnh đạo/Văn thư mở văn bản → "Giao việc"
   → chọn đơn vị/người chủ trì, đơn vị phối hợp, hạn hoàn thành, mô tả
   → người được giao nhận thông báo
   → cập nhật tiến độ (%), ghi chú, đính kèm minh chứng
   → báo "Hoàn thành" → người giao xác nhận (đóng) hoặc trả lại
```
- Người thực hiện có thể **đề nghị gia hạn** (lý do + hạn mới) → lãnh đạo duyệt/từ chối.

#### QT-03: Theo dõi văn bản báo cáo

```
Khi nhập văn bản có yêu cầu báo cáo → bật "Yêu cầu báo cáo"
   → chọn: một lần (hạn cụ thể) hoặc định kỳ (tháng/quý/6 tháng/năm, ngày hạn trong kỳ)
   → chọn đơn vị phải báo cáo, nơi nhận báo cáo (VD: UBND TP, Thành ủy, Sở…)
   → hệ thống tự sinh các Kỳ báo cáo
   → đơn vị nộp: đính kèm báo cáo, số/ký hiệu báo cáo, ngày gửi
   → trạng thái: Chưa đến hạn / Sắp đến hạn / Quá hạn / Đã nộp đúng hạn / Đã nộp trễ
```
- Báo cáo đã nộp **tự động được thêm thành văn bản con** của văn bản yêu cầu (nếu cây còn chỗ ≤ 5 cấp; nếu không thì chỉ lưu ở tab Báo cáo).

#### QT-04: Cập nhật danh mục địa bàn

- Ban XD Đảng cập nhật tổ chức đảng, chi bộ, số đảng viên.
- Phòng Văn hóa – Xã hội cập nhật trường học (theo năm học).
- Văn phòng/Công an cập nhật TDP (số hộ, nhân khẩu).
- Mỗi lần cập nhật lưu **ngày cập nhật + người cập nhật** → dashboard ghi "Số liệu cập nhật ngày …".

#### QT-05: Lãnh đạo xem tình hình

- Mở Dashboard → thấy ngay: số liệu địa bàn, số việc quá hạn, báo cáo sắp đến hạn, tiến độ các chương trình.
- Bấm vào bất kỳ con số nào → đi đến danh sách chi tiết đã lọc sẵn (**nguyên tắc "con số nào cũng bấm được"**).

### 3.3 Quy tắc trạng thái (dùng thống nhất toàn hệ thống)

| Trạng thái | Điều kiện | Màu | Biểu tượng |
|-----------|-----------|-----|-----------|
| `CHUA_DEN_HAN` – Đang thực hiện | Chưa hoàn thành, còn > N ngày | Xanh dương `#2563EB` | ⏳ |
| `SAP_DEN_HAN` – Sắp đến hạn | Chưa hoàn thành, còn ≤ N ngày (mặc định N = 3, cấu hình được) | Cam `#F59E0B` | ⚠️ |
| `QUA_HAN` – Quá hạn | Chưa hoàn thành, đã qua hạn | Đỏ `#DC2626` | ❗ |
| `HOAN_THANH` – Hoàn thành đúng hạn | Hoàn thành ≤ hạn | Xanh lá `#16A34A` | ✔ |
| `HOAN_THANH_TRE` – Hoàn thành trễ hạn | Hoàn thành > hạn | Xanh lá đậm + viền cam | ✔! |
| `KHONG_HAN` – Không có hạn | Không đặt hạn | Xám `#6B7280` | — |

- Trạng thái **tính toán** từ dữ liệu (ngày hạn, ngày hoàn thành), không cho sửa tay — tránh sai lệch.
- Hạn tính theo **ngày dương lịch**, giờ Việt Nam (Asia/Ho_Chi_Minh). `[CẦN XÁC NHẬN]` có trừ ngày nghỉ/lễ không — mặc định: không trừ.

### 3.4 Tiến độ cộng dồn của cây

- Tiến độ một văn bản = tiến độ trung bình các công việc gắn trực tiếp + các văn bản con (đệ quy).
- Tiến độ chương trình (gốc) hiển thị dạng thanh % trên dashboard và trên cây.
- Nút có bất kỳ con cháu nào **quá hạn** → hiển thị chấm đỏ nhỏ cạnh tên (để lãnh đạo biết "nhánh này có vấn đề" mà không cần mở).

---

## 4. MÔ HÌNH CÂY VĂN BẢN 5 CẤP

### 4.1 Cấu trúc gợi ý (mặc định, không bắt buộc)

| Cấp | Vai trò thường gặp | Ví dụ |
|-----|-------------------|-------|
| 1 | **Chương trình** (gốc) | Chương trình công tác trọng tâm năm 2026 |
| 2 | Văn bản ban hành triển khai (Nghị quyết, Kế hoạch, Chỉ thị) | Kế hoạch số 45/KH-UBND về chuyển đổi số |
| 3 | Quyết định / Văn bản chỉ đạo cụ thể | QĐ thành lập Tổ công tác chuyển đổi số |
| 4 | Văn bản kèm theo (Quy chế, Phụ lục, Danh sách, Công văn hướng dẫn) | Quy chế hoạt động của Tổ công tác |
| 5 | Báo cáo / Văn bản phản hồi / Minh chứng | Báo cáo kết quả quý III |

- **Cấp 1 bắt buộc là loại "Chương trình"**. Cấp 2–5 chọn **bất kỳ loại văn bản** nào.
- Độ sâu tối đa = 5 (hằng số `MAX_TREE_DEPTH = 5` trong cấu hình, sửa được).

### 4.2 Danh mục loại văn bản (sửa được)

Chương trình, Nghị quyết, Chỉ thị, Kết luận, Quyết định, Kế hoạch, Công văn, Thông báo, Hướng dẫn, Quy chế, Quy định, Báo cáo, Tờ trình, Biên bản, Phụ lục, Khác.

Mỗi loại có: `code` (VD: `KH`, `QD`, `CV`), tên, màu nhãn, biểu tượng.

### 4.3 Trường thông tin của một văn bản

Tham chiếu thể thức văn bản theo Nghị định 30/2020/NĐ-CP về công tác văn thư.

| Trường | Bắt buộc | Ghi chú |
|-------|----------|--------|
| Loại văn bản | ✔ | |
| Số, ký hiệu | | VD: `45/KH-UBND`. Chương trình nội bộ có thể không có |
| Trích yếu / Tiêu đề | ✔ | Tối đa 500 ký tự |
| Cơ quan ban hành | ✔ | Danh mục: Đảng ủy phường, HĐND phường, UBND phường, Thành ủy, UBND TP, các Sở… + nhập tự do |
| Người ký | | |
| Ngày ban hành | ✔ | dd/mm/yyyy |
| Ngày hiệu lực | | |
| Lĩnh vực | | Danh mục: Xây dựng Đảng, Kinh tế, Đô thị, Giáo dục, Y tế, Văn hóa, An ninh – Quốc phòng, Chuyển đổi số… |
| Độ khẩn | | Thường / Khẩn / Thượng khẩn / Hỏa tốc |
| Đơn vị chủ trì | | |
| Đơn vị phối hợp | | Nhiều |
| Hạn xử lý chung | | |
| Nội dung tóm tắt | | Rich text đơn giản |
| Từ khóa / Thẻ | | |
| Tệp đính kèm | | Nhiều tệp, PDF/DOC/DOCX/XLS/XLSX/JPG/PNG, ≤ 20 MB/tệp |
| Yêu cầu báo cáo | | Bật/tắt → mở form ở Mục 5.1 |
| Trạng thái văn bản | ✔ | `Còn hiệu lực` / `Hết hiệu lực` / `Bị thay thế` (+ liên kết văn bản thay thế) |

### 4.4 Thao tác trên cây

| Thao tác | Mô tả |
|---------|------|
| Mở/thu nhánh | Bấm mũi tên; nút "Mở tất cả / Thu tất cả" |
| Thêm văn bản con | Nút `+` khi rê chuột, hoặc menu chuột phải. Ẩn khi đã ở cấp 5 |
| Sửa / Xóa | Xóa = **xóa mềm** (vào Thùng rác 30 ngày). Không cho xóa nút còn con trừ khi xác nhận "xóa cả nhánh" |
| Di chuyển | Kéo-thả, hoặc "Chuyển đến…" chọn cha mới. Chặn nếu vượt 5 cấp |
| Sắp xếp | Theo thứ tự thủ công (kéo-thả) / ngày ban hành |
| Tìm trong cây | Gõ từ khóa → làm nổi bật & tự mở nhánh chứa kết quả. Tìm **không dấu** ("ke hoach" khớp "Kế hoạch") |
| Đường dẫn (breadcrumb) | `Chương trình X › Kế hoạch 45 › QĐ 120 › …` bấm được từng cấp |
| Xem dạng bảng | Chuyển giữa "Dạng cây" và "Dạng danh sách" (bảng phẳng có cột Cấp, lọc, xuất Excel) |
| Xuất | Xuất cây ra Excel (thụt lề theo cấp) / PDF mục lục |

### 4.5 Giao diện trang Văn bản (bố cục 2 cột)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Văn bản › Chương trình công tác 2026                       [+ Chương trình]│
├──────────────────────────────┬──────────────────────────────────────────┤
│ 🔍 Tìm văn bản...             │  📄 Kế hoạch số 45/KH-UBND               │
│ [Lọc: Lĩnh vực▾ Trạng thái▾] │  Triển khai chuyển đổi số năm 2026       │
│                              │  ● Đang thực hiện   Tiến độ ███████░ 70% │
│ ▾ 📁 CT công tác 2026  65%   │  ─────────────────────────────────────── │
│   ▾ 📄 KH 45/KH-UBND  70% ●  │  [Thông tin][Tệp (3)][Công việc (5)]     │
│     ▸ 📄 QĐ 120/QĐ-UBND      │  [Báo cáo (2)][Lịch sử]                  │
│     ▸ 📄 CV 88/UBND-VP   🔴  │                                          │
│   ▸ 📄 KH 52/KH-UBND  40%    │  Cơ quan ban hành: UBND phường           │
│ ▸ 📁 CT hành động NQ ĐH I    │  Ngày ban hành: 12/01/2026               │
│ ▸ 📁 CT chuyển đổi số        │  Chủ trì: Văn phòng HĐND-UBND            │
│                              │  ...                                     │
│                              │  [✏ Sửa] [+ Văn bản con] [👤 Giao việc]   │
└──────────────────────────────┴──────────────────────────────────────────┘
```
- Cột trái (cây) rộng ~35%, kéo giãn được. Trên mobile: cây hiện trước, bấm vào nút thì mở trang chi tiết.
- Mỗi dòng cây: biểu tượng loại, số ký hiệu (đậm) + trích yếu rút gọn, % tiến độ, chấm trạng thái, số con (badge).

---

## 5. THEO DÕI BÁO CÁO & CÔNG VIỆC

### 5.1 Yêu cầu báo cáo

| Trường | Ghi chú |
|-------|--------|
| Văn bản nguồn | Văn bản đặt ra yêu cầu |
| Tên báo cáo | VD: "Báo cáo kết quả thực hiện chuyển đổi số" |
| Kiểu | `ONCE` (một lần) / `MONTHLY` / `QUARTERLY` / `HALF_YEAR` / `YEARLY` |
| Hạn (một lần) | Ngày cụ thể |
| Quy tắc hạn định kỳ | Ngày thứ X của tháng/kỳ (VD: ngày 20 hằng tháng; ngày 15 tháng cuối quý) |
| Thời gian áp dụng | Từ ngày – đến ngày |
| Nơi nhận báo cáo | VD: UBND Thành phố, Thành ủy, Sở Nội vụ… |
| Đơn vị phải báo cáo | Một hoặc nhiều đơn vị → mỗi đơn vị một bản nộp/kỳ |
| Người theo dõi | Cán bộ đôn đốc |

**Sinh kỳ báo cáo**: khi lưu, hệ thống sinh `ReportPeriod` cho toàn bộ khoảng thời gian áp dụng (tối đa 24 kỳ trước; job hằng ngày sinh thêm khi gần hết).

**Nộp báo cáo** (`ReportSubmission`): số/ký hiệu báo cáo, ngày gửi, tệp, ghi chú, người nộp. Có thể sửa trong 24h, sau đó cần ADMIN/LEADER mở khóa.

### 5.2 Công việc

| Trường | Ghi chú |
|-------|--------|
| Tiêu đề, mô tả | |
| Văn bản nguồn | Không bắt buộc (cho phép việc phát sinh không từ văn bản) |
| Người giao | Tự động = người tạo |
| Chủ trì | 1 đơn vị và/hoặc 1 cá nhân |
| Phối hợp | Nhiều đơn vị/cá nhân |
| Ngày bắt đầu, hạn hoàn thành | |
| Mức ưu tiên | Thấp / Bình thường / Cao / Khẩn |
| Tiến độ % | 0–100, cập nhật bằng thanh trượt theo bước 10 |
| Cập nhật tiến độ | Mỗi lần cập nhật lưu 1 bản ghi: %, nội dung, tệp minh chứng, thời điểm |
| Trạng thái quy trình | `NEW` → `IN_PROGRESS` → `SUBMITTED` (báo hoàn thành) → `DONE` / trả lại `IN_PROGRESS`; `CANCELLED` |
| Gia hạn | Đề nghị (hạn mới + lý do) → duyệt/từ chối; lưu lịch sử hạn cũ |

Trạng thái theo hạn (Mục 3.3) được tính từ `dueDate`, `completedAt`.

### 5.3 Màn hình "Việc của tôi"

- Trang mặc định khi `OFFICER` đăng nhập.
- 3 thẻ đầu trang: **Quá hạn (đỏ)** · **Sắp đến hạn (cam)** · **Đang làm (xanh)**.
- Danh sách gồm cả công việc và kỳ báo cáo mà mình/đơn vị mình phải làm, sắp theo hạn gần nhất.
- Mỗi dòng có nút thao tác nhanh: "Cập nhật tiến độ", "Nộp báo cáo".

### 5.4 Thông báo & nhắc việc

- Chuông thông báo trong ứng dụng (badge số chưa đọc).
- Sự kiện sinh thông báo: được giao việc; việc/báo cáo còn 3 ngày, 1 ngày; quá hạn (nhắc 1 lần/ngày, tối đa 7 ngày); việc được báo hoàn thành (gửi người giao); đề nghị gia hạn (gửi lãnh đạo); văn bản mới trong chương trình mình theo dõi.
- Job chạy **06:30 hằng ngày** (giờ VN) tính trạng thái & sinh thông báo.
- Giai đoạn 2: gửi email / Zalo OA `[CẦN XÁC NHẬN]`.

---

## 6. DANH MỤC ĐỊA BÀN

### 6.1 Thông tin chung phường (bản ghi duy nhất, ADMIN sửa)

| Trường | Giá trị khởi tạo |
|-------|-----------------|
| Tên đơn vị | Phường Thanh Liệt |
| Thành phố | Hà Nội |
| Diện tích tự nhiên (km²) | 6,44 |
| Dân số (người) | 92.000 |
| Số hộ | `[CẦN XÁC NHẬN]` |
| Ngày thành lập | 01/07/2025 |
| Địa chỉ trụ sở, điện thoại | `[CẦN XÁC NHẬN]` |
| Ngày cập nhật số liệu | tự động |

- Dân số có 2 nguồn: **giá trị nhập tay** ở đây, và **tổng nhân khẩu các TDP**. Dashboard hiển thị giá trị nhập tay; nếu lệch > 5% với tổng TDP thì hiện ghi chú nhỏ cho ADMIN (không hiện cho lãnh đạo).

### 6.2 Trường học

**Trường học** (`School`):

| Trường | Ghi chú |
|-------|--------|
| Tên trường | VD: Trường THCS Thanh Liệt |
| Cấp học | Mầm non / Tiểu học / THCS / THPT / Liên cấp / GDNN-GDTX |
| Loại hình | Công lập / Tư thục / Dân lập |
| Địa chỉ, điện thoại, email | |
| Hiệu trưởng | Họ tên, SĐT |
| Tọa độ (lat/lng) | Tùy chọn, cho bản đồ giai đoạn 2 |
| Đang hoạt động | Có/Không |

**Số liệu theo năm học** (`SchoolYearStat`) — vì quy mô thay đổi mỗi năm:

| Trường | Ghi chú |
|-------|--------|
| Năm học | VD: `2026-2027` |
| Tổng cán bộ, giáo viên, nhân viên | **Bắt buộc** |
| — Cán bộ quản lý / Giáo viên / Nhân viên | Chi tiết, không bắt buộc |
| Số lớp | |
| Số học sinh | **Bắt buộc** |
| — Học sinh nữ | Tùy chọn |
| Ghi chú | |

Màn hình: bảng trường học, lọc theo cấp học/loại hình, chọn năm học ở góc phải (mặc định năm học hiện tại), dòng tổng cuối bảng. Xem chi tiết trường → biểu đồ đường số học sinh qua các năm.

### 6.3 Tổ dân phố (TDP)

| Trường | Ghi chú |
|-------|--------|
| Tên TDP | VD: "Tổ dân phố số 1", "TDP Văn Điển"… |
| Mã/Số thứ tự | để sắp xếp |
| Khu vực cũ (trước sáp nhập) | Danh mục: Thanh Liệt, Tân Triều, Đại Kim, Hạ Đình, Thanh Xuân Bắc, Văn Quán, Tả Thanh Oai |
| Tổ trưởng | Họ tên, SĐT |
| Số hộ | |
| Số nhân khẩu | |
| Chi bộ phụ trách | Liên kết tới `PartyOrg` |
| Ghi chú | |

> Yêu cầu "Quản lý TDP (Tên TDP, Số lượng)": hiểu là **danh sách TDP + số lượng** (tổng số TDP, và số hộ/nhân khẩu từng TDP). `[CẦN XÁC NHẬN]` "số lượng" là số hộ hay số nhân khẩu — mặc định lưu cả hai.

### 6.4 Tổ chức đảng & chi bộ (Ban Xây dựng Đảng)

Tổ chức đảng là **cây 2–3 cấp**:

```
Đảng bộ phường Thanh Liệt
 ├─ Đảng bộ bộ phận / Đảng bộ cơ sở trực thuộc (nếu có)
 │    └─ Chi bộ trực thuộc đảng bộ bộ phận
 └─ Chi bộ cơ sở trực thuộc Đảng ủy phường
```

| Trường | Ghi chú |
|-------|--------|
| Tên tổ chức | VD: "Chi bộ Tổ dân phố số 5" |
| Loại | Đảng bộ bộ phận / Đảng bộ cơ sở / Chi bộ cơ sở / Chi bộ trực thuộc |
| Khối | Khu dân cư (TDP) / Cơ quan hành chính / Trường học / Y tế / Doanh nghiệp / Công an / Quân sự / Khác |
| Cấp trên trực tiếp | parent |
| Bí thư, Phó Bí thư | Họ tên, SĐT |
| Số đảng viên | Tổng; tùy chọn: chính thức / dự bị |
| Liên kết | TDP hoặc trường học tương ứng (nếu có) |
| Xếp loại năm gần nhất | Hoàn thành xuất sắc / tốt / hoàn thành / không hoàn thành |

**Số liệu hiển thị dashboard (tự đếm từ danh mục)**:
- Tổng số tổ chức đảng trực thuộc (đếm loại ≠ Đảng bộ phường) — giá trị khởi tạo do phường cung cấp: **63**.
- Số chi bộ (cơ sở + trực thuộc) — đây là "số lượng chi bộ" Ban XD Đảng theo dõi.
- Tổng số đảng viên.
- Phân bố chi bộ theo khối.

> Để lên dashboard ngay khi chưa nhập đủ danh mục, cho phép ADMIN/PARTY_ADMIN nhập **"số liệu tổng hợp thủ công"** (override). Khi danh mục đã đủ, tắt override → dùng số đếm thực.

---

## 7. DASHBOARD

### 7.1 Nguyên tắc

1. **Đọc trong 5 giây**: con số lớn, nhãn rõ, ít chữ.
2. **Hai nửa rõ ràng**: (A) *Địa bàn* — phường có gì; (B) *Điều hành* — việc đang thế nào.
3. **Con số nào cũng bấm được** → dẫn tới danh sách chi tiết đã lọc.
4. Ghi **"Cập nhật lúc …"** cho từng khối số liệu.
5. Có nút **"Trình chiếu"** (toàn màn hình, chữ to hơn, tự làm mới 5 phút/lần) để chiếu lên TV phòng họp giao ban.

### 7.2 Bố cục (desktop ≥ 1280px)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  🏛 PHƯỜNG THANH LIỆT — BẢNG ĐIỀU HÀNH          Thứ Ba, 20/10/2026  [⛶ Trình chiếu]│
├───────────────────────────────────────────────────────────────────────────────┤
│ ① THẺ SỐ LIỆU ĐỊA BÀN (8 thẻ, 4 cột × 2 hàng)                                   │
│ ┌──────────┐┌──────────┐┌──────────┐┌──────────┐                               │
│ │🗺 6,44 km²││👥 ~92.000 ││🏘 xx TDP  ││⚑ 63 TCĐ  │                               │
│ │Diện tích ││Dân số    ││Tổ dân phố ││Tổ chức đảng│                             │
│ └──────────┘└──────────┘└──────────┘└──────────┘                               │
│ ┌──────────┐┌──────────┐┌──────────┐┌──────────┐                               │
│ │◉ xx chi bộ││★ x.xxx ĐV ││🏫 xx trường││🎒 xx.xxx HS│                            │
│ └──────────┘└──────────┘└──────────┘└──────────┘                               │
├───────────────────────────────────────────────────────────────────────────────┤
│ ② TÌNH HÌNH THỰC HIỆN NHIỆM VỤ                                                  │
│ ┌────────────┐┌────────────┐┌────────────┐┌────────────┐                       │
│ │❗ 5 Quá hạn ││⚠ 8 Sắp hạn ││⏳ 34 Đang làm││✔ 120 Xong  │  (công việc)        │
│ └────────────┘└────────────┘└────────────┘└────────────┘                       │
│ ┌──────────────────────────────┐┌─────────────────────────────────────┐        │
│ │ Báo cáo cần nộp 14 ngày tới   ││ Tiến độ các chương trình            │        │
│ │ (bảng: tên, hạn, đơn vị, còn  ││ (thanh ngang %, xếp theo % tăng dần)│        │
│ │  bao nhiêu ngày — tô màu)     ││                                     │        │
│ └──────────────────────────────┘└─────────────────────────────────────┘        │
│ ┌──────────────────────────────┐┌─────────────────────────────────────┐        │
│ │ Việc quá hạn theo đơn vị      ││ Văn bản mới ban hành (10 gần nhất)  │        │
│ │ (biểu đồ cột ngang)           ││                                     │        │
│ └──────────────────────────────┘└─────────────────────────────────────┘        │
├───────────────────────────────────────────────────────────────────────────────┤
│ ③ GIÁO DỤC                       │ ④ XÂY DỰNG ĐẢNG        │ ⑤ TỔ DÂN PHỐ          │
│ - Donut: số trường theo cấp học │ - Donut: chi bộ theo khối│ - Cột: nhân khẩu theo │
│ - Bảng: Tên trường | CB-GV-NV | │ - Số ĐV, số chi bộ     │   khu vực cũ           │
│   Học sinh | Số lớp (năm học ▾)│ - Top 5 chi bộ đông ĐV │ - Bảng: TDP | Hộ | NK  │
│ - Tổng: xx CB-GV-NV, xx HS     │                         │   (cuộn, tìm kiếm)     │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Đặc tả từng thẻ/khối

| Khối | Nguồn dữ liệu | Bấm vào → |
|-----|---------------|-----------|
| Diện tích | `WardProfile.areaKm2` | Trang Thông tin phường |
| Dân số | `WardProfile.population`, kèm dòng phụ "Mật độ ≈ 14.286 người/km²" (tính tự động) | Trang Thông tin phường |
| Tổ dân phố | `count(Residential where active)` | Danh mục TDP |
| Tổ chức đảng | `count(PartyOrg)` trừ gốc (hoặc override) | Danh mục tổ chức đảng |
| Chi bộ | `count(PartyOrg where type in [CHI_BO_CO_SO, CHI_BO_TRUC_THUOC])` | Danh mục lọc chi bộ |
| Đảng viên | `sum(PartyOrg.memberCount)` lá | Danh mục tổ chức đảng |
| Trường học | `count(School where active)` | Danh mục trường |
| Học sinh | `sum(SchoolYearStat.students)` năm học hiện tại; dòng phụ "CB-GV-NV: xxx" | Danh mục trường |
| Công việc theo trạng thái | `Task` | Danh sách công việc lọc theo trạng thái |
| Báo cáo cần nộp 14 ngày | `ReportPeriod` chưa nộp, hạn ≤ hôm nay+14, cả quá hạn | Trang Theo dõi báo cáo |
| Tiến độ chương trình | `DocumentNode depth=1`, progress cộng dồn | Cây văn bản mở tại chương trình |
| Việc quá hạn theo đơn vị | group by `Task.leadDepartmentId` | Danh sách công việc lọc |
| Văn bản mới | `DocumentNode order by issuedDate desc limit 10` | Chi tiết văn bản |

### 7.4 Định dạng số

- Phân cách nghìn bằng dấu chấm: `92.000`; thập phân dấu phẩy: `6,44`.
- Dân số hiển thị `~92.000` nếu bật cờ "số liệu ước tính".
- Ngày: `dd/mm/yyyy`; ngày tương đối: "còn 3 ngày", "quá 2 ngày".
- Dùng `Intl.NumberFormat('vi-VN')`.

### 7.5 Dashboard theo vai trò

- `LEADER`, `ADMIN`: đầy đủ.
- `OFFICER`: khối ① rút gọn + khối "Việc của tôi" thay cho khối ②.
- `VIEWER`: chỉ khối ① và ③④⑤.

---

## 8. NGUYÊN TẮC UI/UX "THÂN THUỘC – DỄ NHÌN – DỄ DÙNG"

### 8.1 Người dùng mục tiêu

Cán bộ phường 30–60 tuổi, quen Word/Excel/Zalo, dùng máy tính bàn màn 21–24", đôi khi điện thoại. → Thiết kế giống "phần mềm hành chính quen thuộc" nhưng gọn và hiện đại hơn.

### 8.2 Quy tắc bắt buộc

1. **100% tiếng Việt**, kể cả thông báo lỗi, nút, placeholder. Không dùng thuật ngữ tiếng Anh ("Dashboard" → "Bảng điều hành"; "Task" → "Công việc").
2. **Cỡ chữ cơ bản 16px**, bảng 15px, tiêu đề trang 24px, số trên thẻ dashboard 36–40px. Có nút **A− / A+** ở header (lưu theo người dùng).
3. **Font**: `Be Vietnam Pro` (Google Fonts) — hiển thị dấu tiếng Việt rõ, trung tính.
4. **Màu chủ đạo**: xanh đậm hành chính `#1E3A8A` (header, nút chính) + điểm nhấn đỏ `#B91C1C` (dùng tiết chế: logo, cảnh báo). Nền `#F8FAFC`, thẻ trắng, bo góc 12px, bóng nhẹ. Hỗ trợ chế độ tối (tùy chọn) nhưng mặc định sáng.
5. **Màu trạng thái** đúng bảng Mục 3.3, luôn **kèm chữ hoặc biểu tượng** (không chỉ dựa vào màu — người mù màu).
6. **Thanh bên trái** cố định, biểu tượng + chữ, thu gọn được:
   - 🏠 Bảng điều hành
   - ✅ Việc của tôi
   - 📂 Văn bản (cây)
   - 📋 Theo dõi báo cáo
   - 🗂 Công việc
   - 📊 Địa bàn ▸ Thông tin phường · Trường học · Tổ dân phố · Tổ chức đảng
   - ⚙ Quản trị ▸ Người dùng · Đơn vị · Danh mục · Nhật ký · Thùng rác
7. **Mỗi màn hình chỉ 1 nút chính** (màu đậm, góc phải trên). Nút phụ dạng viền.
8. **Form**: nhãn nằm trên ô nhập, dấu `*` đỏ cho trường bắt buộc, kiểm tra lỗi ngay khi rời ô, thông báo lỗi bằng câu đầy đủ ("Vui lòng nhập trích yếu văn bản").
9. **Chọn ngày**: lịch tiếng Việt, tuần bắt đầu Thứ Hai, cho phép gõ `dd/mm/yyyy`.
10. **Xác nhận trước khi xóa** bằng hộp thoại nói rõ hậu quả ("Văn bản và 3 văn bản con sẽ được chuyển vào Thùng rác").
11. **Thông báo thành công** dạng toast góc phải dưới, tự tắt 4 giây.
12. **Trạng thái rỗng** có hình minh họa + hướng dẫn + nút hành động ("Chưa có chương trình nào. [+ Tạo chương trình đầu tiên]").
13. **Tìm kiếm toàn cục** ở header (phím tắt `Ctrl+K`): tìm văn bản, công việc, trường, TDP, chi bộ — không dấu.
14. **Bảng dữ liệu**: tiêu đề cố định khi cuộn, sắp xếp cột, lọc, phân trang 20/50/100, nút "Xuất Excel" ở mọi bảng.
15. **Responsive**: ≥1280 đầy đủ; 768–1279 thanh bên thu gọn; <768 thanh bên thành menu hamburger, thẻ dashboard 2 cột, bảng chuyển thành thẻ.
16. **Khả năng tiếp cận**: tương phản ≥ 4.5:1, điều hướng bàn phím, `aria-label` cho nút biểu tượng.
17. **Hướng dẫn tại chỗ**: biểu tượng `ⓘ` cạnh các trường khó hiểu; lần đầu đăng nhập có tour 4–5 bước.

### 8.3 Thư viện giao diện

- `shadcn/ui` (Radix) + Tailwind CSS — tùy biến theo theme trên.
- Biểu tượng: `lucide-react`.
- Biểu đồ: `recharts` (cấu hình tooltip, nhãn tiếng Việt, định dạng số vi-VN).
- Cây: tự viết component dựa trên dữ liệu phẳng + `@dnd-kit` cho kéo-thả (hoặc `react-arborist` nếu thuận tiện hơn).
- Bảng: `@tanstack/react-table`.
- Form: `react-hook-form` + `zod`.
- Ngày: `date-fns` + locale `vi`.

---

## 9. KIẾN TRÚC & CÔNG NGHỆ

### 9.1 Stack đề xuất

| Lớp | Công nghệ |
|-----|----------|
| Framework | **Next.js 15 (App Router) + TypeScript (strict)** |
| UI | Tailwind CSS, shadcn/ui, lucide-react, recharts |
| Server logic | Server Actions + Route Handlers (`/api/*`) |
| ORM | **Prisma** |
| CSDL | **PostgreSQL 16** (bật extension `unaccent`, `pg_trgm`) |
| Xác thực | Auth.js (NextAuth v5) – Credentials (tên đăng nhập + mật khẩu, bcrypt) |
| Lưu tệp | Ổ đĩa cục bộ qua lớp trừu tượng `StorageService` (`/data/uploads`), có thể đổi sang MinIO/S3 |
| Xem PDF | Nhúng `<iframe>` / `react-pdf` |
| Job định kỳ | `node-cron` trong tiến trình worker riêng (`npm run worker`) |
| Xuất Excel | `exceljs` |
| Kiểm thử | Vitest (unit), Playwright (e2e luồng chính) |
| Đóng gói | Docker + docker-compose (app, worker, postgres) |
| Triển khai | Máy chủ nội bộ của phường hoặc VPS trong nước; HTTPS qua Nginx/Caddy |

### 9.2 Cấu trúc thư mục

```
/
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts
├─ src/
│  ├─ app/
│  │  ├─ (auth)/dang-nhap/page.tsx
│  │  ├─ (app)/layout.tsx                 # sidebar + header
│  │  ├─ (app)/page.tsx                    # Bảng điều hành
│  │  ├─ (app)/trinh-chieu/page.tsx        # chế độ TV
│  │  ├─ (app)/viec-cua-toi/page.tsx
│  │  ├─ (app)/van-ban/page.tsx            # cây + chi tiết
│  │  ├─ (app)/van-ban/[id]/page.tsx
│  │  ├─ (app)/bao-cao/page.tsx
│  │  ├─ (app)/cong-viec/page.tsx
│  │  ├─ (app)/cong-viec/[id]/page.tsx
│  │  ├─ (app)/dia-ban/thong-tin-phuong/page.tsx
│  │  ├─ (app)/dia-ban/truong-hoc/page.tsx
│  │  ├─ (app)/dia-ban/to-dan-pho/page.tsx
│  │  ├─ (app)/dia-ban/to-chuc-dang/page.tsx
│  │  ├─ (app)/quan-tri/{nguoi-dung,don-vi,danh-muc,nhat-ky,thung-rac}/page.tsx
│  │  └─ api/  (files, export, search, dashboard)
│  ├─ components/
│  │  ├─ ui/              # shadcn
│  │  ├─ layout/          # Sidebar, Header, Breadcrumb, FontSizeToggle
│  │  ├─ dashboard/       # StatCard, ChartCard, ...
│  │  ├─ document-tree/   # Tree, TreeNode, NodeDetail, MoveDialog
│  │  ├─ tasks/ reports/ catalog/
│  │  └─ common/          # StatusBadge, EmptyState, ConfirmDialog, DataTable, FileUploader
│  ├─ lib/
│  │  ├─ db.ts  auth.ts  permissions.ts  storage.ts
│  │  ├─ status.ts        # tính trạng thái theo hạn (Mục 3.3) — có unit test
│  │  ├─ tree.ts          # path, depth, move, progress roll-up — có unit test
│  │  ├─ report-periods.ts# sinh kỳ báo cáo — có unit test
│  │  ├─ format.ts        # số, ngày vi-VN
│  │  └─ audit.ts
│  ├─ server/
│  │  ├─ actions/         # server actions theo module
│  │  └─ queries/         # truy vấn đọc (dashboard, tree...)
│  └─ worker/index.ts     # cron jobs
├─ tests/ (unit, e2e)
├─ docker-compose.yml  Dockerfile  .env.example
└─ CLAUDE.md
```

### 9.3 Lưu cây trong CSDL

Dùng **adjacency list + materialized path**:
- `parentId` — cha trực tiếp.
- `path` — chuỗi id tổ tiên, VD `/rootId/childId/`.
- `depth` — 1..5.
- `rootId` — id chương trình gốc (lọc nhanh theo chương trình).
- `sortOrder` — thứ tự trong cùng cha.

Truy vấn cả nhánh: `WHERE path LIKE '/rootId/childId/%'`. Khi di chuyển: cập nhật `path`, `depth`, `rootId` của nút và toàn bộ con cháu trong **một transaction**; kiểm tra `depth_mới_của_nút + (độ sâu cây con) - 1 ≤ 5` và không cho chuyển vào chính con cháu của nó.

---

## 10. MÔ HÌNH DỮ LIỆU (PRISMA SCHEMA)

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

// ===================== NGƯỜI DÙNG & ĐƠN VỊ =====================
enum Role { ADMIN LEADER CLERK OFFICER PARTY_ADMIN VIEWER }

model Department {
  id        String   @id @default(cuid())
  name      String   @unique
  shortName String?
  sortOrder Int      @default(0)
  active    Boolean  @default(true)
  users     User[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model User {
  id            String      @id @default(cuid())
  username      String      @unique
  passwordHash  String
  fullName      String
  position      String?     // Chức vụ
  phone         String?
  email         String?
  roles         Role[]
  departmentId  String?
  department    Department? @relation(fields: [departmentId], references: [id])
  fontScale     Int         @default(100) // 100, 112, 125
  active        Boolean     @default(true)
  mustChangePassword Boolean @default(true)
  lastLoginAt   DateTime?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}

// ===================== THÔNG TIN PHƯỜNG =====================
model WardProfile {
  id               Int      @id @default(1)
  name             String   @default("Phường Thanh Liệt")
  city             String   @default("Hà Nội")
  areaKm2          Decimal  @db.Decimal(8, 2)
  population       Int
  populationIsEstimate Boolean @default(true)
  households       Int?
  establishedDate  DateTime?
  address          String?
  phone            String?
  partyOrgCountOverride Int?   // nhập tay khi danh mục chưa đủ
  partyCellCountOverride Int?
  partyMemberCountOverride Int?
  updatedById      String?
  updatedAt        DateTime @updatedAt
}

// ===================== DANH MỤC CHUNG =====================
model DocumentType {
  id        String  @id @default(cuid())
  code      String  @unique   // CT, NQ, KH, QD, CV, BC...
  name      String
  color     String  @default("#1E3A8A")
  icon      String  @default("file-text")
  isProgram Boolean @default(false) // loại "Chương trình" dùng cho cấp 1
  sortOrder Int     @default(0)
  active    Boolean @default(true)
}

model Field {          // Lĩnh vực
  id     String @id @default(cuid())
  name   String @unique
  sortOrder Int @default(0)
  active Boolean @default(true)
}

model IssuingAgency {  // Cơ quan ban hành / nơi nhận báo cáo
  id     String @id @default(cuid())
  name   String @unique
  level  String?  // Phường / Thành phố / Trung ương
  active Boolean @default(true)
}

// ===================== CÂY VĂN BẢN =====================
enum Urgency { NORMAL URGENT VERY_URGENT FLASH }
enum DocValidity { ACTIVE EXPIRED REPLACED }

model DocumentNode {
  id            String        @id @default(cuid())
  parentId      String?
  parent        DocumentNode? @relation("Tree", fields: [parentId], references: [id])
  children      DocumentNode[] @relation("Tree")
  rootId        String?       // null nếu chính nó là gốc
  path          String        // "/id1/id2/"
  depth         Int           // 1..5
  sortOrder     Int           @default(0)

  typeId        String
  type          DocumentType  @relation(fields: [typeId], references: [id])
  number        String?       // Số, ký hiệu
  title         String        // Trích yếu
  summary       String?       // Nội dung tóm tắt (HTML đã sanitize)
  issuingAgencyId String?
  issuingAgency   IssuingAgency? @relation(fields: [issuingAgencyId], references: [id])
  issuingAgencyText String?
  signer        String?
  issuedDate    DateTime?
  effectiveDate DateTime?
  dueDate       DateTime?
  fieldId       String?
  field         Field?        @relation(fields: [fieldId], references: [id])
  urgency       Urgency       @default(NORMAL)
  validity      DocValidity   @default(ACTIVE)
  replacedById  String?
  tags          String[]
  leadDepartmentId String?
  coDepartmentIds  String[]

  progressCache Int           @default(0)   // % cộng dồn, cập nhật khi task/child đổi
  hasOverdueDescendant Boolean @default(false)
  searchText    String        // unaccent(lower(number + title + summary + tags)) để tìm không dấu

  attachments   Attachment[]
  tasks         Task[]
  reportRequirements ReportRequirement[]

  createdById   String
  updatedById   String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  deletedAt     DateTime?

  @@index([parentId])
  @@index([rootId])
  @@index([path])
  @@index([issuedDate])
}

model Attachment {
  id           String   @id @default(cuid())
  documentId   String?
  document     DocumentNode? @relation(fields: [documentId], references: [id])
  taskUpdateId String?
  submissionId String?
  fileName     String       // tên gốc
  storageKey   String       // đường dẫn lưu
  mimeType     String
  sizeBytes    Int
  checksum     String
  uploadedById String
  createdAt    DateTime @default(now())
  deletedAt    DateTime?
}

// ===================== CÔNG VIỆC =====================
enum TaskFlow { NEW IN_PROGRESS SUBMITTED DONE CANCELLED }
enum Priority { LOW NORMAL HIGH URGENT }

model Task {
  id              String     @id @default(cuid())
  title           String
  description     String?
  documentId      String?
  document        DocumentNode? @relation(fields: [documentId], references: [id])
  assignerId      String
  leadDepartmentId String?
  leadUserId      String?
  coDepartmentIds String[]
  coUserIds       String[]
  startDate       DateTime?
  dueDate         DateTime?
  priority        Priority   @default(NORMAL)
  flow            TaskFlow   @default(NEW)
  progress        Int        @default(0)
  completedAt     DateTime?
  updates         TaskUpdate[]
  extensions      TaskExtension[]
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  deletedAt       DateTime?
  @@index([dueDate]) @@index([leadDepartmentId]) @@index([leadUserId])
}

model TaskUpdate {
  id        String   @id @default(cuid())
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id])
  userId    String
  progress  Int
  content   String
  createdAt DateTime @default(now())
}

enum ExtensionStatus { PENDING APPROVED REJECTED }
model TaskExtension {
  id          String   @id @default(cuid())
  taskId      String
  task        Task     @relation(fields: [taskId], references: [id])
  requestedById String
  oldDueDate  DateTime
  newDueDate  DateTime
  reason      String
  status      ExtensionStatus @default(PENDING)
  decidedById String?
  decidedAt   DateTime?
  decisionNote String?
  createdAt   DateTime @default(now())
}

// ===================== BÁO CÁO =====================
enum ReportFrequency { ONCE MONTHLY QUARTERLY HALF_YEAR YEARLY }

model ReportRequirement {
  id             String   @id @default(cuid())
  documentId     String
  document       DocumentNode @relation(fields: [documentId], references: [id])
  name           String
  frequency      ReportFrequency
  onceDueDate    DateTime?
  dueDayOfPeriod Int?      // ngày thứ mấy (với MONTHLY: ngày trong tháng; QUARTERLY/HALF/YEAR: ngày trong tháng cuối kỳ)
  dueMonthOffset Int?      // tùy chọn: hạn rơi vào tháng sau kỳ (VD báo cáo tháng nộp ngày 5 tháng sau → 1)
  startDate      DateTime
  endDate        DateTime?
  recipientAgencyId String?
  departmentIds  String[]  // đơn vị phải báo cáo
  followerUserId String?
  active         Boolean  @default(true)
  periods        ReportPeriod[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model ReportPeriod {
  id            String   @id @default(cuid())
  requirementId String
  requirement   ReportRequirement @relation(fields: [requirementId], references: [id])
  label         String   // "Tháng 10/2026", "Quý III/2026", "6 tháng đầu năm 2026", "Năm 2026"
  periodStart   DateTime
  periodEnd     DateTime
  dueDate       DateTime
  departmentId  String
  submissions   ReportSubmission[]
  @@unique([requirementId, periodStart, departmentId])
  @@index([dueDate])
}

model ReportSubmission {
  id          String   @id @default(cuid())
  periodId    String
  period      ReportPeriod @relation(fields: [periodId], references: [id])
  number      String?
  sentDate    DateTime
  note        String?
  submittedById String
  linkedDocumentId String? // văn bản con tự tạo
  lockedAt    DateTime?
  createdAt   DateTime @default(now())
}

// ===================== ĐỊA BÀN =====================
enum SchoolLevel { MAM_NON TIEU_HOC THCS THPT LIEN_CAP GDNN_GDTX }
enum SchoolOwnership { CONG_LAP TU_THUC DAN_LAP }

model School {
  id          String   @id @default(cuid())
  name        String   @unique
  level       SchoolLevel
  ownership   SchoolOwnership @default(CONG_LAP)
  address     String?
  phone       String?
  email       String?
  principal   String?
  principalPhone String?
  lat         Float?
  lng         Float?
  active      Boolean  @default(true)
  stats       SchoolYearStat[]
  sortOrder   Int      @default(0)
  updatedById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model SchoolYearStat {
  id           String @id @default(cuid())
  schoolId     String
  school       School @relation(fields: [schoolId], references: [id])
  schoolYear   String     // "2026-2027"
  staffTotal   Int        // tổng CB-GV-NV
  managers     Int?
  teachers     Int?
  employees    Int?
  classes      Int?
  students     Int
  femaleStudents Int?
  note         String?
  updatedById  String?
  updatedAt    DateTime @updatedAt
  @@unique([schoolId, schoolYear])
}

model OldArea {   // khu vực trước sáp nhập
  id   String @id @default(cuid())
  name String @unique
}

model Residential {  // Tổ dân phố
  id          String   @id @default(cuid())
  name        String   @unique
  code        Int?
  oldAreaId   String?
  leaderName  String?
  leaderPhone String?
  households  Int?
  population  Int?
  partyOrgId  String?
  note        String?
  active      Boolean  @default(true)
  updatedById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum PartyOrgType { DANG_BO_PHUONG DANG_BO_BO_PHAN DANG_BO_CO_SO CHI_BO_CO_SO CHI_BO_TRUC_THUOC }
enum PartyBlock { KHU_DAN_CU CO_QUAN TRUONG_HOC Y_TE DOANH_NGHIEP CONG_AN QUAN_SU KHAC }

model PartyOrg {
  id          String   @id @default(cuid())
  name        String
  type        PartyOrgType
  block       PartyBlock @default(KHU_DAN_CU)
  parentId    String?
  parent      PartyOrg?  @relation("PartyTree", fields: [parentId], references: [id])
  children    PartyOrg[] @relation("PartyTree")
  secretary   String?
  secretaryPhone String?
  deputySecretary String?
  memberCount Int        @default(0)
  officialMembers  Int?
  probationaryMembers Int?
  latestRating String?
  ratingYear   Int?
  residentialId String?
  schoolId     String?
  sortOrder   Int      @default(0)
  active      Boolean  @default(true)
  updatedById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// ===================== HỆ THỐNG =====================
model Notification {
  id        String   @id @default(cuid())
  userId    String
  kind      String   // TASK_ASSIGNED, DUE_SOON, OVERDUE, TASK_SUBMITTED, EXTENSION_REQUEST, NEW_DOCUMENT...
  title     String
  link      String
  readAt    DateTime?
  createdAt DateTime @default(now())
  @@index([userId, readAt])
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  action    String   // CREATE, UPDATE, DELETE, MOVE, LOGIN, EXPORT, DOWNLOAD...
  entity    String
  entityId  String?
  before    Json?
  after     Json?
  ip        String?
  createdAt DateTime @default(now())
  @@index([entity, entityId])
}

model Setting {
  key   String @id
  value Json
}
// Setting mặc định: dueSoonDays=3, maxTreeDepth=5, currentSchoolYear="2026-2027", maxUploadMB=20
```

> Ghi chú cho Claude Code: các trường `String[]` chứa id (coDepartmentIds...) dùng cho đơn giản; nếu cần truy vấn ngược nhiều, chuyển sang bảng nối. Thêm migration SQL thô: `CREATE EXTENSION IF NOT EXISTS unaccent; CREATE EXTENSION IF NOT EXISTS pg_trgm;` và index GIN trigram trên `DocumentNode.searchText`.

---

## 11. API (SERVER ACTIONS / ROUTE HANDLERS)

Ưu tiên Server Actions cho thao tác ghi từ form; Route Handlers cho tải tệp, xuất Excel, tìm kiếm, dữ liệu dashboard.

| Nhóm | Hành động |
|-----|----------|
| Auth | `login`, `logout`, `changePassword`, `resetPassword` (ADMIN) |
| Ward | `getWardProfile`, `updateWardProfile` |
| Tree | `getRoots()`, `getChildren(parentId)`, `getNode(id)`, `getBreadcrumb(id)`, `createNode(parentId?, data)`, `updateNode(id, data)`, `moveNode(id, newParentId, newIndex)`, `reorder(parentId, ids[])`, `softDeleteNode(id, cascade)`, `restoreNode(id)`, `searchNodes(q, filters)` |
| Files | `POST /api/files` (upload, kiểm tra MIME + kích thước), `GET /api/files/:id` (kiểm tra quyền, ghi log tải), `DELETE` |
| Tasks | `createTask`, `updateTask`, `postTaskUpdate`, `submitTask`, `approveTask`, `returnTask`, `requestExtension`, `decideExtension`, `listTasks(filters)`, `myWork()` |
| Reports | `createRequirement` (sinh kỳ), `updateRequirement` (sinh lại kỳ tương lai chưa nộp), `listPeriods(filters)`, `submitReport`, `unlockSubmission` |
| Catalog | CRUD `School`, `SchoolYearStat`, `Residential`, `PartyOrg`, `Department`, `DocumentType`, `Field`, `IssuingAgency`, `OldArea` |
| Import | `POST /api/import/{schools,residentials,party-orgs}` từ file Excel mẫu (kèm file mẫu tải về) |
| Dashboard | `GET /api/dashboard?schoolYear=` → trả toàn bộ số liệu Mục 7.3 trong **1 lần gọi** |
| Export | `GET /api/export/{tree/:rootId, tasks, reports, schools, residentials, party-orgs}` → .xlsx |
| Search | `GET /api/search?q=` toàn cục |
| Notifications | `list`, `markRead`, `markAllRead` |
| Admin | CRUD users, xem `AuditLog`, Thùng rác, `Setting` |

Mọi action: kiểm tra phiên + quyền (Mục 12) → validate `zod` → thực hiện → ghi `AuditLog` → `revalidatePath`.

---

## 12. PHÂN QUYỀN

| Chức năng | ADMIN | LEADER | CLERK | OFFICER | PARTY_ADMIN | VIEWER |
|-----------|:-----:|:------:|:-----:|:-------:|:-----------:|:------:|
| Xem dashboard đầy đủ | ✔ | ✔ | ✔ | rút gọn | ✔ | rút gọn |
| Xem văn bản | tất cả | tất cả | tất cả | đơn vị mình chủ trì/phối hợp + văn bản công khai nội bộ | tất cả | được chia sẻ |
| Tạo/sửa văn bản, dựng cây | ✔ | ✔ | ✔ | ✗ | văn bản lĩnh vực XD Đảng | ✗ |
| Xóa văn bản | ✔ | ✔ | do mình tạo | ✗ | do mình tạo | ✗ |
| Giao việc | ✔ | ✔ | ✔ | ✗ | ✔ | ✗ |
| Cập nhật tiến độ | ✔ | ✔ | ✔ | việc của mình/đơn vị | việc của mình | ✗ |
| Duyệt hoàn thành / gia hạn | ✔ | ✔ | người giao | ✗ | người giao | ✗ |
| Tạo yêu cầu báo cáo | ✔ | ✔ | ✔ | ✗ | ✔ | ✗ |
| Nộp báo cáo | ✔ | ✔ | ✔ | đơn vị mình | đơn vị mình | ✗ |
| Danh mục trường, TDP | ✔ | xem | ✔ | xem | xem | xem |
| Danh mục tổ chức đảng | ✔ | xem | xem | xem | ✔ | xem |
| Thông tin phường | ✔ | xem | xem | xem | xem | xem |
| Quản trị người dùng, cấu hình, nhật ký | ✔ | nhật ký | ✗ | ✗ | ✗ | ✗ |

`[CẦN XÁC NHẬN]` mức độ hiển thị văn bản cho OFFICER. Mặc định: thấy văn bản có đơn vị mình chủ trì/phối hợp hoặc có công việc giao cho mình; ngoài ra văn bản được đánh dấu "Công khai nội bộ".

Cài đặt quyền tập trung tại `src/lib/permissions.ts` với hàm `can(user, action, resource?)` — không rải điều kiện trong component.

---

## 13. YÊU CẦU PHI CHỨC NĂNG

### 13.1 Hiệu năng
- Dashboard tải < 2 giây với 10.000 văn bản, 5.000 công việc.
- Cây: tải lười (lazy) theo nhánh; mở 1 nhánh < 300ms.
- `progressCache` & `hasOverdueDescendant` cập nhật khi task/child thay đổi (và job đêm tính lại toàn bộ để tự sửa sai lệch).

### 13.2 Bảo mật
- Mật khẩu bcrypt (cost 12), bắt đổi mật khẩu lần đầu, tối thiểu 8 ký tự có chữ và số.
- Khóa tài khoản 15 phút sau 5 lần sai.
- Phiên hết hạn sau 8 giờ không hoạt động.
- HTTPS bắt buộc; cookie `httpOnly`, `secure`, `sameSite=lax`.
- Tệp tải lên: kiểm tra MIME thật (magic bytes), đổi tên lưu bằng id, không phục vụ trực tiếp thư mục upload — luôn qua route kiểm tra quyền.
- Sanitize HTML ở trường tóm tắt (DOMPurify / sanitize-html).
- Ghi `AuditLog` cho mọi thao tác ghi, đăng nhập, tải tệp, xuất dữ liệu.

### 13.3 Văn bản mật — quy định cứng
- Hiển thị cảnh báo trên form tải tệp: *"Không tải lên văn bản có độ mật (Mật, Tối mật, Tuyệt mật)."*
- Hệ thống **không có trường "độ mật"** để tránh hiểu nhầm là được phép lưu.
- Khuyến nghị triển khai trên mạng nội bộ/VPN của phường.

### 13.4 Sao lưu
- `pg_dump` hằng đêm 01:00, giữ 30 bản; sao lưu thư mục upload hằng đêm (rsync). Script trong `scripts/backup.sh`.
- Tài liệu hướng dẫn khôi phục trong `docs/khoi-phuc.md`.

### 13.5 Khác
- Múi giờ hiển thị & tính hạn: `Asia/Ho_Chi_Minh`. Lưu DB UTC.
- Trình duyệt hỗ trợ: Chrome, Edge, Cốc Cốc, Firefox bản mới; Safari iOS.
- In ấn: CSS `@media print` cho trang chi tiết văn bản, danh sách, dashboard.

---

## 14. LỘ TRÌNH TRIỂN KHAI & TIÊU CHÍ NGHIỆM THU

> Claude Code làm **tuần tự từng giai đoạn**. Hết mỗi giai đoạn: chạy `lint`, `typecheck`, `test`, cập nhật `CLAUDE.md` mục "Tiến độ", commit với thông điệp tiếng Việt.

### Giai đoạn 0 — Khởi tạo (nền móng)
- Tạo dự án Next.js + TS strict + Tailwind + shadcn/ui; ESLint, Prettier; Vitest; Playwright.
- docker-compose: postgres 16; `.env.example`.
- Prisma schema Mục 10 + migration extension `unaccent`, `pg_trgm`.
- Theme (màu, font Be Vietnam Pro, cỡ chữ) + layout Sidebar/Header/Breadcrumb + nút A−/A+.
- **Nghiệm thu**: `docker compose up` + `npm run dev` chạy được; trang trống có layout đầy đủ, tiếng Việt.

### Giai đoạn 1 — Đăng nhập, người dùng, danh mục
- Đăng nhập/đăng xuất/đổi mật khẩu; quản lý người dùng & đơn vị; `permissions.ts`.
- CRUD danh mục: Thông tin phường, Trường học + số liệu năm học, TDP, Tổ chức đảng (dạng cây), loại văn bản, lĩnh vực, cơ quan ban hành, khu vực cũ.
- Nhập từ Excel (kèm file mẫu) cho Trường, TDP, Tổ chức đảng. Xuất Excel các bảng.
- Seed Mục 15.
- **Nghiệm thu**: đăng nhập các vai trò khác nhau thấy menu khác nhau; nhập 1 file Excel 60 TDP thành công; báo lỗi dòng cụ thể nếu file sai.

### Giai đoạn 2 — Cây văn bản
- Trang `/van-ban` 2 cột; tạo chương trình; thêm/sửa/xóa mềm/khôi phục; kéo-thả di chuyển & sắp xếp; chặn > 5 cấp; breadcrumb; tìm không dấu; đính kèm & xem trước PDF; dạng danh sách; xuất Excel cây.
- Unit test `tree.ts`: tạo, di chuyển hợp lệ/không hợp lệ (vượt cấp, vào con cháu), cập nhật path con cháu.
- **Nghiệm thu**: tạo được cây đủ 5 cấp; nút thêm con ẩn ở cấp 5; kéo nhánh 3 cấp vào nút cấp 3 bị từ chối với thông báo rõ; tìm "quyet dinh thanh lap" ra "Quyết định thành lập…".

### Giai đoạn 3 — Công việc & Báo cáo
- Giao việc từ văn bản & độc lập; cập nhật tiến độ; báo hoàn thành/duyệt/trả lại; gia hạn.
- Yêu cầu báo cáo một lần/định kỳ; sinh kỳ; nộp báo cáo; tự tạo văn bản con.
- `status.ts`, `report-periods.ts` có unit test (biên: hạn hôm nay, quá 1 ngày, tháng 2, cuối quý, năm nhuận).
- Trang "Việc của tôi"; tiến độ cộng dồn lên cây; chấm đỏ nhánh quá hạn.
- **Nghiệm thu**: yêu cầu báo cáo hằng tháng ngày 20 từ 01/2026–12/2026 cho 3 đơn vị sinh đúng 36 kỳ; nộp ngày 21 hiển thị "Đã nộp trễ".

### Giai đoạn 4 — Dashboard
- `/api/dashboard` 1 lần gọi; 5 khối theo Mục 7; mọi con số bấm được; chọn năm học; chế độ Trình chiếu tự làm mới.
- **Nghiệm thu**: số trên thẻ khớp số đếm trong danh mục; bấm "Quá hạn" ra đúng danh sách; hiển thị đẹp ở 1920×1080, 1366×768 và điện thoại 390px.

### Giai đoạn 5 — Thông báo, tìm kiếm toàn cục, nhật ký, thùng rác
- Worker cron 06:30; chuông thông báo; `Ctrl+K`; trang nhật ký (lọc theo người/đối tượng/ngày); Thùng rác (khôi phục, xóa vĩnh viễn > 30 ngày bởi job).
- **Nghiệm thu**: việc còn 3 ngày → người chủ trì có thông báo sáng hôm đó.

### Giai đoạn 6 — Hoàn thiện & triển khai
- Tour hướng dẫn lần đầu; trạng thái rỗng; in ấn; kiểm thử e2e luồng: đăng nhập → tạo chương trình → thêm văn bản 3 cấp → giao việc → cán bộ cập nhật → lãnh đạo xem dashboard.
- Dockerfile production, docker-compose production (app, worker, db, caddy), script backup, `docs/huong-dan-su-dung.md` (có ảnh chụp), `docs/trien-khai.md`.

### Giai đoạn 7 (mở rộng, sau khi phường dùng thử)
- Bản đồ địa bàn (Leaflet + OpenStreetMap) hiển thị trường, ranh giới TDP.
- Gửi thông báo email/Zalo OA.
- Nhân bản cấu trúc chương trình năm trước.
- Báo cáo thống kê định kỳ tự động (xuất Word theo mẫu).
- Ứng dụng di động dạng PWA.

---

## 15. DỮ LIỆU MẪU (SEED)

> Số liệu địa bàn chi tiết dưới đây là **dữ liệu minh họa** để giao diện có nội dung khi phát triển. Thay bằng số liệu thật do phường cung cấp trước khi bàn giao (đánh dấu `isSample` trong seed hoặc tách file `seed-sample.ts` để dễ xóa).

**Thông tin phường**: diện tích 6,44; dân số 92.000 (ước tính); thành lập 01/07/2025.

**Override tổ chức đảng**: `partyOrgCountOverride = 63` (cho tới khi nhập đủ danh mục).

**Đơn vị**: Văn phòng Đảng ủy; Ban Xây dựng Đảng; Ủy ban Kiểm tra Đảng ủy; Ủy ban MTTQ phường; Văn phòng HĐND và UBND; Phòng Kinh tế, Hạ tầng và Đô thị; Phòng Văn hóa – Xã hội; Trung tâm Phục vụ hành chính công; Công an phường; Ban Chỉ huy Quân sự phường. `[CẦN XÁC NHẬN]` danh sách chính xác.

**Khu vực cũ**: Thanh Liệt, Tân Triều, Đại Kim, Hạ Đình, Thanh Xuân Bắc, Văn Quán, Tả Thanh Oai.

**Trường học (mẫu)**: Trường Mầm non Thanh Liệt; Trường Tiểu học Thanh Liệt; Trường THCS Thanh Liệt; + 5–7 trường mẫu đặt tên "Trường … (mẫu)" với số CB-GV-NV 40–120, học sinh 400–1.800, năm học 2025-2026 và 2026-2027.

**TDP (mẫu)**: "Tổ dân phố số 1" … "Tổ dân phố số 40", phân bổ vào các khu vực cũ, số hộ 250–600, nhân khẩu = hộ × 3–3,6 sao cho tổng ≈ 92.000.

**Tổ chức đảng (mẫu)**: gốc "Đảng bộ phường Thanh Liệt"; 63 tổ chức trực thuộc gồm chủ yếu chi bộ khu dân cư (gắn với TDP), một số chi bộ trường học, cơ quan, công an, quân sự; số đảng viên mỗi chi bộ 15–150.

**Người dùng mẫu** (mật khẩu `ThanhLiet@2026`, bắt đổi khi đăng nhập): `admin` (ADMIN), `bithu` (LEADER), `chutich` (LEADER), `vanthu` (CLERK), `canbo1`, `canbo2` (OFFICER), `xaydungdang` (PARTY_ADMIN).

**Cây văn bản mẫu**:
```
[CT] Chương trình công tác trọng tâm năm 2026
 ├─ [KH] 12/KH-UBND – Kế hoạch triển khai chuyển đổi số năm 2026
 │   ├─ [QĐ] 45/QĐ-UBND – Thành lập Tổ công tác chuyển đổi số
 │   │   ├─ [QC] Quy chế hoạt động của Tổ công tác
 │   │   │   └─ [BC] Báo cáo kết quả hoạt động quý I/2026
 │   │   └─ [PL] Danh sách thành viên Tổ công tác
 │   └─ [CV] 88/UBND-VP – Hướng dẫn số hóa hồ sơ TTHC   (có yêu cầu báo cáo hằng tháng ngày 20)
 └─ [KH] 20/KH-UBND – Kế hoạch xây dựng phường đạt chuẩn đô thị văn minh
[CT] Chương trình hành động thực hiện Nghị quyết Đại hội Đảng bộ phường lần thứ I, nhiệm kỳ 2025–2030
 └─ [NQ] Nghị quyết chuyên đề ... (mẫu)
```
Kèm ~25 công việc mẫu có đủ các trạng thái (quá hạn, sắp hạn, đang làm, xong, xong trễ) tính tương đối theo ngày chạy seed.

---

## 16. CÂU HỎI MỞ CẦN XÁC NHẬN VỚI PHƯỜNG

1. **Số tổ chức đảng**: phường cung cấp 63. Tại Đại hội lần thứ I (08/2025), báo chí đưa tin Đảng bộ có 82 tổ chức cơ sở đảng trực thuộc với khoảng 4.351 đảng viên. Con số 63 là số hiện tại sau kiện toàn, hay chỉ tính một loại (VD chỉ chi bộ khu dân cư)? → ảnh hưởng cách đếm trên dashboard.
2. "**Số lượng chi bộ ban xây dựng đảng**" nghĩa là: (a) tổng số chi bộ do Ban XD Đảng theo dõi, hay (b) chi bộ của chính cơ quan Ban XD Đảng, hay (c) số chi bộ theo từng khối? Mặc định: (a) + phân bố theo khối.
3. "**TDP — Số lượng**" là số hộ, số nhân khẩu hay cả hai? Mặc định: cả hai.
4. Trường học: có quản lý cả trường tư thục, trường THPT không? Quy mô học sinh lấy theo năm học nào?
5. Danh sách đơn vị/phòng ban chính xác và người dùng ban đầu (khoảng bao nhiêu tài khoản?).
6. Cán bộ (OFFICER) được xem văn bản ở phạm vi nào?
7. Hạn xử lý có tính trừ ngày nghỉ, ngày lễ không?
8. Có cần nhắc việc qua Zalo/email không? Phường có Zalo OA không?
9. Triển khai ở đâu: máy chủ nội bộ phường, hay hạ tầng của thành phố? Có yêu cầu tích hợp tài khoản/đăng nhập một lần không?
10. Có mẫu báo cáo/biểu mẫu Excel nào phường đang dùng để hệ thống xuất đúng mẫu?
11. Logo/biểu trưng muốn đặt trên header (VD Quốc huy, logo Đảng — lưu ý quy định sử dụng)?

---

## 17. HƯỚNG DẪN RIÊNG CHO CLAUDE CODE

1. **Tạo `CLAUDE.md`** ở gốc repo, tóm tắt: stack, lệnh chạy, quy ước, và mục "Tiến độ" (checklist các giai đoạn Mục 14). Cập nhật sau mỗi giai đoạn.
2. **Ngôn ngữ**: code (biến, hàm, bảng) bằng tiếng Anh; **mọi chữ hiển thị cho người dùng bằng tiếng Việt có dấu**, gom trong `src/lib/i18n/vi.ts` để dễ sửa câu chữ.
3. **Đường dẫn URL tiếng Việt không dấu** (`/van-ban`, `/viec-cua-toi`) như Mục 9.2.
4. **Không hard-code số liệu địa bàn** trong component; luôn đọc từ DB.
5. Logic nghiệp vụ quan trọng (trạng thái hạn, cây, sinh kỳ báo cáo, tiến độ cộng dồn, phân quyền) đặt trong `src/lib/*` dạng hàm thuần, **có unit test trước khi dùng trong UI**.
6. Mọi thao tác ghi đi qua 1 hàm bọc: `withAuth(action, permission)` → `zod.parse` → transaction → `audit()` → `revalidatePath`.
7. Xử lý lỗi thân thiện: không bao giờ hiện stack trace cho người dùng; hiện câu tiếng Việt + mã lỗi ngắn để hỗ trợ.
8. Trước khi kết thúc mỗi giai đoạn, tự kiểm tra giao diện ở 3 kích thước màn hình (1920, 1366, 390) và chế độ chữ A+ để chắc không vỡ bố cục.
9. Khi gặp điểm `[CẦN XÁC NHẬN]`: làm theo mặc định, ghi lại vào `docs/cau-hoi-mo.md`, không dừng công việc.
10. Gợi ý câu lệnh khởi động cho Claude Code:
    > "Đọc file `he-thong-theo-doi-van-ban-phuong-thanh-liet.md`. Tạo `CLAUDE.md` và kế hoạch chi tiết cho Giai đoạn 0. Sau khi tôi đồng ý, triển khai Giai đoạn 0, chạy kiểm tra, rồi báo lại."
    Sau đó lần lượt: *"Triển khai Giai đoạn 1 theo đặc tả"*, *"Giai đoạn 2"*…

---
*Phiên bản tài liệu: 1.0 — 20/10/2026.*
