// Cột thông tin bên phải trang văn bản (GĐ5b): ban hành bởi, các ngày, người nhận, người theo dõi,
// đã xem, đã tải tệp, thông tin thêm — bố cục như hệ thống văn bản điều hành.
import { Building2, Globe2, Users } from "lucide-react";

import { formatDate, formatDateTime } from "@/lib/format";
import type { DocumentSocial } from "@/server/documents/social";

import { Avatar, AvatarStack } from "./DocumentPeople";
import { FollowButton } from "./FollowButton";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b pb-4 last:border-b-0 last:pb-0">
      <h3 className="mb-2 font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Pair({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">
        {value || <span className="text-muted-foreground">Chưa xác định</span>}
      </dd>
    </div>
  );
}

const at = (d?: Date) => (d ? formatDateTime(d) : undefined);

export function DocumentSidebar({
  docId,
  social,
  doc,
}: {
  docId: string;
  social: DocumentSocial;
  doc: {
    typeName: string;
    agency: string | null;
    issuedDate: Date | null;
    effectiveDate: Date | null;
    dueDate: Date | null;
    createdBy: string;
    createdAt: Date;
  };
}) {
  const r = social.recipients;
  const people = (list: DocumentSocial["viewers"]) =>
    list.map((p) => ({ id: p.id, fullName: p.fullName, detail: p.detail, at: at(p.at) }));
  return (
    <aside
      aria-label="Thông tin văn bản"
      className="flex flex-col gap-4 rounded-xl border bg-card p-4 text-[0.9375rem]"
    >
      <Block title="Ban hành">
        {social.published ? (
          <dl>
            <Pair label="Ban hành bởi" value={social.published.by?.fullName} />
            {social.published.by?.detail && (
              <p className="text-right text-sm text-muted-foreground">
                {social.published.by.detail}
              </p>
            )}
            <Pair label="Lúc" value={formatDateTime(social.published.at)} />
          </dl>
        ) : (
          <p className="text-muted-foreground">Chưa ban hành / gửi tới ai.</p>
        )}
        <dl className="mt-2">
          <Pair label="Cơ quan ban hành" value={doc.agency} />
          <Pair label="Ngày ban hành" value={formatDate(doc.issuedDate)} />
          <Pair label="Ngày có hiệu lực" value={formatDate(doc.effectiveDate)} />
          <Pair label="Hạn xử lý" value={formatDate(doc.dueDate)} />
          <Pair label="Loại văn bản" value={doc.typeName} />
        </dl>
      </Block>

      {social.published && (
        <Block title={`Người nhận (${r.total})`}>
          <p className="mb-2 text-sm text-muted-foreground">
            {r.viewed}/{r.total} người nhận đã xem
          </p>
          <ul className="flex flex-col gap-2">
            {r.all && (
              <li className="flex items-center gap-2">
                <Globe2 className="size-5 text-brand" aria-hidden />
                <span className="font-medium">Toàn phường</span>
              </li>
            )}
            {r.departments.map((d) => (
              <li key={d.id} className="flex items-center gap-2">
                <Building2 className="size-5 shrink-0 text-brand" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{d.name}</span>
                  <span className="text-sm text-muted-foreground">{d.count} thành viên</span>
                </span>
              </li>
            ))}
            {r.users.slice(0, 5).map((u) => (
              <li key={u.id} className="flex items-center gap-2">
                <Avatar name={u.fullName} className="size-7 text-[0.6875rem]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{u.fullName}</span>
                  {u.detail && (
                    <span className="block truncate text-sm text-muted-foreground">{u.detail}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {r.users.length > 5 && (
            <details className="mt-1 text-sm">
              <summary className="cursor-pointer text-brand">
                Xem thêm ({r.users.length - 5})
              </summary>
              <ul className="mt-1 flex flex-col gap-1">
                {r.users.slice(5).map((u) => (
                  <li key={u.id}>{u.fullName}</li>
                ))}
              </ul>
            </details>
          )}
        </Block>
      )}

      <Block title={`Người theo dõi (${social.followers.length})`}>
        {social.followers.length > 0 && (
          <ul className="mb-3 flex flex-col gap-2">
            {social.followers.slice(0, 6).map((f) => (
              <li key={f.id} className="flex items-center gap-2">
                <Avatar name={f.fullName} className="size-7 text-[0.6875rem]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{f.fullName}</span>
                  {f.detail && (
                    <span className="block truncate text-sm text-muted-foreground">{f.detail}</span>
                  )}
                </span>
              </li>
            ))}
            {social.followers.length > 6 && (
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="size-4" aria-hidden />
                và {social.followers.length - 6} người khác
              </li>
            )}
          </ul>
        )}
        <FollowButton id={docId} following={social.following} />
      </Block>

      <Block title={`Đã xem (${social.viewers.length})`}>
        <AvatarStack label="Đã xem" people={people(social.viewers)} />
      </Block>

      <Block title={`Đã tải tệp đính kèm (${social.downloaders.length})`}>
        <AvatarStack label="Đã tải tệp" people={people(social.downloaders)} />
      </Block>

      <Block title="Thông tin thêm">
        <dl>
          <Pair label="Người tạo" value={doc.createdBy} />
          <Pair label="Ngày tạo" value={formatDateTime(doc.createdAt)} />
        </dl>
      </Block>
    </aside>
  );
}
