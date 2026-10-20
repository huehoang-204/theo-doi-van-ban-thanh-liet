import { db } from "@/lib/db";

// Kiểm tra sống cho giám sát/triển khai: app chạy + kết nối được CSDL.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", db: "ok" });
  } catch {
    return Response.json({ status: "error", db: "unreachable" }, { status: 503 });
  }
}
