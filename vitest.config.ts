import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    environment: "node",
    // Tính hạn theo giờ Việt Nam — test phải chạy cùng múi giờ với production.
    env: { TZ: "Asia/Ho_Chi_Minh" },
  },
});
