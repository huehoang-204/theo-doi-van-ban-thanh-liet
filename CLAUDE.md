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
| Form / validate | react-hook-form + zod                                                                                                |
| Ngày, số        | date-fns + locale `vi`, `Intl.NumberFormat('vi-VN')`, múi giờ `Asia/Ho_Chi_Minh` (DB lưu UTC)                        |
| ORM / CSDL      | Prisma 7.10 (generator `prisma-client`, adapter `@prisma/adapter-pg`) + PostgreSQL (extension `unaccent`, `pg_trgm`) |
| Xác thực        | Auth.js (NextAuth v5) Credentials + bcrypt cost 12                                                                   |
| Tệp             | `StorageService` lưu ổ cục bộ (`UPLOAD_DIR`), phục vụ qua route có kiểm tra quyền                                    |
| Job             | `node-cron` trong tiến trình worker riêng (`npm run worker`)                                                         |
| Xuất Excel      | exceljs                                                                                                              |
| Kiểm thử        | Vitest 4.1 (unit), Playwright (e2e, 3 kích thước 1920/1366/390)                                                      |
| Đóng gói        | docker-compose (postgres 16) cho máy có Docker; máy dev A30 dùng PostgreSQL userspace                                |

Phiên bản pin chính xác trong `package.json` (`.npmrc` có `save-exact=true`). Lý do các mốc phiên bản:

- **Vitest 4.1, jsdom 27, @types/node 20**: máy dev chạy Node 20.20 (Vitest 5 / jsdom 28 đòi Node 22).
- **TypeScript 6.0**: TS 7 chưa được typescript-eslint hỗ trợ. **ESLint 9**: eslint-config-next chưa ổn với 10.
- **Prisma 7.10.1**: tag `latest` trên npm đang là 8.0 RC.

### Ghi chú kỹ thuật quan trọng

- **Prisma 7**: URL CSDL ở `prisma.config.ts` (không còn trong `schema.prisma`); client sinh vào `src/generated/prisma` (không commit) — import từ `@/generated/prisma/client`, enum từ `@/generated/prisma/enums`. Trong app dùng `db` từ `@/lib/db` (có `server-only`); script ngoài Next (seed, worker) tự tạo `PrismaClient` với `PrismaPg`.
- **Trường chỉ có ngày** (`@db.Date`: hạn, ngày ban hành…) → Prisma trả Date 00:00 UTC; luôn đọc/ghi bằng helper trong `src/lib/format.ts` (`formatDate`, `dateOnlyKey`, `daysUntil`), không tự `new Date()` theo giờ máy.
- **Tìm không dấu**: cột `searchText` tính ở app bằng `buildSearchText()` (`src/lib/text.ts`, xử lý cả `đ/Đ`), index GIN trigram; index `path` dùng `text_pattern_ops` cho `LIKE '/a/b/%'`.
- **Typed routes** bật (`typedRoutes: true`): `href` phải là route có thật; `npm run typecheck` chạy `next typegen` trước `tsc`.
- **Hằng số dùng chung server/client** (tên cookie…) đặt ở `src/lib/*`, không export từ file `"use client"`.
- **Cỡ chữ A−/A+**: cookie `font-scale` (100/112/125) → biến CSS `--font-scale` trên `<html>`; mọi kích thước dùng `rem` nên co giãn theo. GĐ1 đồng bộ thêm `User.fontScale`.
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
├─ prisma/            schema.prisma, migrations/, seed.ts, seed-sample.ts
├─ prisma.config.ts
├─ src/
│  ├─ app/
│  │  ├─ (auth)/dang-nhap/
│  │  ├─ (app)/               layout có sidebar + header
│  │  │  ├─ page.tsx          Bảng điều hành
│  │  │  ├─ viec-cua-toi/ van-ban/ van-ban/[id]/ bao-cao/ cong-viec/ cong-viec/[id]/
│  │  │  ├─ dia-ban/{thong-tin-phuong,truong-hoc,to-dan-pho,to-chuc-dang}/
│  │  │  └─ quan-tri/{nguoi-dung,don-vi,danh-muc,nhat-ky,thung-rac}/
│  │  ├─ (present)/trinh-chieu/   chế độ TV, không sidebar
│  │  └─ api/  health, files, export, import, search, dashboard
│  ├─ components/ ui/ (shadcn) layout/ dashboard/ document-tree/ tasks/ reports/ catalog/ common/
│  ├─ lib/
│  │  ├─ i18n/vi.ts       mọi chuỗi hiển thị
│  │  ├─ db.ts auth.ts permissions.ts storage.ts audit.ts format.ts
│  │  ├─ status.ts        trạng thái theo hạn (Mục 3.3)      — có unit test
│  │  ├─ tree.ts          path/depth/move/progress roll-up    — có unit test
│  │  ├─ report-periods.ts sinh kỳ báo cáo                     — có unit test
│  │  └─ text.ts          bỏ dấu tiếng Việt (kể cả đ/Đ) cho searchText
│  ├─ generated/prisma/   Prisma client (sinh tự động, không commit)
│  ├─ server/ actions/ (ghi) queries/ (đọc)
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
npm run db:seed                          # dữ liệu mẫu (Mục 15)
npm run dev                              # http://localhost:3250
npm run worker                           # tiến trình cron (từ Giai đoạn 5)

# Kiểm tra
npm run lint
npm run typecheck
npm run test                             # Vitest
npm run test:e2e                         # Playwright
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
- [ ] **Giai đoạn 1 — Đăng nhập, người dùng, danh mục**: đăng nhập/đăng xuất/đổi mật khẩu; người dùng & đơn vị; `permissions.ts`; CRUD Thông tin phường, Trường + số liệu năm học, TDP, Tổ chức đảng (cây), loại văn bản, lĩnh vực, cơ quan ban hành, khu vực cũ; nhập/xuất Excel; seed Mục 15.
      _Nghiệm thu_: vai trò khác nhau thấy menu khác nhau; nhập file 60 TDP thành công; báo lỗi đúng dòng khi file sai.
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
