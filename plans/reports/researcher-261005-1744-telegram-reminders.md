# Nghiên cứu kiến trúc nhắc Telegram định kỳ

**Ngày nghiên cứu:** 2026-10-05 (UTC+07:00)  
**Phạm vi:** Next.js 15 App Router trên Vercel hoặc Cloudflare; Firebase lưu dữ liệu; không tự quản lý máy chủ backend.  
**Nguồn:** chỉ dùng tài liệu chính thức của Firebase/Google Cloud, Vercel, Cloudflare và Telegram.

## Kết luận ngắn

Chọn **Cloud Functions for Firebase 2nd gen với `onSchedule`**. Đây là đường đi ít thành phần nhất khi dữ liệu đã nằm trong Firestore: một scheduled function đọc Firestore bằng Firebase Admin SDK/ADC rồi gọi Telegram Bot API. Firebase CLI tự tạo Cloud Scheduler job và HTTP function; function chỉ được scheduler job liên quan gọi. Không cần mở một cron route công khai trong ứng dụng Next.js.

Điều kiện cần chấp nhận: deploy Cloud Functions yêu cầu Firebase project ở **Blaze/pay-as-you-go** (có billing account), dù mức sử dụng nhỏ thường nằm trong no-cost tier. Một job Cloud Scheduler được miễn phí trong hạn mức 3 jobs/account; sau đó là khoảng $0.10/job/31 ngày. Đây là “free-tier feasible”, không phải “không cần bật billing”.

## Bối cảnh repository và giả định

- `package.json` hiện là boilerplate Next.js; chưa có Firebase SDK, `functions/`, schema Firestore hay Telegram integration.
- `src/app/page.tsx` chỉ render template, chưa thể hiện target/remaining data.
- README chỉ mô tả API base URL; chưa xác nhận Firebase project, Auth model, Firestore collection hay timezone người dùng.
- Báo cáo giả định một user/target trước. Nếu có nhiều user hoặc nhiều timezone, cần lưu `timezone`, `chatId` và trạng thái nhắc trong Firestore theo user; không nhúng các giá trị đó vào client.

## So sánh

| Lựa chọn | Secret và quyền đọc Firebase | Lịch/free tier | Khi lỗi | Độ phù hợp |
|---|---|---|---|---|
| **Firebase `onSchedule`** | Secret Manager qua `defineSecret()`/`secrets`; function dùng ADC/Admin SDK. Server SDK bypass Firestore Rules nên quyền phải kiểm soát bằng IAM/service identity. Scheduler job là caller được cấp quyền cho HTTP function. | Cron hỗ trợ timezone IANA; 3 Cloud Scheduler jobs/account miễn phí, $0.10/job/31 ngày sau đó. Functions yêu cầu Blaze nhưng 2M invocations/tháng và compute/egress no-cost tier. | Cloud Scheduler có retry exponential backoff cấu hình được; cần idempotency vì retry có thể gửi trùng Telegram. | **Cao nhất:** scheduler, data và IAM cùng hệ Firebase/Google; ít glue code. |
| **Vercel Cron + Route Handler** | `CRON_SECRET` được Vercel gửi trong `Authorization`; Firebase Admin credentials và Telegram token phải nằm trong Vercel Secret env. Route Handler là endpoint của app. | Cron có trên mọi plan, nhưng Hobby chỉ **mỗi ngày một lần**, độ chính xác trong cửa sổ ±59 phút và timezone luôn UTC. Function usage vẫn áp dụng. | Vercel **không retry** invocation lỗi; xem logs. Phải tự làm retry/idempotency. | Tốt nếu đã chắc chắn deploy Vercel và chấp nhận UTC/độ trễ; thêm một public route và một boundary secret. |
| **Cloudflare Worker Cron Trigger** | Worker Secrets lưu token. Đọc Firestore trực tiếp đòi OAuth/service-account flow hoặc gọi một API trung gian; Firestore server SDK bypass Rules. | Workers Free 100,000 requests/ngày, 10 ms CPU/invocation; Cron chạy UTC, tối đa 5 Cron Triggers/account (Free). Trigger thay đổi có thể mất đến 15 phút propagate. | Tài liệu mô tả `scheduled()` outcome, `noRetry` và Past Events nhưng không đưa ra policy auto-retry nên không nên giả định retry. Phải tự retry/idempotency. | Khả thi, nhưng tích hợp Firebase auth/data phức tạp nhất; không phải lựa chọn nhỏ nhất cho app Firebase-first. |

