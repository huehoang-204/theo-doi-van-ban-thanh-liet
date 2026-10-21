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

## C. Đề xuất nghiệp vụ — đã áp dụng phương án mặc định ở Giai đoạn 3 (chờ phường xác nhận)

| #   | Vấn đề                                                                                          | Đề xuất                                                                                      |
| --- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| D1  | "Tối đa 24 kỳ" (Mục 5.1) mâu thuẫn nghiệm thu GĐ3 cần 36 kỳ (12 tháng × 3 đơn vị)               | **Đã áp dụng**: 24 kỳ cho mỗi đơn vị mỗi lần sinh; job hằng ngày sinh tiếp                   |
| D2  | Tiến độ cộng dồn tính nút không có việc (Quy chế, Phụ lục) là 0% → nhánh không bao giờ đạt 100% | **Đã áp dụng**: bỏ nhánh không có việc và việc đã huỷ; việc đã duyệt = 100%                  |
| D3  | Mốc "hoàn thành" của công việc: lúc báo hoàn thành hay lúc duyệt?                               | **Đã áp dụng**: hoàn thành tính tại lúc báo hoàn thành (lần được duyệt); trả lại thì xoá mốc |
| D4  | Báo cáo định kỳ tự thêm thành văn bản con → hàng chục nút/năm                                   | **Đã áp dụng**: tự tạo văn bản con theo đặc tả, có ô tắt "Tự thêm…" cho từng yêu cầu         |
| —   | Báo cáo hằng tháng hạn ngày 29–31 rơi vào tháng thiếu ngày                                      | Lấy ngày cuối tháng                                                                          |
| —   | Danh mục (trường, TDP…) xoá cứng hay mềm?                                                       | Dùng cờ `active` thay cho xoá                                                                |

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

## E. Ghi nhận khi làm Giai đoạn 2

| Nội dung                                                                                         | Cách xử lý hiện tại                                                                                                                        |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Tìm kiếm: "quyet dinh thanh lap" phải ra văn bản có trích yếu "Thành lập…" thuộc loại Quyết định | Tìm theo **từng từ** (mọi từ phải có, không cần liền nhau) trên số ký hiệu + **tên loại** + trích yếu + tóm tắt + người ký + cơ quan + thẻ |
| Cấp 2–5 "chọn bất kỳ loại" — có gồm cả loại Chương trình không?                                  | Có (chương trình con). Chỉ loại Chương trình mới được đưa lên cấp 1                                                                        |
| Ngày ban hành bắt buộc cả với chương trình nội bộ (Mục 4.3 đánh dấu bắt buộc)                    | Bắt buộc; form điền sẵn ngày hôm nay                                                                                                       |
| OFFICER thấy văn bản theo phạm vi, nhưng cây cần đủ đường đi                                     | Tổ tiên của văn bản được xem vẫn hiện trên cây (biểu tượng khoá, không mở được chi tiết)                                                   |
| Văn bản cấp 1–2 trong dữ liệu mẫu                                                                | Đánh dấu "Công khai nội bộ" để cán bộ thấy khung chương trình                                                                              |
| Kéo-thả khi đang sắp theo ngày ban hành                                                          | Chỉ cho chuyển sang cha khác; sắp xếp thủ công phải chuyển về "Thứ tự thủ công"                                                            |
| Thùng rác                                                                                        | Tạm đặt trong "Dạng danh sách › Đã xoá" (khôi phục được); trang Thùng rác chung + xoá vĩnh viễn sau 30 ngày ở GĐ5                          |

## F. Ghi nhận khi làm Giai đoạn 3

