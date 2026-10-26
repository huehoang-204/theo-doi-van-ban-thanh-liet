# Triển khai lên Render

Hướng dẫn đưa hệ thống lên mạng qua [Render](https://render.com) — dịch vụ chạy ứng dụng web,
không phải tự quản trị máy chủ. Toàn bộ cấu hình đã có sẵn trong tệp [`render.yaml`](../render.yaml)
ở gốc repo, nên chỉ cần vài thao tác bấm trên trang Render.

Sau khi xong, hệ thống có địa chỉ dạng `https://webtl-thanh-liet.onrender.com` (HTTPS tự động),
và **tự cập nhật mỗi khi đẩy mã mới lên nhánh `main`** trên GitHub.

## Những gì sẽ được tạo

| Thành phần                     | Gói Render           | Vai trò                                                                                              |
| ------------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------- |
| Web service `webtl-thanh-liet` | Starter (512 MB RAM) | Chạy ứng dụng; chạy luôn các tác vụ tự động (nhắc hạn 06:30, tính lại tiến độ & dọn Thùng rác 00:15) |
| Ổ đĩa `uploads` (1 GB)         | gắn vào web service  | Lưu tệp đính kèm, văn bản tải lên                                                                    |
| PostgreSQL 16 `webtl-db`       | Basic-256mb          | Cơ sở dữ liệu; chỉ kết nối được từ bên trong Render                                                  |

Tất cả đặt ở khu vực **Singapore** (gần Việt Nam nhất).

**Chi phí ước tính:** khoảng **13–14 USD/tháng** (Starter ~7 USD + ổ đĩa 1 GB ~0,25 USD + PostgreSQL
Basic-256mb ~6 USD). Giá có thể thay đổi — xem [render.com/pricing](https://render.com/pricing).
Render tính theo số ngày dùng thực tế; xoá dịch vụ là ngừng tính tiền.

> **Vì sao không dùng gói miễn phí?** Gói free của Render không gắn được ổ đĩa (tệp tải lên mất mỗi
> lần khởi động lại), ứng dụng "ngủ" sau 15 phút không ai dùng (lần mở sau chờ ~1 phút), và CSDL
> miễn phí bị xoá sau 30 ngày. Chỉ hợp để xem thử chớp nhoáng, không hợp để dùng.

## Các bước

### 1. Tạo tài khoản Render

1. Vào <https://dashboard.render.com/register>, chọn **GitHub** để đăng nhập bằng tài khoản GitHub
   đang giữ repo `theo-doi-van-ban-thanh-liet`.
2. Khi Render hỏi quyền truy cập repo: chọn **Only select repositories** → chọn
   `theo-doi-van-ban-thanh-liet` (repo riêng tư vẫn dùng được).
3. Vào **Account Settings → Billing**, thêm thẻ thanh toán (bắt buộc với gói trả phí).

### 2. Tạo hệ thống từ Blueprint

1. Trên dashboard Render, bấm **New → Blueprint**.
2. Chọn repo `theo-doi-van-ban-thanh-liet`, nhánh `main`. Render đọc `render.yaml` và liệt kê
   web service + CSDL sẽ tạo.
3. Đặt **Blueprint Name** tuỳ ý (VD `thanh-liet`).
4. Render yêu cầu nhập 2 giá trị bí mật:

   | Biến                   | Nhập gì                                                                                             |
   | ---------------------- | --------------------------------------------------------------------------------------------------- |
   | `SEED_ADMIN_PASSWORD`  | Mật khẩu ban đầu của tài khoản `admin` (≥ 8 ký tự, có cả chữ và số)                                 |
   | `SEED_SAMPLE_PASSWORD` | Mật khẩu chung cho các tài khoản **mẫu** (`chutich`, `vanthu`, `canbo1`…) — đặt khác mật khẩu admin |

   Các biến còn lại (`AUTH_SECRET`, `DATABASE_URL`…) Render tự sinh/tự điền.

5. Bấm **Deploy Blueprint**. Lần đầu mất khoảng 5–10 phút: tạo CSDL → cài thư viện & build →
   cập nhật cấu trúc CSDL và nạp dữ liệu ban đầu → khởi động.

### 3. Mở hệ thống

1. Vào web service `webtl-thanh-liet` trên dashboard; địa chỉ nằm ở đầu trang
   (VD `https://webtl-thanh-liet.onrender.com` — nếu tên đã có người dùng, Render thêm hậu tố).
2. Đăng nhập `admin` với `SEED_ADMIN_PASSWORD` vừa đặt → hệ thống bắt đổi mật khẩu ngay.
3. Kiểm tra nhanh tình trạng: mở `https://<địa-chỉ>/api/health` → phải thấy
   `{"status":"ok","db":"ok"}`.

Các tài khoản mẫu (dùng `SEED_SAMPLE_PASSWORD`, lần đầu cũng phải đổi mật khẩu):
`bithu`, `chutich` (lãnh đạo), `vanthu` (văn thư), `canbo1`, `canbo2` (cán bộ), `xaydungdang`,
`totruong1` (chỉ xem) — chi tiết trong [README](../README.md#tài-khoản-dùng-thử-dữ-liệu-mẫu).

## Cập nhật phiên bản mới

Chỉ cần đẩy mã lên nhánh `main`:

```bash
git push origin main
```

Render tự build và triển khai lại (khoảng 3–5 phút, hệ thống gián đoạn chừng 1 phút trong lúc
khởi động lại). Trước mỗi lần triển khai, Render tự chạy `prisma migrate deploy` để cập nhật cấu trúc
CSDL. Theo dõi tiến trình ở tab **Events** và **Logs** của web service.

## Chuyển sang dùng dữ liệu thật

Bản triển khai đầu có **dữ liệu mẫu** (số liệu minh hoạ, tài khoản mẫu) để xem thử. Trước khi đưa
vào dùng thật:

1. Web service → **Environment** → sửa `SEED_SAMPLE` thành `0` → **Save Changes**
   (nếu không, lần triển khai sau sẽ nạp lại dữ liệu mẫu).
2. Web service → **Shell**, chạy:

   ```bash
   npm run db:clear-sample
   ```

   Lệnh xoá mọi bản ghi mẫu (đánh dấu `isSample`), giữ lại tài khoản `admin`, danh mục và cấu hình.

3. Đăng nhập `admin`, tạo tài khoản thật cho cán bộ ở **Quản trị → Người dùng**, nhập danh mục
   địa bàn (TDP, trường học, tổ chức đảng) bằng tệp Excel mẫu ở từng trang.

## Sao lưu

- **CSDL:** gói PostgreSQL trả phí của Render tự sao lưu; khôi phục về một thời điểm trước ở tab
  **Recovery** của `webtl-db`. Có thể tải bản sao lưu thủ công ở tab **Backups/Recovery**.
- **Tệp tải lên:** Render chụp ổ đĩa hằng ngày; khôi phục ở web service → **Disks**.
- Nên định kỳ (VD hằng tháng) xuất Excel các danh sách quan trọng ở từng trang để lưu riêng.

## Gắn tên miền riêng (khi có)

1. Web service → **Settings → Custom Domains → Add Custom Domain**, nhập VD `vanban.thanhliet.vn`.
2. Tại nơi quản lý tên miền, thêm bản ghi **CNAME** trỏ về địa chỉ `….onrender.com` mà Render hiển thị.
3. Render tự cấp chứng chỉ HTTPS sau vài phút. Địa chỉ `….onrender.com` cũ vẫn dùng được.

## Lưu ý về dữ liệu

- Máy chủ Render đặt ở **Singapore**, dữ liệu nằm ngoài lãnh thổ Việt Nam. Phù hợp để chạy thử và
  dùng nội bộ với văn bản thông thường. Trước khi dùng chính thức, nên hỏi ý kiến bộ phận phụ trách
  CNTT/an toàn thông tin của phường/thành phố về quy định lưu trữ dữ liệu (đặc tả Mục 13.3 khuyến nghị
  chạy trên mạng nội bộ/VPN; Mục 16.9 còn mở về nơi triển khai).
- **Không** đưa lên hệ thống văn bản Mật, Tối mật, Tuyệt mật (đặc tả Mục 13).
- Ứng dụng mở ra Internet: dùng mật khẩu mạnh, khoá tài khoản không còn dùng ở **Quản trị → Người dùng**.

## Xử lý sự cố

| Hiện tượng                            | Cách xử lý                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Deploy báo lỗi ở bước build           | Xem tab **Logs** → dòng lỗi đầu tiên; thường do mã mới chưa qua `npm run build` ở máy dev                          |
| Deploy lỗi ở bước pre-deploy          | Lỗi cập nhật CSDL (migration). Xem log; không xoá CSDL — liên hệ người phát triển                                  |
| Trang báo lỗi 502/503                 | Mở `/api/health`; nếu `db: unreachable` → kiểm tra `webtl-db` còn chạy (tab **Info**)                              |
| Không có thông báo nhắc hạn buổi sáng | Logs của web service, tìm dòng `[worker …]`. Trang **Quản trị → Thùng rác** hiển thị lần chạy gần nhất của các job |
| Hết dung lượng ổ tệp                  | Web service → **Disks** → tăng dung lượng (chỉ tăng được, không giảm)                                              |

## Ghi chú kỹ thuật

- `render.yaml`: build `npm ci --include=dev && npm run build` (cần devDependencies: Prisma CLI,
  `tsx` cho seed, Tailwind); pre-deploy `prisma migrate deploy && prisma db seed` (seed chỉ tạo phần còn
  thiếu, không ghi đè); start `next start --port $PORT`; health check `/api/health`.
- Tác vụ định kỳ chạy **trong tiến trình web** khi `WORKER_INLINE=1` (`src/instrumentation.ts` →
  `src/worker/scheduler.ts`), dùng chung Prisma client và ổ đĩa tệp. Đo thử: một tiến trình ~300 MB
  RAM, còn chạy worker riêng thì cần thêm ~200 MB — vượt 512 MB của gói Starter. Khi khởi động sau
  giờ chạy mà hôm nay job chưa chạy (VD vừa triển khai lại), job được chạy bù ngay.
- Chỉ chạy **một** instance web (ổ đĩa Render gắn vào một instance); không bật đồng thời
  `WORKER_INLINE=1` và `npm run worker` trên cùng CSDL.
- Triển khai trên máy chủ riêng/VPS (Docker, Caddy, sao lưu `pg_dump`) theo đặc tả Mục 9.1, 13.4 sẽ
  bổ sung ở Giai đoạn 6.