### Nguồn chính cho các quyết định

- Firebase scheduled functions: <https://firebase.google.com/docs/functions/schedule-functions>
- Firebase secrets/parameterized configuration: <https://firebase.google.com/docs/functions/config-env>
- Firestore server client và Security Rules: <https://firebase.google.com/docs/firestore/security/rules-query>
- Firebase/Cloud Functions quotas và billing: <https://firebase.google.com/docs/functions/quotas> và <https://firebase.google.com/pricing>
- Cloud Scheduler pricing: <https://cloud.google.com/scheduler/pricing>
- Cloud Scheduler retry policy: <https://docs.cloud.google.com/scheduler/docs/configuring/retry-jobs>
- Vercel Cron usage/pricing: <https://vercel.com/docs/cron-jobs/usage-and-pricing>
- Vercel Cron management, auth và failure behavior: <https://vercel.com/docs/cron-jobs/manage-cron-jobs>
- Vercel environment secrets: <https://vercel.com/docs/environment-variables/sensitive-environment-variables>
- Cloudflare Cron Triggers: <https://developers.cloudflare.com/workers/configuration/cron-triggers/>
- Cloudflare limits/pricing: <https://developers.cloudflare.com/workers/platform/limits/> và <https://developers.cloudflare.com/workers/platform/pricing/>
- Cloudflare Worker Secrets: <https://developers.cloudflare.com/workers/configuration/secrets/>
- Telegram Bot API `sendMessage`: <https://core.telegram.org/bots/api>

Các nguồn trên là tài liệu sản phẩm/API chính thức, cập nhật gần thời điểm nghiên cứu; không dùng tutorial hoặc benchmark bên thứ ba.

## Kiến trúc được khuyến nghị

```text
Cloud Scheduler (managed by Firebase onSchedule)
              │ authenticated invocation
              ▼
Cloud Function 2nd gen (Firebase)
  ├─ ADC/Admin SDK → Firestore (target + progress)
  ├─ Secret Manager → TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
  └─ HTTPS POST → api.telegram.org/bot<TOKEN>/sendMessage
```

### Inputs/configuration cần chốt

1. `FIREBASE_PROJECT_ID` và region function, ví dụ `asia-southeast1`.
2. Firestore collection/document contract, tối thiểu:
   `targets/{targetId}` với `targetValue`, `currentValue`, `unit`, `enabled`, `ownerUid`, và `timezone` (nếu lịch theo user).
3. `TELEGRAM_BOT_TOKEN`: tạo bằng @BotFather; không đưa vào Next.js client, Git hoặc Firestore.
4. `TELEGRAM_CHAT_ID`: có thể là config không quá nhạy cảm, nhưng nên giữ cùng Secret Manager để không lộ recipient; bot không thể tự bắt đầu chat, user phải nhắn/add bot trước.
5. Lịch, ví dụ `08:00 Asia/Ho_Chi_Minh` → cron `0 8 * * *` + timezone IANA `Asia/Ho_Chi_Minh`. Firebase `onSchedule` hỗ trợ timezone; không cần tự đổi sang UTC. Nếu một user có timezone khác, lưu timezone và cân nhắc một job UTC chạy hàng giờ rồi lọc due reminders.
6. Retry policy: bật một số lần retry có backoff cho lỗi tạm thời, nhưng handler phải idempotent.

