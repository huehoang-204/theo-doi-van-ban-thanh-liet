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
- **Seed**: `prisma/seed.ts` = dữ liệu lõi (an toàn production, không ghi đè chỉnh sửa, admin chỉ tạo nếu chưa có — mật khẩu `SEED_ADMIN_PASSWORD` hoặc mặc định); `prisma/seed-sample.ts` = dữ liệu minh hoạ `isSample=true` (bỏ qua bằng `SEED_SAMPLE=0`), xoá bằng `npm run db:clear-sample`.
- **E2E** chạy trên CSDL riêng `<db>_e2e` + dev server riêng cổng 3251, thư mục build `.next-e2e` (`NEXT_DIST_DIR`); `tests/e2e/global-setup.ts` migrate + seed + đặt lại tài khoản thử (mật khẩu `ThanhLiet@2026`). Không đụng dữ liệu dev. Khi viết test form dùng `getByRole("textbox", { name })` (nhãn có dấu `*`), chờ nút gửi bật lại trước khi điền tiếp (React đặt lại form sau action).
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
│  │  ├─ status.ts        trạng thái theo hạn (Mục 3.3)      — có unit test
│  │  ├─ tree.ts          path/depth/move/progress roll-up    — có unit test
│  │  ├─ report-periods.ts sinh kỳ báo cáo                     — có unit test
│  │  └─ text.ts          bỏ dấu tiếng Việt (kể cả đ/Đ) cho searchText
│  ├─ generated/prisma/   Prisma client (sinh tự động, không commit)
│  ├─ auth.ts auth.config.ts proxy.ts
│  ├─ server/ action.ts (withAuth) errors.ts auth/ actions/ (ghi) queries/ (đọc) excel/
│  └─ worker/index.ts     cron 06:30 + job đêm
├─ tests/ unit/ e2e/
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
npm run worker                           # tiến trình cron (từ Giai đoạn 5)

# Tài khoản (seed): admin (ADMIN); mẫu: bithu, chutich (LEADER), vanthu (CLERK), canbo1, canbo2 (OFFICER),
# xaydungdang (PARTY_ADMIN), totruong1 (VIEWER) — mật khẩu ThanhLiet@2026, bắt đổi khi đăng nhập lần đầu

# Kiểm tra
npm run lint
npm run typecheck
npm run test                             # Vitest
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
- [ ] **Giai đoạn 2 — Cây văn bản**: `/van-ban` 2 cột; CRUD + xóa mềm/khôi phục; kéo-thả di chuyển/sắp xếp; chặn > 5 cấp; breadcrumb; tìm không dấu; đính kèm + xem PDF; dạng danh sách; xuất Excel cây; unit test `tree.ts`.
      _Nghiệm thu_: cây đủ 5 cấp; nút thêm con ẩn ở cấp 5; kéo nhánh 3 cấp vào nút cấp 3 bị từ chối rõ ràng; "quyet dinh thanh lap" ra "Quyết định thành lập…".
- [ ] **Giai đoạn 3 — Công việc & Báo cáo**: giao việc, tiến độ, báo hoàn thành/duyệt/trả lại, gia hạn; yêu cầu báo cáo một lần/định kỳ, sinh kỳ, nộp, tự tạo văn bản con; unit test `status.ts`, `report-periods.ts`; "Việc của tôi"; tiến độ cộng dồn; chấm đỏ nhánh quá hạn.
      _Nghiệm thu_: báo cáo tháng ngày 20, 01–12/2026, 3 đơn vị → đúng 36 kỳ; nộp ngày 21 → "Đã nộp trễ".
- [ ] **Giai đoạn 4 — Bảng điều hành**: `/api/dashboard` 1 lần gọi; 5 khối Mục 7; mọi con số bấm được; chọn năm học; Trình chiếu tự làm mới.
      _Nghiệm thu_: số khớp danh mục; "Quá hạn" ra đúng danh sách; đẹp ở 1920×1080, 1366×768, 390px.
- [ ] **Giai đoạn 5 — Thông báo, tìm kiếm, nhật ký, thùng rác**: worker cron 06:30; chuông thông báo; `Ctrl+K`; trang nhật ký; Thùng rác (job xóa vĩnh viễn > 30 ngày).
      _Nghiệm thu_: việc còn 3 ngày → người chủ trì có thông báo sáng hôm đó.
- [ ] **Giai đoạn 6 — Hoàn thiện & triển khai**: tour hướng dẫn; trạng thái rỗng; in ấn; e2e luồng chính; bản đóng gói production, script backup, `docs/huong-dan-su-dung.md`, `docs/trien-khai.md`.
- [ ] **Giai đoạn 7 — Mở rộng (sau dùng thử)**: bản đồ Leaflet/OSM; email/Zalo OA; nhân bản chương trình; báo cáo Word tự động; PWA.
