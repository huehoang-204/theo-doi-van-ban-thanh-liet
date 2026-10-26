# CLAUDE.md — Hệ thống theo dõi văn bản, báo cáo & công việc — Phường Thanh Liệt

Đặc tả gốc (nguồn sự thật duy nhất): [he-thong-theo-doi-van-ban-phuong-thanh-liet.md](he-thong-theo-doi-van-ban-phuong-thanh-liet.md).
Khi file này và đặc tả lệch nhau → theo đặc tả, rồi sửa file này. Các điểm `[CẦN XÁC NHẬN]` làm theo mặc định và ghi vào `docs/cau-hoi-mo.md`.

## 1. Mục tiêu hệ thống

Công cụ **theo dõi – tổng hợp nội bộ** của phường (không thay iOffice, không ký số, **không lưu văn bản mật**):

1. Lưu & tra cứu văn bản theo **cây tối đa 5 cấp** (cấp 1 luôn là "Chương trình").
2. **Theo dõi hạn**: yêu cầu báo cáo (một lần/định kỳ → sinh kỳ báo cáo) và công việc giao từ văn bản → cảnh báo sắp đến hạn/quá hạn.
3. **Bảng điều hành** cho lãnh đạo: số liệu địa bàn (diện tích, dân số, TDP, tổ chức đảng, chi bộ, đảng viên, trường, học sinh) + tình hình thực hiện nhiệm vụ. Con số nào cũng bấm được.
4. **Dễ dùng cho cán bộ 30–60 tuổi**: 100% tiếng Việt, chữ to (16px gốc, nút A−/A+), ít bước.

Vai trò: `ADMIN`, `LEADER`, `CLERK`, `OFFICER`, `PARTY_ADMIN`, `VIEWER` (một người nhiều vai trò, thuộc một `Department`). Ma trận quyền: Mục 12 đặc tả.

## 2. Stack công nghệ

| Lớp             | Công nghệ                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js 16 (App Router, Turbopack) + React 19 + TypeScript 6 strict                                                  |
| UI              | Tailwind CSS v4, shadcn/ui style `radix-nova` (Radix), lucide-react, recharts, @tanstack/react-table, @dnd-kit       |
| Form / validate | react-hook-form + zod 4 (`@hookform/resolvers` 5.x — bản 6 xung đột peer)                                            |
| Ngày, số        | date-fns + locale `vi`, `Intl.NumberFormat('vi-VN')`, múi giờ `Asia/Ho_Chi_Minh` (DB lưu UTC)                        |
| ORM / CSDL      | Prisma 7.10 (generator `prisma-client`, adapter `@prisma/adapter-pg`) + PostgreSQL (extension `unaccent`, `pg_trgm`) |
| Xác thực        | Auth.js (NextAuth 5.0.0-beta.32) Credentials, phiên JWT 8h trượt + bcryptjs cost 12                                  |
| Tệp             | `StorageService` lưu ổ cục bộ (`UPLOAD_DIR`), phục vụ qua route có kiểm tra quyền                                    |
| Job             | `node-cron` trong tiến trình worker riêng (`npm run worker`)                                                         |
| Nhập/xuất Excel | exceljs 4.4                                                                                                          |
| Kiểm thử        | Vitest 4.1 (unit), Playwright (e2e, 3 kích thước 1920/1366/390)                                                      |
| Đóng gói        | docker-compose (postgres 16) cho máy có Docker; máy dev A30 dùng PostgreSQL userspace                                |

Phiên bản pin chính xác trong `package.json` (`.npmrc` có `save-exact=true`). Lý do các mốc phiên bản:

- **Vitest 4.1, jsdom 27, @types/node 20**: máy dev chạy Node 20.20 (Vitest 5 / jsdom 28 đòi Node 22).
- **TypeScript 6.0**: TS 7 chưa được typescript-eslint hỗ trợ. **ESLint 9**: eslint-config-next chưa ổn với 10.
- **Prisma 7.10.1**: tag `latest` trên npm đang là 8.0 RC.
- **@tanstack/react-table 8.21**: bản 9 đổi API hoàn toàn (v8 chỉ còn dạng `useLegacyTable`).

### Ghi chú kỹ thuật quan trọng

- **Prisma 7**: URL CSDL ở `prisma.config.ts` (không còn trong `schema.prisma`); client sinh vào `src/generated/prisma` (không commit) — import từ `@/generated/prisma/client`, enum từ `@/generated/prisma/enums`. Trong app dùng `db` từ `@/lib/db` (có `server-only`); script ngoài Next (seed, worker) tự tạo `PrismaClient` với `PrismaPg`.
- **Trường chỉ có ngày** (`@db.Date`: hạn, ngày ban hành…) → Prisma trả Date 00:00 UTC; luôn đọc/ghi bằng helper trong `src/lib/format.ts` (`formatDate`, `dateOnlyKey`, `daysUntil`), không tự `new Date()` theo giờ máy.
- **Tìm không dấu**: cột `searchText` tính ở app bằng `buildSearchText()` (`src/lib/text.ts`, xử lý cả `đ/Đ`), index GIN trigram; index `path` dùng `text_pattern_ops` cho `LIKE '/a/b/%'`.
- **Typed routes** bật (`typedRoutes: true`): `href` phải là route có thật; `npm run typecheck` chạy `next typegen` trước `tsc`.
- **Hằng số dùng chung server/client** (tên cookie…) đặt ở `src/lib/*`, không export từ file `"use client"`.
- **Cỡ chữ A−/A+**: cookie `font-scale` (100/112/125) → biến CSS `--font-scale` trên `<html>`; mọi kích thước dùng `rem` nên co giãn theo. Lưu thêm vào `User.fontScale`; đăng nhập thì đặt cookie theo tài khoản.
- **Xác thực** (GĐ1):
  - `src/auth.config.ts` (dùng chung, không import Prisma) + `src/auth.ts` (Credentials) + `src/proxy.ts` (Next 16 — phải `export async function proxy` tường minh, export kiểu destructuring không được nhận).
  - `getCurrentUser()` đọc lại user từ DB mỗi request (React `cache`) → khoá/đổi vai trò có hiệu lực ngay. Trang dùng `requireUser()` / `requirePermission(action)`; Route Handler dùng `apiUser(action)` (`src/server/auth/api.ts`).
  - Khoá 15 phút sau 5 lần sai, bắt đổi mật khẩu lần đầu: logic thuần ở `src/lib/password.ts`, ghi DB ở `src/server/auth/login.ts`. Đăng nhập sai trả mã `CredentialsSignin.code` ("invalid" | "locked").
  - Proxy bỏ qua `/api/*` (API tự kiểm tra phiên; tránh proxy đệm body tệp tải lên — lưu ý khi làm upload 20MB ở GĐ2).
