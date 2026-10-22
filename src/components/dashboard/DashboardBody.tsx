"use client";

// Bảng điều hành (Mục 7, thiết kế lại 22/10/2026 theo yêu cầu "gọn, nhiều biểu đồ"):
//  A. Địa bàn — 8 thẻ số gọn (1 hàng ≥ 1536px), "Cập nhật ngày …" ghi ở tiêu đề khối
//  B. Điều hành — cơ cấu công việc theo trạng thái, xu hướng 6 tháng, nộp báo cáo theo tháng,
//     việc quá hạn theo đơn vị, tiến độ chương trình (danh sách chi tiết ở trang Theo dõi báo cáo / Mới ban hành)
//  C. Lĩnh vực — 3 biểu đồ (học sinh theo cấp, chi bộ theo khối, nhân khẩu theo khu vực cũ), không bảng dài
import {
  Backpack,
  CheckCheck,
  CircleAlert,
  Flag,
  Hourglass,
  Map as MapIcon,
  School,
  Star,
  TriangleAlert,
  Users,
  UsersRound,
  Warehouse,
} from "lucide-react";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatDecimal, formatNumber, formatPopulation } from "@/lib/format";
import type { DashboardData } from "@/server/dashboard/data";

import { ProgressMeters, ReportMonthsChart, StatusBreakdown, TrendChart } from "./charts";
import { HBarChart, Panel, SectionHeading, StatTile, StatusTile } from "./parts";

const n = formatNumber;

type Props = {
  data: DashboardData;
  onSchoolYearChange?: (year: string) => void;
  loadingYear?: boolean;
  /** Chế độ trình chiếu: bỏ danh sách, ưu tiên con số và biểu đồ */
  present?: boolean;
};

/** Ngày mới nhất trong các mốc "dd/mm/yyyy" */
function latestDay(days: (string | null | undefined)[]): string | null {
  const key = (d: string) => d.split("/").reverse().join("");
  return (
    days.filter((d): d is string => !!d).sort((a, b) => key(b).localeCompare(key(a)))[0] ?? null
  );
}

