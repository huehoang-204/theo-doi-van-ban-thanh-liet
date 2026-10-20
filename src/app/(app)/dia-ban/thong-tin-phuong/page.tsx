import type { Metadata } from "next";
import { Info } from "lucide-react";
import Link from "next/link";

import { WardProfileEditor } from "@/components/catalog/WardProfileEditor";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import {
  formatDate,
  formatDateTime,
  formatDecimal,
  formatNumber,
  formatPopulation,
} from "@/lib/format";
import { vi } from "@/lib/i18n/vi";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/server/auth/current-user";
import { getWardOverview } from "@/server/queries/catalog";

export const metadata: Metadata = { title: vi.nav.wardProfile };

/** Ngưỡng lệch giữa dân số nhập tay và tổng nhân khẩu các TDP (Mục 6.1) */
const POPULATION_MISMATCH = 0.05;

function Item({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-bold text-brand">{value}</dd>
      {sub && <dd className="mt-1 text-muted-foreground">{sub}</dd>}
    </div>
  );
}

export default async function WardProfilePage() {
  const user = await requirePermission("ward.view");
  const { profile, residentialCount, residentialPopulation, residentialHouseholds } =
    await getWardOverview();
  if (!profile)
    return (
      <EmptyState
        title="Chưa có thông tin phường"
        description="Quản trị viên cần chạy dữ liệu khởi tạo (seed)."
      />
    );

  const canEdit = can(user, "ward.update");
  const density = profile.areaKm2 > 0 ? profile.population / profile.areaKm2 : null;
  const mismatch =
    residentialPopulation > 0 &&
    Math.abs(profile.population - residentialPopulation) / profile.population > POPULATION_MISMATCH;

  return (
    <>
      <PageHeader
        title={vi.nav.wardProfile}
        description={`${profile.name} — ${profile.city}`}
        action={
          canEdit ? (
            <WardProfileEditor
              values={{
                name: profile.name,
                city: profile.city,
                areaKm2: profile.areaKm2,
                population: profile.population,
                populationIsEstimate: profile.populationIsEstimate,
                households: profile.households,
                establishedDate: profile.establishedDate,
                address: profile.address,
                phone: profile.phone,
              }}
            />
          ) : undefined
        }
      />

      {canEdit && mismatch && (
        <p
          role="status"
          className="mb-5 flex items-start gap-2 rounded-lg border border-status-due-soon/50 bg-status-due-soon/10 p-4 text-amber-900"
        >
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>
            Dân số nhập tay ({formatNumber(profile.population)}) lệch hơn 5% so với tổng nhân khẩu
            các tổ dân phố ({formatNumber(residentialPopulation)}). Bảng điều hành vẫn hiển thị số
            nhập tay. Ghi chú này chỉ quản trị viên thấy.
          </span>
        </p>
      )}

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Item label="Diện tích tự nhiên" value={`${formatDecimal(profile.areaKm2)} km²`} />
        <Item
          label="Dân số"
          value={`${formatPopulation(profile.population, profile.populationIsEstimate)} người`}
          sub={density !== null ? `Mật độ ≈ ${formatNumber(density)} người/km²` : undefined}
        />
        <Item
          label="Số hộ"
          value={profile.households !== null ? formatNumber(profile.households) : "Chưa có số liệu"}
        />
        <Item label="Ngày thành lập" value={formatDate(profile.establishedDate) || "—"} />
      </dl>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Trụ sở</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-muted-foreground">Địa chỉ</dt>
            <dd>{profile.address ?? "Chưa có"}</dd>
            <dt className="text-muted-foreground">Điện thoại</dt>
            <dd>{profile.phone ?? "Chưa có"}</dd>
          </dl>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Tổng hợp từ danh mục tổ dân phố</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-muted-foreground">Số tổ dân phố</dt>
            <dd>
              <Link
                href="/dia-ban/to-dan-pho"
                className="font-semibold text-brand underline-offset-4 hover:underline"
              >
                {formatNumber(residentialCount)}
              </Link>
            </dd>
            <dt className="text-muted-foreground">Tổng số hộ</dt>
            <dd>{formatNumber(residentialHouseholds)}</dd>
            <dt className="text-muted-foreground">Tổng nhân khẩu</dt>
            <dd>{formatNumber(residentialPopulation)}</dd>
          </dl>
        </div>
      </section>

      <p className="mt-6 text-muted-foreground">
        Số liệu cập nhật lúc {formatDateTime(profile.updatedAt)}
        {profile.updatedBy ? ` bởi ${profile.updatedBy.fullName}` : ""}.
      </p>
    </>
  );
}