- **Phân quyền**: `can(user, action, resource?)` trong `src/lib/permissions.ts` theo đúng bảng Mục 12 (một người nhiều vai trò = hợp quyền). Gọi không kèm `resource` = "có làm được với ít nhất một đối tượng" (để hiện menu/nút). Menu gắn `permission` trong `src/lib/nav.ts`; server tính `allowedNavHrefs(user)` rồi truyền chuỗi xuống client.
- **Ghi dữ liệu**: mọi server action dùng `withAuth({ permission, schema, revalidate }, handler)` ở `src/server/action.ts` — trả `ActionResult` (không ném lỗi ra client), lỗi Prisma P2002/P2003/P2025 → câu tiếng Việt, lỗi khác → mã hỗ trợ `E…` + log server. Handler gọi `ctx.audit({...})`, nhật ký ghi trong cùng transaction. Quyền theo đối tượng: truyền hàm `permission(user, input, tx)`.
- **Schema zod dùng chung client/server** ở `src/lib/schemas/*`; helper `src/lib/schemas/common.ts` đổi "" → null, đọc số kiểu Việt (`92.000`, `6,44`), ngày `dd/mm/yyyy`. Nhãn enum tiếng Việt ở `src/lib/i18n/enums.ts`.
- **Form & bảng dùng chung**: `EntityForm`/`EntityFormDialog` (form theo cấu hình, kiểm tra khi rời ô), `DataTable` (sticky header, sort, tìm không dấu, phân trang 20/50/100, < 768px thành thẻ), `CrudTable` (DataTable + thêm/sửa/xoá + nhập/xuất Excel), `ConfirmDialog`, `ImportDialog`. Ô `disabled` trong react-hook-form gửi `undefined` → điền lại giá trị gốc khi lưu.
- **Excel**: đặc tả cột nhập ở `src/lib/excel/import-specs.ts`, đọc + báo lỗi theo dòng ở `src/lib/excel/parse.ts` (thuần, có test); ghi DB `src/server/excel/importers.ts` — **tất cả hoặc không** (có lỗi → rollback, trả danh sách "Dòng N – Cột: …"). Khoá khớp theo tên (không dấu). API: `GET /api/export/{kind}`, `GET /api/import/{kind}/mau`, `POST /api/import/{kind}`.
- **Tổ chức đảng**: quy tắc cấp trên + số liệu tự đếm (đảng viên cộng ở tổ chức lá) ở `src/lib/party.ts`; override thủ công nằm ở `WardProfile.party*Override`.
- **Seed**: `prisma/seed.ts` = dữ liệu lõi (an toàn production, không ghi đè chỉnh sửa, admin chỉ tạo nếu chưa có — mật khẩu `SEED_ADMIN_PASSWORD` hoặc mặc định); `prisma/seed-sample.ts` = dữ liệu minh hoạ `isSample=true` (bỏ qua bằng `SEED_SAMPLE=0`), xoá bằng `npm run db:clear-sample`. Từ 22/10/2026 có lịch sử 6 tháng cho biểu đồ (~70 việc rải theo ngày chạy seed, 3 yêu cầu báo cáo, 6 văn bản ban hành, thảo luận). Seed mẫu bỏ qua nếu đã có người dùng mẫu → muốn nạp lại: `npm run db:clear-sample && npm run db:seed`. KHÔNG gắn yêu cầu báo cáo mẫu vào 20/KH-UBND (e2e GĐ3 kiểm "36 kỳ" trên văn bản đó).
- **E2E** chạy trên CSDL riêng `<db>_e2e` + dev server riêng cổng 3251, thư mục build `.next-e2e` (`NEXT_DIST_DIR`); `tests/e2e/global-setup.ts` migrate + seed + đặt lại tài khoản thử (mật khẩu `ThanhLiet@2026`). Không đụng dữ liệu dev. Khi viết test form dùng `getByRole("textbox", { name })` (nhãn có dấu `*`), chờ nút gửi bật lại trước khi điền tiếp (React đặt lại form sau action).
- **Cây văn bản** (GĐ2):
  - Logic thuần ở `src/lib/tree.ts` (vị trí nút, kiểm tra tạo/di chuyển, `planMove` tính path/depth/rootId cả cây con, `planReorder`, vùng thả kéo-thả). Ghi DB ở `src/server/actions/documents.ts`: khoá `FOR UPDATE` cả nhánh, áp `planMove` bằng MỘT câu `UPDATE … FROM unnest(...)` trong transaction; con cháu đã xoá mềm đi cùng nhánh.
  - Xoá mềm cả nhánh dùng chung một `deletedAt` → khôi phục đúng những nút xoá cùng lúc; khôi phục con khi cha còn trong thùng rác bị chặn.
  - Tìm kiếm: cột `searchText` do **trigger CSDL** tính `lower(unaccent(số + tên loại + trích yếu + tóm tắt + người ký + cơ quan + thẻ))` (migration `document_search_trigger`) — KHÔNG tự gán `searchText` trong code. Truy vấn: mọi từ đều phải có (`LIKE ALL`, từ khoá cũng qua `unaccent`), xếp hạng `word_similarity` (pg_trgm). `src/lib/search.ts` tách từ + thoát ký tự LIKE.
  - Phạm vi xem: `canViewAllDocuments(user)`; OFFICER/VIEWER qua `documentScope()` — văn bản xem được + tổ tiên (hiện trên cây, đánh dấu `restricted`, không xem chi tiết).
  - API cây: `GET /api/documents/tree?cha= | mo=<id,…> | tatCa=1 | demNhanh=<id>`, `GET /api/documents/search?q=&linhVuc=&hieuLuc=&mo=1`. Trạng thái cây phía client trong `TreeContext` (layout `/van-ban` giữ nguyên khi chuyển văn bản → không mất nhánh đang mở).
  - **Bố cục (người dùng chốt 21/10/2026, thay 2 cột Mục 4.5)**: `/van-ban` chỉ hiện cây cả chiều rộng; bấm văn bản → `/van-ban/<id>` là trang chi tiết riêng (nút "← Cây văn bản"), không hiện cây bên cạnh. `DocumentWorkspace` quyết định theo đường dẫn. Thêm văn bản khi đang ở trang cây thì ở lại trang cây (nhánh tự mở); thêm từ trang chi tiết thì chuyển sang văn bản mới.
  - Kéo-thả @dnd-kit: tay nắm ⋮⋮ (PointerSensor, ngưỡng 6px), `DndContext id` cố định (tránh lệch hydration). Thay thế bằng bàn phím: "Chuyển đến…".