export function DashboardBody({ data, onSchoolYearChange, loadingYear, present }: Props) {
  const showArea = data.view !== "officer";
  return (
    <div className="flex flex-col gap-8">
      <WardSection data={data} compact={data.view === "officer"} />
      {data.operations && <OperationsSection ops={data.operations} present={present} />}
      {data.myWork && <MyWorkSection work={data.myWork} />}
      {showArea && (
        <section aria-label="Lĩnh vực">
          <SectionHeading title="Lĩnh vực" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <EducationPanel
              data={data}
              onSchoolYearChange={onSchoolYearChange}
              loading={loadingYear}
            />
            <PartyPanel data={data} />
            <ResidentialPanel data={data} />
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- A. Số liệu địa bàn

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
      sub={party.orgs.overridden ? "Số nhập tay" : undefined}
      updatedAt={party.updatedAt}
    />,
    <StatTile
      key="cell"
      testId="tile-party-cells"
      href="/dia-ban/to-chuc-dang?loai=chi-bo"
      icon={UsersRound}
      label="Chi bộ"
      value={n(party.cells.value)}
      sub={party.cells.overridden ? "Số nhập tay" : undefined}
      updatedAt={party.updatedAt}
    />,
    <StatTile
      key="mem"
      testId="tile-party-members"
      href="/dia-ban/to-chuc-dang"
      icon={Star}
      label="Đảng viên"
      value={n(party.members.value)}
      sub={party.members.overridden ? "Số nhập tay" : undefined}
      updatedAt={party.updatedAt}
    />,
    <StatTile
      key="school"
      testId="tile-schools"
      href={`/dia-ban/truong-hoc?namHoc=${year}`}
      icon={School}
      label="Trường học"
      value={n(education.schoolCount)}
      updatedAt={education.updatedAt}
    />,
    <StatTile
      key="students"
      testId="tile-students"
      href={`/dia-ban/truong-hoc?namHoc=${year}`}
      icon={Backpack}
      label="Học sinh"
      value={n(education.students)}
      sub={`CB-GV-NV: ${n(education.staff)} · năm học ${education.schoolYear}`}
      updatedAt={education.updatedAt}
    />,
  ];
  const updated = latestDay([
    ward?.updatedAt,
    residential.updatedAt,
    party.updatedAt,
    education.updatedAt,
  ]);
  return (
    <section aria-label="Số liệu địa bàn">
      <SectionHeading
        title="Số liệu địa bàn"
        note={updated ? `Cập nhật ngày ${updated}` : undefined}
      />
      <div
        className={
          compact
            ? "grid grid-cols-2 gap-3 lg:grid-cols-4"
            : "grid grid-cols-2 gap-3 md:grid-cols-4"
        }
      >
        {compact ? tiles.slice(0, 4) : tiles}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- B. Tình hình thực hiện nhiệm vụ

function OperationsSection({
  ops,
  present,
}: {
  ops: NonNullable<DashboardData["operations"]>;
  present?: boolean;
}) {
  return (
    <section aria-label="Tình hình thực hiện nhiệm vụ">
      <SectionHeading
        title="Tình hình thực hiện nhiệm vụ"
        note="Công việc và báo cáo đang theo dõi"
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel
          title="Công việc theo trạng thái"
          action={{ href: "/cong-viec", label: "Danh sách" }}
        >
          <StatusBreakdown
            unit="việc"
            parts={[
              {
                key: "overdue",
                label: "Quá hạn",
                value: ops.tasks.overdue,
                color: "var(--status-overdue)",
                icon: CircleAlert,
                href: "/cong-viec?trangThai=QUA_HAN",
                testId: "ops-overdue",
              },
              {
                key: "dueSoon",
                label: "Sắp đến hạn",
                value: ops.tasks.dueSoon,
                color: "var(--status-due-soon)",
                icon: TriangleAlert,
                href: "/cong-viec?trangThai=SAP_DEN_HAN",
                testId: "ops-due-soon",
              },
              {
                key: "inProgress",
                label: "Đang làm",
                value: ops.tasks.inProgress,
                color: "var(--status-in-progress)",
                icon: Hourglass,
                href: "/cong-viec?trangThai=DANG_LAM",
                testId: "ops-in-progress",
              },
              {
                key: "done",
                label: "Đã hoàn thành",
                value: ops.tasks.done,
                color: "var(--status-done)",
                icon: CheckCheck,
                href: "/cong-viec?trangThai=XONG",
                testId: "ops-done",
              },
            ]}
          />
        </Panel>

        <Panel title="Giao mới và hoàn thành — 6 tháng" className="xl:col-span-2">
          <TrendChart data={ops.trend} />
        </Panel>

        <Panel
          title="Nộp báo cáo theo tháng của hạn nộp"
          action={{
            href: "/bao-cao?trongNgay=14",
            label: `Cần nộp trong 14 ngày (${ops.reports.length})`,
          }}
          className="xl:col-span-2"
        >
          <ReportMonthsChart data={ops.reportMonths} />
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel
            title="Việc quá hạn theo đơn vị"
            action={{ href: "/cong-viec?trangThai=QUA_HAN", label: "Xem tất cả" }}
          >
            {ops.overdueByDepartment.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">Không có việc quá hạn.</p>
            ) : (
              <HBarChart
                label="Việc quá hạn theo đơn vị chủ trì"
                unit="việc"
                color="var(--status-overdue)"
                data={ops.overdueByDepartment.slice(0, 5).map((d) => ({
                  key: d.departmentId || "none",
                  label: d.name,
                  value: d.count,
                  href: d.departmentId
                    ? `/cong-viec?trangThai=QUA_HAN&donVi=${d.departmentId}`
                    : "/cong-viec?trangThai=QUA_HAN",
                }))}
              />
            )}
          </Panel>
          <Panel title="Tiến độ chương trình" action={{ href: "/van-ban", label: "Cây văn bản" }}>
            <ProgressMeters items={ops.programs.slice(0, present ? 3 : 4)} />
          </Panel>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Cán bộ: "Việc của tôi" thay khối B

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

// ---------------------------------------------------------------- C. Lĩnh vực

function Summary({ items }: { items: [string, string][] }) {
  return (
    <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
      {items.map(([value, label]) => (
        <span key={label}>
          <strong className="text-lg text-foreground">{value}</strong> {label}
        </span>
      ))}
    </p>
  );
}

function EducationPanel({
  data,
  onSchoolYearChange,
  loading,
}: {
  data: DashboardData;
  onSchoolYearChange?: (y: string) => void;
  loading?: boolean;
}) {
  const e = data.education;
  const year = encodeURIComponent(e.schoolYear);
  return (
    <Panel
      title="Giáo dục"
      action={{ href: `/dia-ban/truong-hoc?namHoc=${year}`, label: "Danh mục" }}
      footer={e.updatedAt ? `Cập nhật ngày ${e.updatedAt}` : undefined}
    >
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <Summary
          items={[
            [n(e.schoolCount), "trường"],
            [n(e.students), "học sinh"],
            [n(e.staff), "CB-GV-NV"],
          ]}
        />
        {onSchoolYearChange ? (
          <label className="mb-3 flex items-center gap-2 font-medium">
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
          <span className="mb-3 font-medium">Năm học {e.schoolYear}</span>
        )}
      </div>
      <p className="mb-1 text-sm font-medium text-muted-foreground">Học sinh theo cấp học</p>
      <HBarChart
        label={`Học sinh theo cấp học, năm học ${e.schoolYear}`}
        unit="học sinh"
        data={e.studentsByLevel.map((l) => ({
          key: l.level,
          label: l.label,
          value: l.students,
          href: `/dia-ban/truong-hoc?capHoc=${l.level}&namHoc=${year}`,
        }))}
      />
    </Panel>
  );
}

function PartyPanel({ data }: { data: DashboardData }) {
  const p = data.party;
  return (
    <Panel
      title="Xây dựng Đảng"
      action={{ href: "/dia-ban/to-chuc-dang", label: "Danh mục" }}
      footer={p.updatedAt ? `Cập nhật ngày ${p.updatedAt}` : undefined}
    >
      <Summary
        items={[
          [n(p.cells.value), "chi bộ"],
          [n(p.members.value), "đảng viên"],
        ]}
      />
      <p className="mb-1 text-sm font-medium text-muted-foreground">Chi bộ theo khối</p>
      <HBarChart
        label="Chi bộ theo khối"
        unit="chi bộ"
        data={p.cellsByBlock
          .filter((b) => b.count > 0)
          .map((b) => ({
            key: b.block,
            label: b.label,
            value: b.count,
            href: `/dia-ban/to-chuc-dang?loai=chi-bo&khoi=${b.block}`,
          }))}
      />
    </Panel>
  );
}

function ResidentialPanel({ data }: { data: DashboardData }) {
  const r = data.residential;
  return (
    <Panel
      title="Tổ dân phố"
      action={{ href: "/dia-ban/to-dan-pho", label: "Danh mục" }}
      footer={r.updatedAt ? `Cập nhật ngày ${r.updatedAt}` : undefined}
    >
      <Summary
        items={[
          [n(r.count), "TDP"],
          [n(r.households), "hộ"],
          [n(r.population), "nhân khẩu"],
        ]}
      />
      <p className="mb-1 text-sm font-medium text-muted-foreground">Nhân khẩu theo khu vực cũ</p>
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
  );
}
