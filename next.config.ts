import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Thư mục cha /hdd3/huehp có package-lock.json khác → chỉ định gốc dự án.
  turbopack: { root: import.meta.dirname },
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  // Chỉ báo dev của Next mặc định ở góc trái dưới, che nút thu gọn thanh bên.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