- **Tệp đính kèm**: `POST /api/files` (multipart, mỗi tệp kiểm tra riêng: ≤ `maxUploadMB`, magic bytes `src/lib/file-type.ts`, tên lưu = id, sha256), `GET /api/files/:id` (kiểm tra quyền xem văn bản, ghi nhật ký DOWNLOAD; PDF/ảnh `inline`, `?tai=1` tải về), `DELETE` = xoá mềm. Lưu ở `UPLOAD_DIR` qua `src/server/storage.ts`. Cảnh báo văn bản mật `SecretWarning` ở mọi chỗ tải tệp.
- **Form**: `EntityForm` có `type: "custom"` (render tuỳ biến), `visibleWhen`, ô `date` dùng `DateInput` (lịch vi, tuần bắt đầu Thứ Hai, nhãn T2…CN). Nội dung tóm tắt: `RichTextEditor` + lọc lại ở server bằng `sanitize-html` (`src/server/sanitize.ts`).
- **Integration test** (`npm run test:integration`): chạy server action thật trên CSDL `<db>_test` (vitest, mock phiên + `revalidatePath`, alias `server-only`).
- `flattenTree` (src/lib/party.ts) trả `treeDepth` — không ghi đè `depth` của bản ghi.
- **Công việc & báo cáo** (GĐ3):
  - Trạng thái theo hạn `src/lib/status.ts` (`dueStatus`, `taskDueStatus`, `checkTransition`, nhãn theo ngữ cảnh task/report). Hạn so theo ngày giờ VN; hoàn thành trong ngày hạn = đúng hạn. Việc SUBMITTED xét theo `submittedAt` (không thành quá hạn vì chờ duyệt); duyệt → `completedAt = submittedAt` (D3).
  - Sinh kỳ `src/lib/report-periods.ts` (hàm thuần); ghi DB `src/server/reports/periods.ts` (`createMissingPeriods`, `regenerateFuturePeriods` khi sửa yêu cầu — xoá kỳ tương lai chưa nộp rồi sinh lại, `extendOpenRequirements` cho job hằng ngày). Tối đa 24 kỳ/đơn vị mỗi lần (D1); ngày hạn > số ngày tháng → cuối tháng.
  - Nộp báo cáo: mỗi kỳ một bản nộp (`ReportSubmission.periodId` unique); tự tạo văn bản con loại BC dưới văn bản yêu cầu nếu `autoCreateChild` và còn chỗ (D4 — có tuỳ chọn tắt); sửa trong 24 giờ hoặc sau khi LEADER/ADMIN mở khoá (`unlockedAt`).
  - Tiến độ cộng dồn `src/lib/progress.ts` (`rollUpProgress`, bỏ nhánh không có việc & việc huỷ — D2); ghi DB `src/server/documents/progress.ts` (`recomputeTrees` sau mọi thay đổi việc/cấu trúc cây, `ensureTreesFreshToday` chạy 1 lần/ngày khi mở trang Văn bản — worker GĐ5 sẽ gọi trực tiếp). `progressCache` null = nhánh chưa có việc.
  - Phạm vi: `taskScopeWhere` (ADMIN/LEADER/CLERK tất cả; OFFICER việc mình/đơn vị/mình giao; PARTY_ADMIN việc mình/mình giao), `periodScopeWhere` (đơn vị mình hoặc mình theo dõi). Thông báo trong ứng dụng ghi ở `src/server/notifications.ts` (chuông hiển thị ở GĐ5).
  - Tệp đính kèm có 3 loại chủ: văn bản / `taskUpdateId` (minh chứng) / `submissionId` (tệp báo cáo, gắn luôn vào văn bản con tự tạo) — `resolveUploadOwner`, `canViewAttachment`.
  - Hàm dựng dữ liệu dòng bảng cho client (`toTaskRow`, `toPeriodRow`) đặt ở `src/server/*/rows.ts`, KHÔNG trong file `"use client"`.
  - Biểu tượng trạng thái dùng icon lucide (`STATUS_ICONS`), không dùng emoji (máy thiếu font emoji hiện ô vuông).
