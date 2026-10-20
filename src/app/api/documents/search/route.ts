import { isSearchable } from "@/lib/search";
import { apiUser } from "@/server/auth/api";
import { revealNodes, searchDocuments } from "@/server/documents/queries";

// GET /api/documents/search?q=&linhVuc=&hieuLuc=&loai=&gioiHan=&mo=1
// Tìm không dấu theo từng từ; mo=1 trả kèm dữ liệu để cây tự mở tới các kết quả.
export async function GET(request: Request) {
  const user = await apiUser("document.list");
  if (user instanceof Response) return user;
  const p = new URL(request.url).searchParams;
  const q = (p.get("q") ?? "").trim();
  const filters = {
    q: isSearchable(q) ? q : undefined,
    fieldId: p.get("linhVuc") || undefined,
    validity: p.get("hieuLuc") || undefined,
    typeId: p.get("loai") || undefined,
    limit: Number(p.get("gioiHan")) || 50,
  };
  const { hits, truncated } = await searchDocuments(user, filters);
  const reveal =
    p.get("mo") === "1" && hits.length > 0
      ? await revealNodes(
          user,
          hits.map((h) => h.id),
        )
      : null;
  return Response.json({ hits, truncated, reveal });
}
