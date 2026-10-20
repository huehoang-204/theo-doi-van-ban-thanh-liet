# Câu hỏi mở & phương án mặc định đang áp dụng

Theo Mục 17.9 đặc tả: gặp điểm `[CẦN XÁC NHẬN]` thì làm theo mặc định, ghi lại ở đây, không dừng công việc.
Cột "Trạng thái": **Mặc định** = đang làm theo phương án tạm; **Đã chốt** = phường/người phụ trách đã xác nhận.

## A. Câu hỏi cần phường trả lời (Mục 16 đặc tả)

| #     | Câu hỏi                                                                                        | Phương án mặc định                                                                                                 | Ảnh hưởng                              | Trạng thái |
| ----- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------- | ---------- |
| 16.1  | Số tổ chức đảng **63** là số nào? (Báo chí Đại hội I: 82 tổ chức cơ sở đảng, ~4.351 đảng viên) | Dùng override `partyOrgCountOverride = 63`; khi đủ danh mục thì đếm mọi tổ chức trừ Đảng bộ phường                 | Thẻ "Tổ chức đảng" trên bảng điều hành | Mặc định   |
| 16.2  | "Số lượng chi bộ Ban XD Đảng" nghĩa là gì?                                                     | Tổng số chi bộ (cơ sở + trực thuộc) + phân bố theo khối                                                            | Thẻ "Chi bộ", khối ④                   | Mặc định   |
| 16.3  | "TDP — Số lượng" là số hộ hay nhân khẩu?                                                       | Lưu cả hai                                                                                                         | Danh mục TDP                           | Mặc định   |
| 16.4  | Có quản lý trường tư thục, THPT không? Quy mô HS theo năm học nào?                             | Có (lọc theo loại hình/cấp học); năm học hiện tại = Setting `currentSchoolYear` (2026-2027)                        | Danh mục trường, thẻ "Học sinh"        | Mặc định   |
| 16.5  | Danh sách đơn vị/phòng ban chính xác, số tài khoản ban đầu                                     | Dùng danh sách Mục 15                                                                                              | Seed, phân quyền                       | Mặc định   |
| 16.6  | OFFICER được xem văn bản phạm vi nào?                                                          | Văn bản đơn vị mình chủ trì/phối hợp, có việc giao cho mình, hoặc đánh dấu "Công khai nội bộ" (`isInternalPublic`) | `permissions.ts` (GĐ1–2)               | Mặc định   |
| 16.7  | Hạn có trừ ngày nghỉ/lễ không?                                                                 | Không trừ; tính theo ngày dương lịch, giờ VN                                                                       | `status.ts` (GĐ3)                      | Mặc định   |
| 16.8  | Nhắc việc qua Zalo/email? Phường có Zalo OA?                                                   | Chỉ thông báo trong ứng dụng                                                                                       | GĐ5, GĐ7                               | Mặc định   |
| 16.9  | Triển khai ở đâu? Có SSO không?                                                                | Máy chủ nội bộ, tài khoản riêng của hệ thống                                                                       | GĐ6                                    | Mặc định   |
| 16.10 | Mẫu báo cáo/biểu mẫu Excel đang dùng?                                                          | Xuất Excel dạng bảng chuẩn                                                                                         | Xuất Excel                             | Mặc định   |
| 16.11 | Logo/biểu trưng trên header?                                                                   | Ô chữ "TL" nền đỏ (tạm)                                                                                            | Header, trang đăng nhập                | Mặc định   |
| 6.1   | Số hộ toàn phường; địa chỉ, điện thoại trụ sở                                                  | Để trống, ADMIN nhập sau                                                                                           | Thông tin phường                       | Mặc định   |

## B. Quyết định kỹ thuật (đã chốt với người phụ trách, 20/10/2026)