- **Bảng điều hành** (GĐ4): hàm thuần `src/lib/dashboard.ts` (thẻ công việc, quá hạn theo đơn vị, báo cáo 14 ngày, override tổ chức đảng…); truy vấn gom ở `src/server/dashboard/data.ts` (`getDashboard(user, schoolYear)` — dùng chung cho trang `/`, `/trinh-chieu` và `GET /api/dashboard?schoolYear=`). Kiểu xem `dashboardViewOf(user)`: `full` / `officer` (rút gọn + Việc của tôi) / `viewer` (không khối nhiệm vụ). Giao diện `src/components/dashboard/` (`StatTile`, `StatusTile`, `Panel`, `HBarChart` recharts có danh sách link sr-only). Trang đích nhận tham số lọc: `/cong-viec?trangThai=QUA_HAN|SAP_DEN_HAN|DANG_LAM|XONG&donVi=`, `/bao-cao?trongNgay=14|yeuCau=`, `/dia-ban/truong-hoc?capHoc=&namHoc=`, `/dia-ban/to-dan-pho?khuVuc=`, `/dia-ban/to-chuc-dang?loai=chi-bo&khoi=`. Trình chiếu đặt `--font-scale` 1,25 bằng effect (khôi phục khi rời trang).
- **Bảng điều hành — thiết kế lại 22/10/2026** (người dùng: "gọn, thêm biểu đồ"): A. 8 thẻ số gọn (4×2, số co theo màn hình, "Cập nhật ngày" ở tiêu đề khối + `title` thẻ); B. "Công việc theo trạng thái" (thanh 100% màu trạng thái + 4 dòng số, testId `ops-*` giữ nguyên), "Giao mới và hoàn thành — 6 tháng" (cột nhóm: xám/`--chart-1`), "Nộp báo cáo theo tháng của hạn nộp" (cột chồng 4 trạng thái, khe 2px), việc quá hạn theo đơn vị, tiến độ chương trình; C. 3 biểu đồ lĩnh vực (học sinh theo cấp, chi bộ theo khối, nhân khẩu theo khu vực cũ). Bỏ bảng trường/TDP/top chi bộ và danh sách báo cáo 14 ngày/văn bản mới (vẫn có trong `/api/dashboard`, liên kết sang trang chi tiết). Biểu đồ ở `src/components/dashboard/charts.tsx`; hàm thuần `monthWindow`, `taskTrend`, `reportMonthly`, `sumByKey`, `vnMonthKey` (`src/lib/dashboard.ts`). Bấm cột → `/cong-viec?giao=YYYY-MM` | `?trangThai=XONG&xong=YYYY-MM`, `/bao-cao?thang=YYYY-MM&trangThai=…`. Bảng màu đã chạy `validate_palette` (thanh trạng thái đạt; cặp xanh lá–vàng ở báo cáo cần khe + chú thích biểu tượng).
- **Worker & thông báo** (GĐ5):
  - `npm run worker` (tsx `src/worker/index.ts`, node-cron, múi giờ VN): **06:30** `runDailyJob` (bổ sung kỳ báo cáo + nhắc hạn), **00:15** `runNightlyJob` (`recomputeAllTrees`, đặt `progressRecomputedOn`, dọn Thùng rác > 30 ngày, xoá thông báo đã đọc > 90 ngày). Khởi động sau giờ chạy mà hôm nay chưa chạy → chạy bù (đêm trước, nhắc hạn sau). Lần chạy lưu ở `Setting` `job.daily`/`job.nightly` (trang Thùng rác hiển thị). Chạy một lần: `npm run worker -- --once daily|nightly|all [--now <ISO>]`.
  - Job ở `src/server/jobs/*` KHÔNG `server-only`, nhận `PrismaClient` từ ngoài (worker tự tạo client như seed). Logic thuần: `src/lib/reminders.ts` (mốc 3 ngày/1 ngày/quá hạn ≤ 7 ngày, khoá chống trùng `dedupKey`, nội dung), `src/lib/trash.ts` (30 ngày, gốc của mỗi lần xoá).
  - Người nhận: việc → người chủ trì (hoặc mọi tài khoản đơn vị chủ trì nếu chỉ giao đơn vị); ngày quá hạn đầu tiên báo thêm người giao. Kỳ báo cáo → tài khoản đơn vị phải nộp; quá hạn ngày đầu báo thêm người theo dõi yêu cầu. Chống trùng bằng unique `(userId, dedupKey)` + `createMany({ skipDuplicates })`.
  - Chuông `NotificationBell` (GET `/api/notifications`, 60 giây/lần + khi focus/chuyển trang), trang `/thong-bao`; action `markNotificationRead`/`markAllNotificationsRead` (chỉ thông báo của mình, không ghi nhật ký). Theo dõi chương trình (`DocumentFollow`, nút trên trang văn bản cấp 1) → tạo văn bản trong cây báo `NEW_DOCUMENT` cho người theo dõi được quyền xem.
  - **Ghép URL CSDL e2e/test bằng `URL.pathname`** (`e2eDatabaseUrl()`), KHÔNG nối chuỗi `"$DATABASE_URL"_e2e` — `.env` có `?schema=public` nên sẽ trỏ nhầm về CSDL dev.
