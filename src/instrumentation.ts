// Next gọi register() một lần khi máy chủ khởi động.
// WORKER_INLINE=1 (Render — một service duy nhất): chạy lịch job ngay trong tiến trình web
// thay cho `npm run worker`. KHÔNG bật khi đã chạy worker riêng, kẻo job chạy hai lần.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.WORKER_INLINE !== "1") return;
  const [{ db }, { startScheduler }] = await Promise.all([
    import("@/lib/db"),
    import("@/worker/scheduler"),
  ]);
  // Không chờ chạy bù — máy chủ nhận request ngay
  startScheduler(db).catch((e) => console.error("[worker] Không khởi động được lịch job:", e));
}