| Nội dung                                                               | Cách xử lý hiện tại                                                                                                     |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Việc đã báo hoàn thành nhưng người giao chưa duyệt, có tính "quá hạn"? | Không — xét theo lúc báo hoàn thành; hiển thị "Chờ duyệt hoàn thành"                                                    |
| Trả lại công việc                                                      | Về "Đang thực hiện", tiến độ về mức của lần cập nhật gần nhất (tối đa 90%)                                              |
| Ai duyệt gia hạn ("gửi lãnh đạo")                                      | Người giao việc (và LEADER/ADMIN) — theo quyền "Duyệt hoàn thành / gia hạn" Mục 12                                      |
| Giao việc chỉ cho đơn vị (không chọn cá nhân)                          | Thông báo gửi mọi tài khoản của đơn vị đó                                                                               |
| Danh sách công việc của OFFICER / PARTY_ADMIN                          | OFFICER: việc mình/đơn vị mình chủ trì/phối hợp + việc mình giao; PARTY_ADMIN: việc mình + việc mình giao               |
| "Việc của tôi" hiện kỳ báo cáo nào                                     | Kỳ chưa nộp của đơn vị mình, quá hạn hoặc hạn trong 45 ngày tới                                                         |
| Ngày gửi báo cáo                                                       | Không được sau hôm nay; nộp sau hạn → "Đã nộp trễ"                                                                      |
| Sửa yêu cầu báo cáo                                                    | Kỳ đã nộp/đã quá hạn giữ nguyên; kỳ tương lai chưa nộp sinh lại theo quy tắc mới; đơn vị bị bỏ → xoá kỳ chưa nộp của họ |

## G. Ghi nhận khi làm Giai đoạn 4

| Nội dung                                                        | Cách xử lý hiện tại                                                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Biểu đồ "Chi bộ theo khối", "Trường theo cấp" (Mục 7.2 vẽ tròn) | Dùng **thanh ngang một màu** có số ở cuối thanh: dễ so sánh, đọc được tên dài, đúng yêu cầu "không màu mè". Đổi lại biểu đồ tròn nếu phường muốn |
| "Nhân khẩu theo khu vực cũ" (Mục 7.2 vẽ cột đứng)               | Thanh ngang (tên khu vực dài, không phải xoay chữ)                                                                                               |
| Thẻ "Tình hình thực hiện nhiệm vụ"                              | Quá hạn / Sắp đến hạn / Đang làm (chưa đến hạn + không hạn) / Đã hoàn thành. Việc chờ duyệt và việc huỷ không vào thẻ nào                        |
| Phạm vi số liệu công việc trên bảng điều hành                   | Theo phạm vi xem công việc của người đang xem (LEADER/CLERK/ADMIN: toàn phường)                                                                  |
| Khối ① "rút gọn" cho OFFICER (Mục 7.5)                          | 4 thẻ đầu (Diện tích, Dân số, TDP, Tổ chức đảng) + khối "Việc của tôi"; không có khối ②, không có nút Trình chiếu                                |
| VIEWER                                                          | Khối ① đầy đủ + 3 khối lĩnh vực; không có khối ② (công việc nội bộ)                                                                              |
| "Báo cáo cần nộp trong 14 ngày"                                 | Gồm cả kỳ đã quá hạn chưa nộp (quá hạn lên đầu), hiện 8 dòng + "Xem tất cả" → `/bao-cao?trongNgay=14`                                            |
| Mốc "Cập nhật ngày …" trên thẻ                                  | Ngày sửa gần nhất của bản ghi nguồn (Thông tin phường / TDP / tổ chức đảng / số liệu năm học)                                                    |

## H. Ghi nhận khi làm Giai đoạn 5

| Nội dung                          | Cách xử lý hiện tại                                                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Ai nhận nhắc hạn công việc        | Người chủ trì; nếu chỉ giao đơn vị thì mọi tài khoản đang hoạt động của đơn vị chủ trì. Người phối hợp không nhận nhắc hạn              |
| Báo quá hạn cho người giao việc   | Chỉ ngày quá hạn đầu tiên (tránh dồn thông báo cho lãnh đạo); người chủ trì nhận mỗi ngày, tối đa 7 ngày                                |
| Nhắc kỳ báo cáo                   | Mọi tài khoản của đơn vị phải nộp (3 ngày, 1 ngày, quá hạn ≤ 7 ngày); người theo dõi yêu cầu nhận một lần khi quá hạn                   |
| Mốc nhắc cố định 3 ngày và 1 ngày | Theo Mục 5.4 — không theo cấu hình "Sắp đến hạn" (`dueSoonDays`). Gia hạn → nhắc lại theo hạn mới                                       |
| Worker tắt đúng giờ 06:30         | Khởi động lại trong ngày → chạy bù; ngày bị bỏ lỡ hoàn toàn thì mốc "còn 3 ngày" của ngày đó không gửi bù                               |
| Việc chờ duyệt hoàn thành         | Không nhắc hạn (người làm đã báo hoàn thành)                                                                                            |
| Job đêm                           | 00:15 giờ VN: tính lại tiến độ & chấm đỏ, xoá vĩnh viễn mục ở Thùng rác quá 30 ngày, xoá thông báo **đã đọc** quá 90 ngày               |
| Xoá vĩnh viễn văn bản             | Xoá cả nhánh, tệp đính kèm, yêu cầu báo cáo cùng kỳ & bản nộp của nhánh; **công việc giữ lại**, bỏ liên kết văn bản                     |
| Ai vào Thùng rác (quản trị)       | Chỉ ADMIN (Mục 12). LEADER/CLERK vẫn khôi phục văn bản mình được xoá ở Văn bản › Dạng danh sách › Đã xoá                                |
| "Chương trình mình theo dõi"      | Nút "Theo dõi chương trình" trên văn bản cấp 1; không tự động theo dõi. Chỉ người có quyền xem văn bản mới được báo                     |
| Tìm kiếm Ctrl+K                   | 5 nhóm (văn bản, công việc, trường, TDP, tổ chức đảng), 6 kết quả/nhóm, theo phạm vi xem của từng người; VIEWER không có nhóm công việc |
| Nhật ký                           | Không sửa/xoá được trên giao diện; xuất Excel tối đa 10.000 dòng theo bộ lọc                                                            |