| Nội dung          | Quyết định                                                                                                                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phiên bản Next.js | **16** (đặc tả ghi 15)                                                                                                                                                                                   |
| Sửa schema Mục 10 | Đồng ý: relation cho mọi khoá ngoại đơn; `@db.Date` cho trường chỉ có ngày; `isInternalPublic`; `DocumentShare`, `DocumentFollow`; `failedLoginCount`/`lockedUntil`; `Notification.dedupKey`; `isSample` |
| CSDL dev          | PostgreSQL 14 userspace trên máy A30 (không Docker); production PostgreSQL 16                                                                                                                            |
| shadcn/ui         | Style `radix-nova` (Radix, đúng Mục 8.3) — không dùng style mặc định `base-nova` (Base UI)                                                                                                               |

## C. Đề xuất nghiệp vụ — sẽ quyết ở Giai đoạn 2–3

| #   | Vấn đề                                                                                          | Đề xuất                                                                         |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| D1  | "Tối đa 24 kỳ" (Mục 5.1) mâu thuẫn nghiệm thu GĐ3 cần 36 kỳ (12 tháng × 3 đơn vị)               | Giới hạn 24 kỳ **cho mỗi đơn vị**                                               |
| D2  | Tiến độ cộng dồn tính nút không có việc (Quy chế, Phụ lục) là 0% → nhánh không bao giờ đạt 100% | Bỏ nút không có việc trong cả cây con khỏi phép trung bình; bỏ việc `CANCELLED` |
| D3  | Mốc "hoàn thành" của công việc: lúc báo hoàn thành hay lúc duyệt?                               | `completedAt` = lần báo hoàn thành cuối cùng được duyệt                         |
| D4  | Báo cáo định kỳ tự thêm thành văn bản con → hàng chục nút/năm                                   | Gom dưới một nút "Báo cáo" hoặc thêm tuỳ chọn tắt                               |
| —   | Báo cáo hằng tháng hạn ngày 29–31 rơi vào tháng thiếu ngày                                      | Lấy ngày cuối tháng                                                             |
| —   | Danh mục (trường, TDP…) xoá cứng hay mềm?                                                       | Dùng cờ `active` thay cho xoá                                                   |

## D. Ghi nhận khi làm Giai đoạn 1

| Nội dung                                                                                                           | Cách xử lý hiện tại                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mục 15: TDP “số hộ 250–600, nhân khẩu = hộ × 3–3,6, tổng ≈ 92.000” không thoả đồng thời với 40 TDP (tối đa 86.400) | Seed mẫu ưu tiên tổng ≈ 92.000 và tỉ lệ hộ/nhân khẩu → số hộ mỗi TDP ~560–850                                                                          |
| Mục 15 không có tài khoản VIEWER mẫu                                                                               | Thêm `totruong1` (VIEWER, Tổ trưởng TDP) để kiểm thử vai trò Chỉ xem                                                                                   |
| Tên người dùng/trường/tổ chức mẫu                                                                                  | Gắn hậu tố “(mẫu)” để không nhầm với người/đơn vị thật; 3 trường Mầm non/Tiểu học/THCS Thanh Liệt dùng tên thật nhưng số liệu là minh hoạ (`isSample`) |
| Loại văn bản “Chương trình” và “Chỉ thị” cùng viết tắt CT                                                          | Theo NĐ 30/2020: Chương trình = `CTr`, Chỉ thị = `CT`, Quy định = `QyD`, Tờ trình = `TTr`                                                              |
| “Tổng số tổ chức đảng trực thuộc”                                                                                  | Đếm mọi tổ chức trừ Đảng bộ phường (kể cả chi bộ thuộc đảng bộ bộ phận) — liên quan câu 16.1                                                           |
| Danh mục Loại văn bản, Lĩnh vực, Cơ quan, Khu vực cũ, Đơn vị                                                       | Chỉ ADMIN sửa (Mục 12 “cấu hình”); cơ quan ban hành ngoài danh mục vẫn nhập tự do được ở văn bản (GĐ2)                                                 |
| PARTY_ADMIN nhập số liệu tổng hợp thủ công                                                                         | Cho phép (Mục 6.4) dù Thông tin phường chỉ ADMIN sửa                                                                                                   |