- **Tìm kiếm Ctrl+K** (GĐ5): `GlobalSearch` (Dialog, combobox/listbox, ↑↓ Enter Esc) → `GET /api/search?q=` → `globalSearch()` (`src/server/search/global.ts`): văn bản (`searchDocuments`), công việc (`taskScopeWhere`), trường, TDP (kể cả tên khu vực cũ), tổ chức đảng — `lower(unaccent(...)) LIKE ALL` + `word_similarity`, 6 kết quả/nhóm. Tô sáng không dấu `highlightParts` (`src/lib/text.ts`). Danh mục nhận `?tim=` (từ khoá ban đầu của `DataTable` qua `initialQuery`).
- **Nhật ký & Thùng rác** (GĐ5): `/quan-tri/nhat-ky` (ADMIN, LEADER) lọc `?nguoi=&doiTuong=&ma=&hanhDong=&tu=&den=&trang=` phía server 50 dòng/trang, `nguoi=he-thong` = thao tác của worker; nhãn/tóm tắt/so sánh trước–sau ở `src/lib/audit-labels.ts`; xuất `GET /api/export/audit-log` (≤ 10.000 dòng). `/quan-tri/thung-rac` (ADMIN): văn bản theo từng lần xoá + tệp xoá riêng lẻ, khôi phục, xoá vĩnh viễn ngay (`purgeDocumentNow` — tệp trên ổ xoá bằng `after()` sau commit). Xoá vĩnh viễn: yêu cầu báo cáo/kỳ/bản nộp/tệp xoá theo CASCADE, công việc giữ lại và bỏ liên kết văn bản; ghi nhật ký `PURGE`.
- **Ban hành & thảo luận văn bản** (GĐ5b, ngoài lộ trình gốc — người dùng yêu cầu 21/10/2026, theo mẫu hệ thống văn bản điều hành):
  - Người nhận = bảng `DocumentShare` (`direct` = chọn đích danh); `DocumentNode.publishedAt/publishedById/publishMessage/recipientAll/recipientDepartmentIds`. Người nhận **mọi vai trò** xem được chi tiết + tải tệp (`sharedUserIds` trong `can("document.view")`, `directViewWhere` gồm `shares`).
  - Logic thuần `src/lib/publish.ts` (`resolveRecipients`, `publishTitle` "ĐƠN VỊ đã ban hành văn bản … [số]", `documentHeadline`, `groupByDay`); action `src/server/actions/publishing.ts` (`publishDocument` — gửi bổ sung chỉ báo người mới, `dedupKey PUBLISH:<id>`; `addComment`/`deleteComment`; `setDocumentFollow` theo dõi văn bản bất kỳ cấp nào). Truy vấn `src/server/documents/social.ts` (`recordDocumentView` — mở văn bản = đã xem + thông báo của văn bản đó coi như đã đọc; `documentSocial`; `listPublished`).
  - Văn bản mới trong nhánh báo người theo dõi **mọi văn bản cấp trên** (không chỉ chương trình). Thảo luận báo người theo dõi + người tạo + người ban hành (được xem văn bản), người viết tự theo dõi.
  - "Đã tải tệp" lấy từ nhật ký `DOWNLOAD` có `mode: "download"`; `/api/files/:id?xem=1` = lấy dữ liệu để xem trước DOCX/XLSX (ghi `mode: "preview"`).
  - Xem trước: `FilePreview` — PDF/ảnh trình duyệt hiển thị; **DOCX bằng `docx-preview` 0.3.7**, **XLSX bằng `exceljs`** (import động, ≤ 500 dòng × 40 cột), lọc liên kết không phải http(s)/mailto; DOC/XLS đời cũ chỉ tải về (máy không có LibreOffice, cài cần sudo).
  - Tệp đính kèm có chủ thứ 4: `commentId` (tệp trong thảo luận, `documentId` = null).
  - Trang `/van-ban/ban-hanh` (tab "Mới ban hành", badge số văn bản gửi đến chưa xem) chiếm cả chiều rộng như dạng danh sách. Trang chi tiết: lưới `grid-cols-1` (KHÔNG bỏ — thiếu nó bản xem trước Word 21cm làm giãn cột trên điện thoại), cột thông tin bên phải từ 1280px.
  - `TreeContext.loadChildren` đánh số thứ tự yêu cầu theo nhánh — bỏ phản hồi cũ về muộn (lỗi tranh chấp xoá → hoàn tác).
