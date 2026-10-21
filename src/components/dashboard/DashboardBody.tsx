"use client";

import {
  Backpack,
  CheckCheck,
  CircleAlert,
  Flag,
  Hourglass,
  Map as MapIcon,
  School,
  Search,
  Star,
  TriangleAlert,
  Users,
  UsersRound,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { DueText, StatusBadge } from "@/components/common/StatusBadge";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatDecimal, formatNumber, formatPopulation } from "@/lib/format";
import { normalizeForSearch } from "@/lib/text";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/server/dashboard/data";

import { HBarChart, Panel, SectionHeading, StatTile, StatusTile } from "./parts";

const n = formatNumber;

type Props = {
  data: DashboardData;
  onSchoolYearChange?: (year: string) => void;
  loadingYear?: boolean;
  /** Chế độ trình chiếu: bỏ bảng dài, ưu tiên con số */
  present?: boolean;
};

export function DashboardBody({ data, onSchoolYearChange, loadingYear, present }: Props) {
  const showArea = data.view !== "officer";
  return (
    <div className="flex flex-col gap-8">
      <WardSection data={data} compact={data.view === "officer"} />
      {data.operations && <OperationsSection ops={data.operations} present={present} />}
      {data.myWork && <MyWorkSection work={data.myWork} />}
      {/* ≥ 1536px: 3 cột; 1280–1535px: Giáo dục + Đảng cạnh nhau, Tổ dân phố cả hàng bên dưới */}
      {showArea && (
        <div className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-3">
          <EducationPanel
            data={data}
            onSchoolYearChange={onSchoolYearChange}
            loading={loadingYear}
            present={present}
          />
          <PartyPanel data={data} />
          <ResidentialPanel data={data} present={present} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- ① Số liệu địa bàn

function WardSection({ data, compact }: { data: DashboardData; compact: boolean }) {
  const { ward, residential, party, education } = data;
  const year = encodeURIComponent(education.schoolYear);
  const tiles = [
    <StatTile
      key="area"
      testId="tile-area"
      href="/dia-ban/thong-tin-phuong"
      icon={MapIcon}
      label="Diện tích"
      value={ward ? formatDecimal(ward.areaKm2) : "—"}
      unit="km²"
      updatedAt={ward?.updatedAt}
    />,
    <StatTile
      key="pop"
      testId="tile-population"
      href="/dia-ban/thong-tin-phuong"
      icon={Users}
      label="Dân số"
      value={ward ? formatPopulation(ward.population, ward.populationIsEstimate) : "—"}
      unit="người"
      sub={ward?.density ? `Mật độ ≈ ${n(ward.density)} người/km²` : undefined}
      updatedAt={ward?.updatedAt}
    />,
    <StatTile
      key="tdp"
      testId="tile-residentials"
      href="/dia-ban/to-dan-pho"
      icon={Warehouse}
      label="Tổ dân phố"
      value={n(residential.count)}
      unit="TDP"
      sub={`${n(residential.households)} hộ · ${n(residential.population)} nhân khẩu`}
      updatedAt={residential.updatedAt}
    />,
    <StatTile
      key="org"
      testId="tile-party-orgs"
      href="/dia-ban/to-chuc-dang"
      icon={Flag}
      label="Tổ chức đảng"
      value={n(party.orgs.value)}
      unit="trực thuộc"
      note={party.orgs.overridden ? "Số nhập tay" : undefined}
      updatedAt={party.updatedAt}
    />,
    <StatTile
      key="cell"
      testId="tile-party-cells"
      href="/dia-ban/to-chuc-dang?loai=chi-bo"
      icon={UsersRound}
      label="Chi bộ"
      value={n(party.cells.value)}
      unit="chi bộ"
      note={party.cells.overridden ? "Số nhập tay" : undefined}
      updatedAt={party.updatedAt}
    />,
    <StatTile
      key="mem"
      testId="tile-party-members"
      href="/dia-ban/to-chuc-dang"
      icon={Star}
      label="Đảng viên"
      value={n(party.members.value)}
      unit="đảng viên"
      note={party.members.overridden ? "Số nhập tay" : undefined}
      updatedAt={party.updatedAt}
    />,
    <StatTile
      key="school"
      testId="tile-schools"
      href={`/dia-ban/truong-hoc?namHoc=${year}`}
      icon={School}
      label="Trường học"
      value={n(education.schoolCount)}
      unit="trường"
      updatedAt={education.updatedAt}
    />,
    <StatTile
      key="students"
      testId="tile-students"
      href={`/dia-ban/truong-hoc?namHoc=${year}`}
      icon={Backpack}
      label="Học sinh"
      value={n(education.students)}
      unit="HS"
      sub={`CB-GV-NV: ${n(education.staff)} · năm học ${education.schoolYear}`}
      updatedAt={education.updatedAt}
    />,
  ];
  return (
    <section aria-label="Số liệu địa bàn">
      <SectionHeading title="Số liệu địa bàn" />
      {/* < 640px: 1 cột để số 38px không tràn thẻ */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {compact ? tiles.slice(0, 4) : tiles}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- ② Tình hình thực hiện nhiệm vụ

function OperationsSection({
  ops,
  present,
}: {
  ops: NonNullable<DashboardData["operations"]>;
  present?: boolean;
}) {
  return (
    <section aria-label="Tình hình thực hiện nhiệm vụ">
      <SectionHeading title="Tình hình thực hiện nhiệm vụ" note="Công việc đang theo dõi" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatusTile
          testId="ops-overdue"
          href="/cong-viec?trangThai=QUA_HAN"
          icon={CircleAlert}
          color="var(--status-overdue)"
          value={ops.tasks.overdue}
          label="Quá hạn"
        />
        <StatusTile
          testId="ops-due-soon"
          href="/cong-viec?trangThai=SAP_DEN_HAN"
          icon={TriangleAlert}
          color="var(--status-due-soon)"
          value={ops.tasks.dueSoon}
          label="Sắp đến hạn"
        />
        <StatusTile
          testId="ops-in-progress"
          href="/cong-viec?trangThai=DANG_LAM"
          icon={Hourglass}
          color="var(--status-in-progress)"
          value={ops.tasks.inProgress}
          label="Đang làm"
        />
        <StatusTile
          testId="ops-done"
          href="/cong-viec?trangThai=XONG"
          icon={CheckCheck}
          color="var(--status-done)"
          value={ops.tasks.done}
          label="Đã hoàn thành"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel
          title="Báo cáo cần nộp trong 14 ngày tới"
          action={{ href: "/bao-cao?trongNgay=14", label: `Xem tất cả (${ops.reports.length})` }}
        >
          {ops.reports.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">
              Không có báo cáo nào đến hạn trong 14 ngày tới.
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {ops.reports.slice(0, present ? 6 : 8).map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/bao-cao?yeuCau=${r.requirementId}` as never}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="min-w-0 flex-1 basis-60">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {r.label} · {r.department}
                      </span>
                    </span>
                    <span className="flex flex-col items-end text-sm whitespace-nowrap">
                      <span>Hạn {r.dueDate}</span>
                      <DueText daysLeft={r.daysLeft} status={r.status} />
                    </span>
                    <StatusBadge status={r.status} context="report" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Tiến độ các chương trình"
          action={{ href: "/van-ban", label: "Cây văn bản" }}
          footer="Xếp theo tiến độ tăng dần — chương trình chậm nhất ở trên."
        >
          {ops.programs.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">Chưa có chương trình nào.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {ops.programs.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/van-ban/${p.id}` as never}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-3 rounded-md px-1 py-2 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {p.hasOverdue && (
                        <span
                          className="size-2.5 shrink-0 rounded-full bg-status-overdue"
                          aria-label="Có việc quá hạn"
                          title="Có việc quá hạn"
                        />
                      )}
                      <span className="truncate">{p.title}</span>
                    </span>
                    <span className="font-semibold tabular-nums">
                      {p.progress === null ? "—" : `${p.progress}%`}
                    </span>
                    <span
                      className="col-span-2 mt-1 h-2 overflow-hidden rounded-full bg-muted"
                      aria-hidden
                    >
                      <span
                        className="block h-full rounded-full bg-brand"
                        style={{ width: `${p.progress ?? 0}%` }}
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Việc quá hạn theo đơn vị"
          action={{ href: "/cong-viec?trangThai=QUA_HAN", label: "Danh sách việc quá hạn" }}
        >
          <HBarChart
            label="Việc quá hạn theo đơn vị chủ trì"
            unit="việc"
            color="var(--status-overdue)"
            data={ops.overdueByDepartment.map((d) => ({
              key: d.departmentId || "none",
              label: d.name,
              value: d.count,
              href: d.departmentId
                ? `/cong-viec?trangThai=QUA_HAN&donVi=${d.departmentId}`
                : "/cong-viec?trangThai=QUA_HAN",
            }))}
          />
        </Panel>

        <Panel
          title="Văn bản mới ban hành"
          action={{ href: "/van-ban/danh-sach", label: "Tất cả văn bản" }}
        >
          {ops.newDocuments.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">Chưa có văn bản.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {ops.newDocuments.slice(0, present ? 6 : 10).map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/van-ban/${d.id}` as never}
                    className="flex items-center gap-3 py-2 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="w-24 shrink-0 text-sm text-muted-foreground tabular-nums">
                      {d.issuedDate}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {d.number && <strong className="font-semibold">{d.number} </strong>}
                      {d.title}
                    </span>
                    <span
                      className="hidden shrink-0 rounded px-2 py-0.5 text-sm text-white sm:inline"
                      style={{ backgroundColor: d.color }}
                    >
                      {d.type}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Cán bộ: "Việc của tôi" thay khối ②

function MyWorkSection({ work }: { work: NonNullable<DashboardData["myWork"]> }) {
  return (
    <section aria-label="Việc của tôi">
      <SectionHeading
        title="Việc của tôi"
        note={work.awaitingApproval ? `${work.awaitingApproval} việc chờ tôi duyệt` : undefined}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatusTile
          href="/viec-cua-toi"
          icon={CircleAlert}
          color="var(--status-overdue)"
          value={work.overdue}
          label="Quá hạn"
        />
        <StatusTile
          href="/viec-cua-toi"
          icon={TriangleAlert}
          color="var(--status-due-soon)"
          value={work.dueSoon}
          label="Sắp đến hạn"
        />
        <StatusTile
          href="/viec-cua-toi"
          icon={Hourglass}
          color="var(--status-in-progress)"
          value={work.inProgress}
          label="Đang làm"
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- ③ Giáo dục

function EducationPanel({
  data,
  onSchoolYearChange,
  loading,
  present,
}: {
  data: DashboardData;
  onSchoolYearChange?: (y: string) => void;
  loading?: boolean;
  present?: boolean;
}) {
  const e = data.education;
  const year = encodeURIComponent(e.schoolYear);
  return (
    <section aria-label="Giáo dục" className="flex min-w-0 flex-col gap-4">
      <SectionHeading
        title="Giáo dục"
        note={e.updatedAt ? `Cập nhật ngày ${e.updatedAt}` : undefined}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground">
          <strong className="text-foreground">{n(e.staff)}</strong> CB-GV-NV ·{" "}
          <strong className="text-foreground">{n(e.students)}</strong> học sinh
        </p>
        {onSchoolYearChange ? (
          <label className="flex items-center gap-2 font-medium">
            Năm học
            <NativeSelect
              value={e.schoolYear}
              onChange={(ev) => onSchoolYearChange(ev.target.value)}
              aria-label="Chọn năm học"
              disabled={loading}
            >
              {e.schoolYears.map((y) => (
                <NativeSelectOption key={y} value={y}>
                  {y}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        ) : (
          <span className="font-medium">Năm học {e.schoolYear}</span>
        )}
      </div>
      <Panel title="Số trường theo cấp học">
        <HBarChart
          label="Số trường theo cấp học"
          unit="trường"
          data={e.byLevel.map((l) => ({
            key: l.level,
            label: l.label,
            value: l.count,
            href: `/dia-ban/truong-hoc?capHoc=${l.level}&namHoc=${year}`,
          }))}
        />
      </Panel>
      {!present && (
        <Panel
          title="Quy mô các trường"
          action={{ href: `/dia-ban/truong-hoc?namHoc=${year}`, label: "Danh mục trường" }}
        >
          <div className={cn("max-h-80 overflow-auto", loading && "opacity-60")}>
            <table className="w-full text-table">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b text-left text-muted-foreground">
                  <th scope="col" className="py-2 pr-2 font-medium">
                    Tên trường
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium whitespace-nowrap">
                    CB-GV-NV
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">
                    HS
                  </th>
                  <th scope="col" className="py-2 pl-2 text-right font-medium">
                    Lớp
                  </th>
                </tr>
              </thead>
              <tbody>
                {e.schools.map((s) => (
                  <tr key={s.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-2">
                      <Link
                        href={`/dia-ban/truong-hoc?namHoc=${year}` as never}
                        className="hover:text-brand hover:underline"
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {s.staff === null ? "—" : n(s.staff)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {s.students === null ? "—" : n(s.students)}
                    </td>
                    <td className="py-2 pl-2 text-right tabular-nums">
                      {s.classes === null ? "—" : n(s.classes)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-brand-soft font-semibold">
                <tr>
                  <td className="py-2 pr-2">Tổng {n(e.schoolCount)} trường</td>
                  <td className="px-2 py-2 text-right tabular-nums">{n(e.staff)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{n(e.students)}</td>
                  <td className="py-2 pl-2 text-right tabular-nums">{n(e.classes)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Panel>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- ④ Xây dựng Đảng

function PartyPanel({ data }: { data: DashboardData }) {
  const p = data.party;
  return (
    <section aria-label="Xây dựng Đảng" className="flex min-w-0 flex-col gap-4">
      <SectionHeading
        title="Xây dựng Đảng"
        note={p.updatedAt ? `Cập nhật ngày ${p.updatedAt}` : undefined}
      />
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/dia-ban/to-chuc-dang?loai=chi-bo"
          className="rounded-xl border bg-card p-4 shadow-sm hover:border-brand/50"
        >
          <span className="block text-muted-foreground">Chi bộ</span>
          <span className="text-3xl font-bold tabular-nums">{n(p.cells.value)}</span>
        </Link>
        <Link
          href="/dia-ban/to-chuc-dang"
          className="rounded-xl border bg-card p-4 shadow-sm hover:border-brand/50"
        >
          <span className="block text-muted-foreground">Đảng viên</span>
          <span className="text-3xl font-bold tabular-nums">{n(p.members.value)}</span>
        </Link>
      </div>
      <Panel title="Chi bộ theo khối">
        <HBarChart
          label="Số chi bộ theo khối"
          unit="chi bộ"
          data={p.cellsByBlock.map((b) => ({
            key: b.block,
            label: b.label,
            value: b.count,
            href: `/dia-ban/to-chuc-dang?loai=chi-bo&khoi=${b.block}`,
          }))}
        />
      </Panel>
      <Panel
        title="5 chi bộ đông đảng viên nhất"
        action={{ href: "/dia-ban/to-chuc-dang", label: "Danh mục tổ chức đảng" }}
      >
        <ol className="flex flex-col divide-y">
          {p.topCells.map((c, i) => (
            <li key={c.id}>
              <Link
                href={`/dia-ban/to-chuc-dang?loai=chi-bo` as never}
                className="flex items-center gap-3 py-2 hover:bg-muted/60"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="font-semibold tabular-nums">{n(c.memberCount)}</span>
              </Link>
            </li>
          ))}
        </ol>
      </Panel>
    </section>
  );
}

// ---------------------------------------------------------------- ⑤ Tổ dân phố

function ResidentialPanel({ data, present }: { data: DashboardData; present?: boolean }) {
  const r = data.residential;
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = normalizeForSearch(query);
    return q
      ? r.list.filter((x) => normalizeForSearch(`${x.name} ${x.oldArea ?? ""}`).includes(q))
      : r.list;
  }, [r.list, query]);
  return (
    <section
      aria-label="Tổ dân phố"
      className="flex min-w-0 flex-col gap-4 xl:col-span-2 2xl:col-span-1"
    >
      <SectionHeading
        title="Tổ dân phố"
        note={r.updatedAt ? `Cập nhật ngày ${r.updatedAt}` : undefined}
      />
      <p className="text-muted-foreground">
        <strong className="text-foreground">{n(r.count)}</strong> TDP ·{" "}
        <strong className="text-foreground">{n(r.households)}</strong> hộ ·{" "}
        <strong className="text-foreground">{n(r.population)}</strong> nhân khẩu
      </p>
      <div className="grid items-start gap-4 xl:grid-cols-2 2xl:grid-cols-1">
        <Panel title="Nhân khẩu theo khu vực cũ">
          <HBarChart
            label="Nhân khẩu theo khu vực trước sáp nhập"
            unit="người"
            data={r.byOldArea.map((a) => ({
              key: a.id,
              label: a.name,
              value: a.population,
              href: `/dia-ban/to-dan-pho?khuVuc=${a.id}`,
            }))}
          />
        </Panel>
        {!present && (
          <Panel
            title="Danh sách tổ dân phố"
            action={{ href: "/dia-ban/to-dan-pho", label: "Danh mục TDP" }}
          >
            <div className="relative mb-2">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm tổ dân phố…"
                aria-label="Tìm tổ dân phố"
                className="h-10 pl-9"
              />
            </div>
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-table">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-left text-muted-foreground">
                    <th scope="col" className="py-2 pr-2 font-medium">
                      TDP
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">
                      Hộ
                    </th>
                    <th scope="col" className="py-2 pl-2 text-right font-medium">
                      Nhân khẩu
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((x) => (
                    <tr key={x.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-2">
                        <Link
                          href="/dia-ban/to-dan-pho"
                          className="hover:text-brand hover:underline"
                        >
                          {x.name}
                        </Link>
                        {x.oldArea && (
                          <span className="block text-sm text-muted-foreground">{x.oldArea}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {x.households === null ? "—" : n(x.households)}
                      </td>
                      <td className="py-2 pl-2 text-right tabular-nums">
                        {x.population === null ? "—" : n(x.population)}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-muted-foreground">
                        Không tìm thấy.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>
    </section>
  );
}