Secret boundary nên là: Secret Manager chỉ bind vào function gửi Telegram; Admin SDK dùng service identity/ADC của function; Firestore Rules tiếp tục bảo vệ client, nhưng **không** bảo vệ các truy cập server SDK. Chỉ lưu những fields cần thiết và giới hạn IAM của deployment/service identity.

### Payload Telegram

Telegram Bot API là HTTPS. Function gửi JSON đến:

```http
POST https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/sendMessage
Content-Type: application/json
```

```json
{
  "chat_id": "<TELEGRAM_CHAT_ID>",
  "text": "🎯 Ping Target\nMục tiêu: 100 km\nĐã đạt: 72 km\nCòn lại: 28 km\nCập nhật: 2026-10-05 08:00 (Asia/Ho_Chi_Minh)",
  "disable_web_page_preview": true
}
```

`sendMessage` yêu cầu `chat_id` và `text`; text tối đa 4096 ký tự sau khi parse entities. Nếu function xử lý nhiều target, gửi từng message hoặc giới hạn tổng payload; không log token và không log toàn bộ response chứa dữ liệu riêng tư.

## Failure behavior và idempotency

Cloud Scheduler coi request không được acknowledge là thất bại và retry theo exponential backoff. Tạo `runKey` ổn định, chẳng hạn `${targetId}:${scheduledTime}`; ghi `notificationRuns/{runKey}` với trạng thái `pending/sent` và timestamp. Chỉ đánh dấu `sent` sau khi Telegram trả thành công. Vẫn tồn tại cửa sổ crash sau khi Telegram nhận message nhưng trước khi Firestore ghi `sent`, vì Telegram `sendMessage` không cung cấp idempotency key; do đó phải chấp nhận khả năng duplicate nhỏ hoặc chọn không retry để ưu tiên không trùng hơn không mất nhắc.

## Manual notification test

1. Tạo bot, nhắn `/start` cho bot và xác nhận `chat_id`; kiểm tra token bằng Bot API `getMe`.
2. Dùng payload trên để test `sendMessage` trực tiếp (token lấy từ biến môi trường local, không ghi vào shell history/source).
3. Deploy function + scheduler; trong Google Cloud Console mở job do Firebase tạo và chọn **Run now**, sau đó kiểm tra function logs và Telegram message. Việc này kiểm tra cả quyền scheduler → function, ADC → Firestore, Secret Manager binding và Telegram egress.
4. Tạo một target fixture trong Firestore với remaining đã biết; chạy lại job và đối chiếu message. Test thêm lỗi tạm thời/Telegram 4xx để xác minh retry, log và trạng thái `notificationRuns`.

## Xếp hạng và quyết định

1. **Firebase `onSchedule` — khuyến nghị.** Ít integration glue, timezone tốt, retry có sẵn, IAM cùng nơi với Firestore; phù hợp nhất với “Firebase stores data/no own backend”.
2. **Vercel Cron — phương án hai.** Chọn nếu triển khai chắc chắn trên Vercel và nhắc chỉ một lần/ngày; cần UTC conversion, `CRON_SECRET`, Firebase Admin secret và tự xử lý failure.
3. **Cloudflare Cron Trigger — phương án ba.** Free tier rộng và chạy được, nhưng OAuth/Firestore REST từ Worker và semantics retry làm tăng complexity không cần thiết.

## Câu hỏi chưa giải quyết

- Firebase project đã tồn tại chưa, đang ở Spark hay Blaze? Ai sở hữu billing account?
- Dữ liệu nằm trong Firestore hay Realtime Database; collection/field nào là nguồn của `remaining`?
- Một user hay nhiều user/targets? Mỗi user có timezone và Telegram chat riêng không?
- Chấp nhận duplicate message hiếm khi retry crash, hay ưu tiên không duplicate và chấp nhận bỏ lỡ khi lỗi?
- Người dùng muốn nhắc chính xác 08:00 hay chấp nhận độ trễ? Nếu cần nhiều giờ/user, một scheduled job theo user có thể vượt hạn mức; cần thiết kế job UTC + due filtering.