- **Biểu đồ**: màu đường dữ liệu `--chart-1` (#3B5BDB sáng / #5C7CFA tối) đã qua `validate_palette` của skill dataviz; không dùng `#2563EB` (màu trạng thái).
- **Thanh bên**: cookie `sidebar-collapsed`; < 768px menu hamburger, 768–1279px chỉ biểu tượng, ≥ 1280px đầy đủ.
- **`AGENTS.md`** do `next dev` tự sinh/ghi lại — giữ trong repo, không sửa tay.
- Sau `shadcn add`: kiểm tra chuỗi tiếng Anh trong `src/components/ui/*` (sr-only, aria-label) và dịch sang tiếng Việt.

### Môi trường dev trên máy A30 (đặc thù)

- Không có quyền Docker và **không dùng sudo** (hỏi trước nếu buộc phải dùng) → PostgreSQL chạy userspace bằng `scripts/dev/local-postgres.sh` (binary `/usr/lib/postgresql/14/bin`, data ở `/hdd3/huehp/.local/webtl-postgres`, cổng **5452**).
- Cổng app dev: **3250** (3000/3100/3300/4000/543x đã bị chiếm).
- Phân vùng `/` gần đầy + quota 20GB → mọi cache để ở `/hdd3`:
  `npm_config_cache=/hdd3/huehp/.npm-cache`, `PLAYWRIGHT_BROWSERS_PATH=/hdd3/huehp/.cache/ms-playwright`.

## 3. Cấu trúc thư mục

```
/hdd3/huehp/webtl
├─ prisma/            schema.prisma, migrations/, seed.ts, seed-sample.ts, clear-sample.ts
├─ prisma.config.ts
├─ src/
│  ├─ app/
│  │  ├─ (auth)/dang-nhap/ doi-mat-khau/   khung xanh, không sidebar
│  │  ├─ (app)/               layout có sidebar + header
│  │  │  ├─ page.tsx          Bảng điều hành
│  │  │  ├─ khong-co-quyen/
│  │  │  ├─ viec-cua-toi/ van-ban/ van-ban/[id]/ bao-cao/ cong-viec/ cong-viec/[id]/
│  │  │  ├─ dia-ban/{thong-tin-phuong,truong-hoc,to-dan-pho,to-chuc-dang}/
│  │  │  └─ quan-tri/{nguoi-dung,don-vi,danh-muc,nhat-ky,thung-rac}/
│  │  ├─ (present)/trinh-chieu/   chế độ TV, không sidebar
│  │  └─ api/  health, files, export, import, search, dashboard
│  ├─ components/ ui/ (shadcn) layout/ dashboard/ document-tree/ tasks/ reports/ catalog/ common/
│  ├─ lib/
│  │  ├─ i18n/vi.ts       mọi chuỗi hiển thị
│  │  ├─ db.ts permissions.ts password.ts party.ts audit.ts format.ts storage.ts
│  │  ├─ schemas/         zod dùng chung (common, catalog, user, auth)
│  │  ├─ excel/           import-specs.ts, parse.ts (thuần)
│  │  ├─ status.ts        trạng thái theo hạn + luồng việc (Mục 3.3, 5.2) — có unit test
│  │  ├─ progress.ts      tiến độ cộng dồn & chấm đỏ (Mục 3.4)  — có unit test
│  │  ├─ tree.ts          path/depth/move/reorder/kéo-thả     — có unit test (+ integration)
│  │  ├─ file-type.ts search.ts
│  │  ├─ report-periods.ts sinh kỳ báo cáo                     — có unit test
│  │  └─ text.ts          bỏ dấu tiếng Việt (kể cả đ/Đ) cho searchText
│  ├─ generated/prisma/   Prisma client (sinh tự động, không commit)
│  ├─ auth.ts auth.config.ts proxy.ts
│  ├─ server/ action.ts (withAuth) errors.ts auth/ actions/ (ghi) queries/ (đọc) excel/
│  ├─ worker/index.ts     tiến trình worker riêng; scheduler.ts lịch dùng chung
│  ├─ instrumentation.ts  WORKER_INLINE=1 → chạy lịch trong tiến trình Next (Render)
├─ tests/ unit/ integration/ e2e/
├─ scripts/ dev/local-postgres.sh, backup.sh
├─ docs/ cau-hoi-mo.md, khoi-phuc.md, trien-khai.md, huong-dan-su-dung.md
└─ docker-compose.yml  .env.example  CLAUDE.md
```

## 4. Quy ước code (Mục 17 đặc tả)

1. **Ngôn ngữ**: biến, hàm, bảng, cột bằng **tiếng Anh**; mọi chữ người dùng thấy bằng **tiếng Việt có dấu**, gom trong `src/lib/i18n/vi.ts`. Không dùng từ tiếng Anh trên UI ("Bảng điều hành", không phải "Dashboard").
2. **URL tiếng Việt không dấu**: `/van-ban`, `/viec-cua-toi`, `/dia-ban/to-dan-pho`…
3. **Không hard-code số liệu địa bàn** trong component — luôn đọc từ DB (`WardProfile`, danh mục, `Setting`).
4. Logic nghiệp vụ (trạng thái hạn, cây, sinh kỳ báo cáo, tiến độ cộng dồn, phân quyền) là **hàm thuần trong `src/lib/*`**, **có unit test trước khi dùng trong UI**.
5. Mọi thao tác ghi đi qua một hàm bọc: `withAuth(action, permission)` → `zod.parse` → transaction → `audit()` → `revalidatePath`.
6. Phân quyền tập trung ở `src/lib/permissions.ts` (`can(user, action, resource?)`), không rải điều kiện trong component.
7. Lỗi thân thiện: không bao giờ lộ stack trace; hiện câu tiếng Việt + mã lỗi ngắn.
8. Trạng thái theo hạn là **giá trị tính toán**, không lưu/không sửa tay. Màu trạng thái luôn kèm chữ/biểu tượng.
9. Xóa văn bản = xóa mềm (`deletedAt`), Thùng rác 30 ngày.
10. UI: chữ gốc 16px, font Be Vietnam Pro, màu chính `#1E3A8A`, nhấn `#B91C1C`, nền `#F8FAFC`, bo góc 12px; mỗi màn hình 1 nút chính; form nhãn trên ô, `*` đỏ, lỗi bằng câu đầy đủ.
11. Trước khi đóng mỗi giai đoạn: kiểm tra giao diện ở 1920, 1366, 390px và chế độ chữ A+.
12. Hết mỗi giai đoạn: `npm run lint && npm run typecheck && npm run test`, cập nhật mục "Tiến độ" bên dưới, commit với **thông điệp tiếng Việt**.

## 5. Lệnh chạy

```bash
# Thiết lập một lần
cp .env.example .env                     # rồi sửa mật khẩu DB, AUTH_SECRET
npm install
npm run db:local -- init                 # tạo cluster PostgreSQL userspace + DB + extension
npx playwright install chromium          # trình duyệt cho e2e (vào PLAYWRIGHT_BROWSERS_PATH)

# Hằng ngày
npm run db:local -- start | stop | status | psql
npm run db:migrate                       # prisma migrate dev
npm run db:seed                          # dữ liệu lõi + mẫu (Mục 15); SEED_SAMPLE=0 để bỏ mẫu
npm run db:clear-sample                  # xoá dữ liệu mẫu (isSample) trước khi bàn giao
npm run dev                              # http://localhost:3250
npm run worker                           # tiến trình cron: 06:30 nhắc hạn, 00:15 tiến độ + Thùng rác
npm run worker -- --once all             # chạy ngay một lần rồi thoát (daily | nightly | all, thêm --now <ISO>)

# Tài khoản (seed): admin (ADMIN); mẫu: bithu, chutich (LEADER), vanthu (CLERK), canbo1, canbo2 (OFFICER),
# xaydungdang (PARTY_ADMIN), totruong1 (VIEWER) — mật khẩu ThanhLiet@2026, bắt đổi khi đăng nhập lần đầu

# Kiểm tra
npm run lint
npm run typecheck
npm run test                             # Vitest
npm run test:integration                 # Vitest trên CSDL thật <db>_test (cây văn bản, tìm kiếm)
npm run test:e2e                         # Playwright — tự tạo CSDL <db>_e2e, dev server cổng 3251
npm run format                           # Prettier

# Máy có Docker
docker compose up -d db                  # postgres 16

# Kiểm tra nhanh app + CSDL
curl http://localhost:3250/api/health    # {"status":"ok","db":"ok"}
```

## 6. Tiến độ

- [x] **Giai đoạn 0 — Khởi tạo** _(xong 20/10/2026)_: Next.js + TS strict + Tailwind + shadcn/ui; ESLint, Prettier, Vitest, Playwright; docker-compose (postgres 16) + `.env.example`; Prisma schema Mục 10 + migration `unaccent`/`pg_trgm`; theme + layout Sidebar/Header/Breadcrumb + A−/A+.
      _Nghiệm thu_: DB + `npm run dev` chạy được; trang trống có layout đầy đủ, tiếng Việt.
      _Kết quả_: PG14 userspace + 2 migration (extension, init 24 bảng); 16 trang khung + đăng nhập/trình chiếu/404; `/api/health` OK; lint, typecheck sạch; 23 unit test + 12 e2e (3 kích thước, A+) đạt. Seed mới có Thông tin phường + Setting — seed đầy đủ Mục 15 làm ở GĐ1. `docker compose up` chưa kiểm chứng được trên A30 (không có quyền Docker).
- [x] **Giai đoạn 1 — Đăng nhập, người dùng, danh mục** _(xong 20/10/2026)_: đăng nhập/đăng xuất/đổi mật khẩu; người dùng & đơn vị; `permissions.ts`; CRUD Thông tin phường, Trường + số liệu năm học, TDP, Tổ chức đảng (cây), loại văn bản, lĩnh vực, cơ quan ban hành, khu vực cũ; nhập/xuất Excel; seed Mục 15.
      _Nghiệm thu_: vai trò khác nhau thấy menu khác nhau; nhập file 60 TDP thành công; báo lỗi đúng dòng khi file sai.
      _Kết quả_: 75 unit test (phân quyền theo từng dòng bảng Mục 12, mật khẩu/khoá, schema, nhập Excel 60 TDP + lỗi theo dòng, cây tổ chức đảng) + 27 e2e (6 vai trò: trang mặc định, menu, nút quản lý, trang/API bị chặn; khoá sau 5 lần sai; bắt đổi mật khẩu; quay lại trang sau đăng nhập; nhập 60 TDP qua giao diện + file lỗi; xuất Excel; form báo lỗi) — chạy 3 lần liên tiếp đều đạt. Đã xem giao diện ở 1920/1366 (A+)/390. Seed mẫu: 7 người dùng, 9 trường, 40 TDP (~92.000 NK), 63 tổ chức đảng, 10 văn bản, 1 yêu cầu báo cáo (kỳ báo cáo sinh ở GĐ3), 25 công việc.
      _Còn lại cho giai đoạn sau_: ô chọn ngày dạng lịch (GĐ2, hiện nhập `dd/mm/yyyy`); bảng điều hành theo vai trò (GĐ4); trang Nhật ký (GĐ5).
- [x] **Giai đoạn 2 — Cây văn bản** _(xong 20/10/2026)_: `/van-ban` 2 cột; CRUD + xóa mềm/khôi phục; kéo-thả di chuyển/sắp xếp; chặn > 5 cấp; breadcrumb; tìm không dấu; đính kèm + xem PDF; dạng danh sách; xuất Excel cây; unit test `tree.ts`.
      _Nghiệm thu_: cây đủ 5 cấp; nút thêm con ẩn ở cấp 5; kéo nhánh 3 cấp vào nút cấp 3 bị từ chối rõ ràng; "quyet dinh thanh lap" ra "Quyết định thành lập…".
      _Kết quả_: cả 4 tiêu chí đạt bằng e2e (tạo 5 cấp qua giao diện; "+"/"Văn bản con" ẩn ở cấp 5; kéo bằng chuột bị từ chối với thông báo nêu số cấp; tìm không dấu tô vàng + tự mở nhánh) và integration test trên CSDL thật (DB không đổi khi bị từ chối). Thêm: tải lười theo nhánh, đính kèm + magic bytes + xem PDF, xoá cả nhánh/hoàn tác, dạng danh sách + thùng rác, xuất Excel cây thụt lề, giao diện điện thoại. 118 unit + 13 integration + 36 e2e.
      _Để giai đoạn sau_: tiến độ cộng dồn & chấm đỏ nhánh quá hạn (cột `progressCache`/`hasOverdueDescendant` đã hiển thị, tính ở GĐ3); form "Yêu cầu báo cáo" và "Giao việc" từ văn bản (GĐ3); chia sẻ văn bản cho VIEWER (bảng `DocumentShare` có sẵn, chưa có giao diện); trang Thùng rác chung + job xoá vĩnh viễn 30 ngày (GĐ5); nhân bản cấu trúc chương trình (GĐ7).
- [x] **Giai đoạn 3 — Công việc & Báo cáo** _(xong 21/10/2026)_: giao việc, tiến độ, báo hoàn thành/duyệt/trả lại, gia hạn; yêu cầu báo cáo một lần/định kỳ, sinh kỳ, nộp, tự tạo văn bản con; unit test `status.ts`, `report-periods.ts`; "Việc của tôi"; tiến độ cộng dồn; chấm đỏ nhánh quá hạn.
      _Nghiệm thu_: báo cáo tháng ngày 20, 01–12/2026, 3 đơn vị → đúng 36 kỳ; nộp ngày 21 → "Đã nộp trễ".
      _Kết quả_: đạt ở cả 3 tầng — unit (`generatePeriods` 12 kỳ × 3 = 36; nộp 21/01 cho hạn 20/01 → "Đã nộp trễ"), integration trên CSDL thật (36 bản ghi kỳ; trạng thái `HOAN_THANH_TRE`; tự tạo văn bản con), e2e qua giao diện (form xem trước "36 kỳ", trang Theo dõi báo cáo 36 dòng, nộp 21/01 hiện "Đã nộp trễ", văn bản con trên cây). Thêm: luồng việc đầy đủ (giao → tiến độ + minh chứng → gia hạn → báo hoàn thành → trả lại → duyệt), Việc của tôi (trang mặc định OFFICER), tiến độ cộng dồn + chấm đỏ trên cây, xuất Excel công việc/báo cáo. 146 unit + 20 integration + 42 e2e.
      _Để giai đoạn sau_: chuông thông báo + job 06:30 nhắc hạn/quá hạn và gọi `extendOpenRequirements`/`recomputeAllTrees` (GĐ5); dashboard dùng `/cong-viec?trangThai=…`, `/bao-cao?trangThai=…` (GĐ4).
- [x] **Giai đoạn 4 — Bảng điều hành** _(xong 21/10/2026)_: `/api/dashboard` 1 lần gọi; 5 khối Mục 7; mọi con số bấm được; chọn năm học; Trình chiếu tự làm mới.
      _Nghiệm thu_: số khớp danh mục; "Quá hạn" ra đúng danh sách; đẹp ở 1920×1080, 1366×768, 390px.
      _Kết quả_: đạt — e2e so số trên thẻ với CSDL (TDP/hộ/nhân khẩu, trường, học sinh, CB-GV-NV, tổ chức đảng override "Số nhập tay", chi bộ đếm danh mục); bấm "Quá hạn" → `/cong-viec?trangThai=QUA_HAN` đúng số dòng, dòng nào cũng "Quá hạn"; đổi năm học đổi số liệu; bấm cột biểu đồ ra danh sách lọc; dashboard theo vai trò (OFFICER rút gọn + Việc của tôi, VIEWER không có khối nhiệm vụ); `/trinh-chieu` chữ ×1,25, tự làm mới 5 phút. Không tràn ngang ở 1920/1366/390 (cả A+). Biểu đồ tròn thay bằng thanh ngang một màu (ghi ở `docs/cau-hoi-mo.md` mục G). 153 unit + 20 integration + 48 e2e (chạy 2 lần liền đều đạt).
- [x] **Giai đoạn 5 — Thông báo, tìm kiếm, nhật ký, thùng rác** _(xong 21/10/2026)_: worker cron 06:30; chuông thông báo; `Ctrl+K`; trang nhật ký; Thùng rác (job xóa vĩnh viễn > 30 ngày).
      _Nghiệm thu_: việc còn 3 ngày → người chủ trì có thông báo sáng hôm đó.
      _Kết quả_: đạt — integration (job 06:30 với giờ cố định sinh đúng 1 thông báo "còn 3 ngày đến hạn" cho người chủ trì, chạy lại trong ngày không trùng) và e2e (worker chạy thật `--once daily` trên CSDL e2e → cán bộ đăng nhập thấy badge, mở chuông thấy thông báo, bấm vào tới đúng công việc, badge giảm). Thêm: nhắc 1 ngày, quá hạn ≤ 7 ngày + báo người giao/người theo dõi ngày đầu, kỳ báo cáo; job đêm tính lại tiến độ + xoá vĩnh viễn Thùng rác > 30 ngày (kể cả tệp trên ổ, ghi nhật ký PURGE); chạy bù khi worker khởi động muộn; Ctrl+K không dấu theo phạm vi xem; Nhật ký lọc + xuất Excel; Thùng rác khôi phục/xoá vĩnh viễn; theo dõi chương trình → thông báo văn bản mới. Giao diện kiểm ở 1920/1366/390 không tràn ngang. 171 unit + 32 integration + 54 e2e (chạy 2 lần liền đều đạt).
      _Để giai đoạn sau_: service `worker` trong docker-compose + chạy worker không cần `tsx` (GĐ6); email/Zalo (GĐ7).
- [x] **Giai đoạn 5b — Ban hành, xem trước Word/Excel, thảo luận** _(bổ sung theo yêu cầu, xong 21/10/2026)_: nút "Ban hành / Gửi" tới Toàn phường / đơn vị / cá nhân kèm lời gửi; thông báo "ĐƠN VỊ đã ban hành văn bản … [số]"; trang "Mới ban hành" theo ngày; người nhận xem được & tải tệp; xem trước DOCX/XLSX ngay trên trang; người nhận / đã xem / đã tải / người theo dõi; theo dõi văn bản; thảo luận có tệp đính kèm.
      _Kết quả_: 180 unit + 40 integration + 57 e2e (chạy 2 lần liền đều đạt); kiểm giao diện 1920/1366/390 không tràn/không cắt chữ. Lệch đặc tả Mục 1.4 (hệ thống tiến gần quản lý văn bản) đã được người dùng chấp thuận; ghi ở `docs/cau-hoi-mo.md` mục I.
- [x] **Triển khai Render** _(bổ sung theo yêu cầu, 26/10/2026; người dùng chọn Render, chưa có tên miền)_: `render.yaml` (web Starter + disk 1 GB `/var/data`, Postgres 16 basic-256mb, Singapore; pre-deploy `migrate deploy && db seed`; health `/api/health`); hướng dẫn `docs/trien-khai.md`. Lịch job chạy trong tiến trình Next khi `WORKER_INLINE=1` (`src/instrumentation.ts` → `src/worker/scheduler.ts`, dùng chung với `npm run worker`): đo thử Next + worker `tsx` riêng ≈ 280 + 240 MB > 512 MB của Starter, còn chung một tiến trình ≈ 310 MB (worker bundle bằng esbuild vẫn ~215 MB — chủ yếu do Prisma client). `SEED_SAMPLE_PASSWORD` thay mật khẩu tài khoản mẫu. Build không cần CSDL. Không bật cùng lúc `WORKER_INLINE=1` và `npm run worker`.
- [ ] **Giai đoạn 6 — Hoàn thiện & triển khai**: tour hướng dẫn; trạng thái rỗng; in ấn; e2e luồng chính; bản đóng gói production, script backup, `docs/huong-dan-su-dung.md`, `docs/trien-khai.md`.
- [ ] **Giai đoạn 7 — Mở rộng (sau dùng thử)**: bản đồ Leaflet/OSM; email/Zalo OA; nhân bản chương trình; báo cáo Word tự động; PWA.
