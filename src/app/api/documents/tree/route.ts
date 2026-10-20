import { db } from "@/lib/db";
import { apiUser } from "@/server/auth/api";
import { listAllNodes, listChildren, revealNodes } from "@/server/documents/queries";

// GET /api/documents/tree?cha=<id>      con trực tiếp (trống = cấp 1) — tải lười theo nhánh
// GET /api/documents/tree?mo=<id,id>    cấp 1 + con của mọi tổ tiên để mở sẵn tới các nút
// GET /api/documents/tree?tatCa=1       mọi nút được thấy (nút "Mở tất cả")
// GET /api/documents/tree?demNhanh=<id> số văn bản con/cháu (để báo trước khi xoá cả nhánh)
export async function GET(request: Request) {
  const user = await apiUser("document.list");
  if (user instanceof Response) return user;
  const params = new URL(request.url).searchParams;

  const countOf = params.get("demNhanh");
  if (countOf) {
    const node = await db.documentNode.findUnique({
      where: { id: countOf },
      select: { path: true },
    });
    const count = node
      ? await db.documentNode.count({
          where: { path: { startsWith: node.path }, NOT: { id: countOf }, deletedAt: null },
        })
      : 0;
    return Response.json({ count });
  }
  if (params.get("tatCa") === "1") return Response.json(await listAllNodes(user));
  const reveal = params.get("mo");
  if (reveal) return Response.json(await revealNodes(user, reveal.split(",").filter(Boolean)));
  return Response.json({ nodes: await listChildren(user, params.get("cha") || null) });
}