## I. Giai đoạn 5b — Ban hành văn bản, xem trước Word/Excel, thảo luận (bổ sung 21/10/2026)

Người phụ trách yêu cầu bổ sung theo mẫu hệ thống văn bản điều hành (ảnh iOffice Trường ĐH Đại Nam), chấp nhận lệch Mục 1.4 ("không thay iOffice"). Đã chốt: làm cả 4 phần; người nhận = đơn vị + cá nhân (+ Toàn phường); người nhận được xem và tải tệp; làm trước GĐ6.

| Nội dung                       | Cách xử lý hiện tại                                                                                                                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ai được ban hành / gửi         | Người được sửa văn bản (ADMIN, LEADER, CLERK; PARTY_ADMIN với văn bản lĩnh vực XD Đảng)                                                                                                            |
| Gửi theo đơn vị                | Mọi tài khoản đang hoạt động của đơn vị **tại thời điểm gửi**; người vào đơn vị sau không tự nhận (gửi bổ sung để thêm)                                                                            |
| Gửi lần nữa                    | "Gửi bổ sung": chỉ người nhận mới được thông báo; giữ mốc ban hành và người ban hành lần đầu                                                                                                       |
| Thu hồi người nhận             | Chưa có (cần thì làm sau)                                                                                                                                                                          |
| Tên đơn vị gửi trong thông báo | Đơn vị của người ban hành (không có đơn vị → họ tên)                                                                                                                                               |
| Xem trước Word/Excel           | `.docx`, `.xlsx` dựng ngay trên trình duyệt (bố cục có thể khác bản in một chút); `.doc`, `.xls` đời cũ chỉ tải về. Muốn xem trước chính xác cần LibreOffice trên máy chủ (cài cần quyền quản trị) |
| "Đã xem"                       | Ai mở trang chi tiết văn bản (kể cả người không phải người nhận)                                                                                                                                   |
| "Đã tải tệp đính kèm"          | Ai bấm "Tải về" (xem trước không tính)                                                                                                                                                             |
| Thảo luận                      | Người xem được văn bản đều viết được; chỉ người viết (hoặc ADMIN) xoá; xoá là ẩn, vẫn lưu nhật ký                                                                                                  |
| Theo dõi                       | Theo dõi văn bản bất kỳ cấp nào; người ban hành và người viết thảo luận tự theo dõi                                                                                                                |

## K. Bố cục trang Văn bản (người dùng chốt 21/10/2026)

| Nội dung                                          | Cách xử lý hiện tại                                                                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mục 4.5 vẽ bố cục 2 cột (cây trái, chi tiết phải) | **Bỏ 2 cột** theo yêu cầu: trang Văn bản chỉ có cây chiếm cả chiều rộng; bấm văn bản mở trang chi tiết riêng, có nút "← Cây văn bản" (các nhánh đang mở được giữ nguyên khi quay lại) |
| Thêm văn bản                                      | Từ trang cây: ở lại trang cây, văn bản mới hiện trong nhánh; từ trang chi tiết ("Văn bản con"): chuyển sang văn bản mới                                                               |
