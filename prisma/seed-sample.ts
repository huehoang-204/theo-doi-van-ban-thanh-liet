// Seed MẪU (Mục 15) — số liệu MINH HOẠ để giao diện có nội dung khi phát triển.
// Mọi bản ghi đánh dấu isSample = true → xoá bằng `npm run db:clear-sample` trước khi bàn giao.
// Dùng bộ sinh số giả ngẫu nhiên cố định (seed) nên chạy lại cho cùng kết quả.
import bcrypt from "bcryptjs";

import type { Prisma, PrismaClient, Role, SchoolLevel } from "../src/generated/prisma/client";
import { vnDateKey } from "../src/lib/format";
import { BCRYPT_COST } from "../src/lib/password";
import { recomputeAllTrees } from "../src/server/documents/progress";
import { createMissingPeriods } from "../src/server/reports/periods";

const SAMPLE_PASSWORD = "ThanhLiet@2026";
const TARGET_POPULATION = 92_000;

/** mulberry32 — số giả ngẫu nhiên tái lập được */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(20250701);
const between = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));
const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;

/** Ngày thuần (00:00 UTC) cách hôm nay (giờ VN) n ngày */
function dayFromToday(n: number): Date {
  const today = new Date(`${vnDateKey(new Date())}T00:00:00Z`);
  return new Date(today.getTime() + n * 86_400_000);
}
const date = (iso: string) => new Date(`${iso}T00:00:00Z`);

type Db = PrismaClient;

async function deptId(db: Db, name: string): Promise<string> {
  return (await db.department.findUniqueOrThrow({ where: { name } })).id;
}

// ---------------------------------------------------------------- Người dùng
const SAMPLE_USERS: {
  username: string;
  fullName: string;
  position: string;
  roles: Role[];
  dept: string;
}[] = [
  {
    username: "bithu",
    fullName: "Bí thư Đảng ủy (mẫu)",
    position: "Bí thư Đảng ủy phường",
    roles: ["LEADER"],
    dept: "Văn phòng Đảng ủy",
  },
  {
    username: "chutich",
    fullName: "Chủ tịch UBND (mẫu)",
    position: "Chủ tịch UBND phường",
    roles: ["LEADER"],
    dept: "Văn phòng HĐND và UBND",
  },
  {
    username: "vanthu",
    fullName: "Văn thư (mẫu)",
    position: "Văn thư",
    roles: ["CLERK"],
    dept: "Văn phòng HĐND và UBND",
  },
  {
    username: "canbo1",
    fullName: "Cán bộ Kinh tế (mẫu)",
    position: "Chuyên viên",
    roles: ["OFFICER"],
    dept: "Phòng Kinh tế, Hạ tầng và Đô thị",
  },
  {
    username: "canbo2",
    fullName: "Cán bộ Văn hóa (mẫu)",
    position: "Chuyên viên",
    roles: ["OFFICER"],
    dept: "Phòng Văn hóa – Xã hội",
  },
  {
    username: "xaydungdang",
    fullName: "Cán bộ Ban XD Đảng (mẫu)",
    position: "Chuyên viên Ban Xây dựng Đảng",
    roles: ["PARTY_ADMIN"],
    dept: "Ban Xây dựng Đảng",
  },
  // Không có trong danh sách Mục 15 — thêm để kiểm thử vai trò VIEWER (Tổ trưởng TDP)
  {
    username: "totruong1",
    fullName: "Tổ trưởng TDP số 1 (mẫu)",
    position: "Tổ trưởng tổ dân phố",
    roles: ["VIEWER"],
    dept: "Văn phòng HĐND và UBND",
  },
];

async function seedUsers(db: Db) {
  const passwordHash = await bcrypt.hash(SAMPLE_PASSWORD, BCRYPT_COST);
  const ids: Record<string, string> = {};
  for (const u of SAMPLE_USERS) {
    const user = await db.user.create({
      data: {
        username: u.username,
        fullName: u.fullName,
        position: u.position,
        roles: u.roles,
        departmentId: await deptId(db, u.dept),
        passwordHash,
        mustChangePassword: true,
        isSample: true,
      },
    });
    ids[u.username] = user.id;
  }
  return ids;
}

// ---------------------------------------------------------------- Trường học
const SCHOOLS: { name: string; level: SchoolLevel; ownership?: "CONG_LAP" | "TU_THUC" }[] = [
  { name: "Trường Mầm non Thanh Liệt", level: "MAM_NON" },
  { name: "Trường Tiểu học Thanh Liệt", level: "TIEU_HOC" },
  { name: "Trường THCS Thanh Liệt", level: "THCS" },
  { name: "Trường Mầm non Hoa Sen (mẫu)", level: "MAM_NON" },
  { name: "Trường Mầm non Sao Mai (mẫu)", level: "MAM_NON", ownership: "TU_THUC" },
  { name: "Trường Tiểu học Tân Triều (mẫu)", level: "TIEU_HOC" },
  { name: "Trường Tiểu học Đại Kim (mẫu)", level: "TIEU_HOC" },
  { name: "Trường THCS Tân Triều (mẫu)", level: "THCS" },
  { name: "Trường Liên cấp Ánh Dương (mẫu)", level: "LIEN_CAP", ownership: "TU_THUC" },
];

async function seedSchools(db: Db) {
  const ids: { id: string; name: string; level: SchoolLevel }[] = [];
  for (const [i, s] of SCHOOLS.entries()) {
    const school = await db.school.create({
      data: {
        name: s.name,
        level: s.level,
        ownership: s.ownership ?? "CONG_LAP",
        sortOrder: i + 1,
        isSample: true,
        address: "Phường Thanh Liệt, Hà Nội",
      },
    });
    ids.push({ id: school.id, name: school.name, level: school.level });
    // Mầm non quy mô nhỏ hơn; số liệu 2026-2027 tăng nhẹ so với 2025-2026
    const small = s.level === "MAM_NON";
    const students = small ? between(400, 750) : between(700, 1800);
    const staffTotal = small ? between(40, 70) : between(55, 120);
    const classes = Math.round(students / (small ? 28 : 38));
    for (const [year, growth] of [
      ["2025-2026", 0.96],
      ["2026-2027", 1],
    ] as const) {
      const st = Math.round(students * growth);
      const staff = Math.round(staffTotal * growth);
      const managers = 3;
      const teachers = Math.round(staff * 0.75);
      await db.schoolYearStat.create({
        data: {
          schoolId: school.id,
          schoolYear: year,
          staffTotal: staff,
          managers,
          teachers,
          employees: staff - managers - teachers,
          classes: Math.max(1, Math.round(classes * growth)),
          students: st,
          femaleStudents: Math.round(st * (0.46 + rand() * 0.06)),
        },
      });
    }
  }
  return ids;
}

// ---------------------------------------------------------------- Tổ dân phố
async function seedResidentials(db: Db) {
  const areas = await db.oldArea.findMany({ orderBy: { sortOrder: "asc" } });
  // Nhân khẩu = hộ × 3–3,6; số hộ điều chỉnh để tổng nhân khẩu ≈ 92.000 (xem ghi chú cuối file)
  const raw = Array.from({ length: 40 }, () => ({
    households: between(250, 600),
    ratio: 3 + rand() * 0.6,
  }));
  const rawTotal = raw.reduce((s, r) => s + r.households * r.ratio, 0);
  const scale = TARGET_POPULATION / rawTotal;
  const rows = [];
  for (const [i, r] of raw.entries()) {
    const households = Math.round(r.households * scale);
    const tdp = await db.residential.create({
      data: {
        name: `Tổ dân phố số ${i + 1}`,
        code: i + 1,
        oldAreaId: areas[i % areas.length]!.id,
        leaderName: `Tổ trưởng TDP số ${i + 1} (mẫu)`,
        households,
        population: Math.round(households * r.ratio),
        isSample: true,
      },
    });
    rows.push(tdp);
  }
  return rows;
}

// ---------------------------------------------------------------- Tổ chức đảng (63 tổ chức trực thuộc)
async function seedPartyOrgs(
  db: Db,
  residentials: { id: string; name: string }[],
  schools: { id: string; name: string }[],
) {
  const root = await db.partyOrg.findFirstOrThrow({ where: { type: "DANG_BO_PHUONG" } });
  const members = () => between(15, 150);
  let order = 0;
  const create = (data: Omit<Prisma.PartyOrgUncheckedCreateInput, "sortOrder" | "isSample">) =>
    db.partyOrg.create({ data: { ...data, sortOrder: ++order, isSample: true } });

  // 40 chi bộ khu dân cư — mỗi TDP một chi bộ
  for (const tdp of residentials) {
    const n = members();
    const cell = await create({
      name: `Chi bộ ${tdp.name}`,
      type: "CHI_BO_CO_SO",
      block: "KHU_DAN_CU",
      parentId: root.id,
      memberCount: n,
      officialMembers: n - Math.min(n, between(0, 3)),
      probationaryMembers: null,
      residentialId: tdp.id,
      latestRating: pick([
        "Hoàn thành tốt nhiệm vụ",
        "Hoàn thành xuất sắc nhiệm vụ",
        "Hoàn thành nhiệm vụ",
      ]),
      ratingYear: 2025,
    });
    await db.partyOrg.update({
      where: { id: cell.id },
      data: { probationaryMembers: n - (cell.officialMembers ?? n) },
    });
    await db.residential.update({ where: { id: tdp.id }, data: { partyOrgId: cell.id } });
  }
  // 6 chi bộ trường học
  for (const school of schools.slice(0, 6)) {
    await create({
      name: `Chi bộ ${school.name}`,
      type: "CHI_BO_CO_SO",
      block: "TRUONG_HOC",
      parentId: root.id,
      memberCount: between(15, 40),
      schoolId: school.id,
    });
  }
  // 7 chi bộ cơ quan, 2 y tế, 2 công an, 1 quân sự, 1 doanh nghiệp
  const others: [string, "CO_QUAN" | "Y_TE" | "CONG_AN" | "QUAN_SU" | "DOANH_NGHIEP"][] = [
    ["Chi bộ Cơ quan Đảng ủy (mẫu)", "CO_QUAN"],
    ["Chi bộ Cơ quan UBND phường (mẫu)", "CO_QUAN"],
    ["Chi bộ Cơ quan MTTQ và các đoàn thể (mẫu)", "CO_QUAN"],
    ["Chi bộ Trung tâm Phục vụ hành chính công (mẫu)", "CO_QUAN"],
    ["Chi bộ Ban Quản lý chợ (mẫu)", "CO_QUAN"],
    ["Chi bộ Kho bạc khu vực (mẫu)", "CO_QUAN"],
    ["Chi bộ Bảo hiểm xã hội khu vực (mẫu)", "CO_QUAN"],
    ["Chi bộ Trạm Y tế phường (mẫu)", "Y_TE"],
    ["Chi bộ Bệnh viện khu vực (mẫu)", "Y_TE"],
    ["Chi bộ Công an phường 1 (mẫu)", "CONG_AN"],
    ["Chi bộ Công an phường 2 (mẫu)", "CONG_AN"],
    ["Chi bộ Quân sự phường (mẫu)", "QUAN_SU"],
    ["Chi bộ Công ty cổ phần (mẫu)", "DOANH_NGHIEP"],
  ];
  for (const [name, block] of others) {
    await create({
      name,
      type: "CHI_BO_CO_SO",
      block,
      parentId: root.id,
      memberCount: between(15, 60),
    });
  }
  // 1 đảng bộ bộ phận với 3 chi bộ trực thuộc → tổng 40 + 6 + 13 + 1 + 3 = 63
  const sub = await create({
    name: "Đảng bộ bộ phận Khu đô thị (mẫu)",
    type: "DANG_BO_BO_PHAN",
    block: "KHU_DAN_CU",
    parentId: root.id,
    memberCount: 0,
  });
  let subTotal = 0;
  for (let i = 1; i <= 3; i++) {
    const n = members();
    subTotal += n;
    await create({
      name: `Chi bộ Khu đô thị ${i} (mẫu)`,
      type: "CHI_BO_TRUC_THUOC",
      block: "KHU_DAN_CU",
      parentId: sub.id,
      memberCount: n,
    });
  }
  await db.partyOrg.update({ where: { id: sub.id }, data: { memberCount: subTotal } });
  return db.partyOrg.count({ where: { type: { not: "DANG_BO_PHUONG" } } });
}

// ---------------------------------------------------------------- Cây văn bản
type NodeInput = {
  type: string;
  number?: string;
  title: string;
  field?: string;
  agency?: string;
  issued?: string;
  lead?: string;
  tags?: string[];
  children?: NodeInput[];
};

const TREE: NodeInput[] = [
  {
    type: "CTr",
    title: "Chương trình công tác trọng tâm năm 2026",
    agency: "UBND phường Thanh Liệt",
    issued: "2026-01-05",
    lead: "Văn phòng HĐND và UBND",
    children: [
      {
        type: "KH",
        number: "12/KH-UBND",
        title: "Kế hoạch triển khai chuyển đổi số năm 2026",
        field: "Chuyển đổi số",
        agency: "UBND phường Thanh Liệt",
        issued: "2026-01-12",
        lead: "Văn phòng HĐND và UBND",
        tags: ["chuyển đổi số"],
        children: [
          {
            type: "QD",
            number: "45/QĐ-UBND",
            title: "Thành lập Tổ công tác chuyển đổi số",
            field: "Chuyển đổi số",
            agency: "UBND phường Thanh Liệt",
            issued: "2026-01-20",
            lead: "Văn phòng HĐND và UBND",
            children: [
              {
                type: "QC",
                title: "Quy chế hoạt động của Tổ công tác",
                field: "Chuyển đổi số",
                agency: "UBND phường Thanh Liệt",
                issued: "2026-01-20",
                children: [
                  {
                    type: "BC",
                    title: "Báo cáo kết quả hoạt động quý I/2026",
                    field: "Chuyển đổi số",
                    agency: "UBND phường Thanh Liệt",
                    issued: "2026-04-05",
                  },
                ],
              },
              {
                type: "PL",
                title: "Danh sách thành viên Tổ công tác",
                field: "Chuyển đổi số",
                agency: "UBND phường Thanh Liệt",
                issued: "2026-01-20",
              },
            ],
          },
          {
            type: "CV",
            number: "88/UBND-VP",
            title: "Hướng dẫn số hóa hồ sơ thủ tục hành chính",
            field: "Chuyển đổi số",
            agency: "UBND phường Thanh Liệt",
            issued: "2026-02-03",
            lead: "Trung tâm Phục vụ hành chính công",
            tags: ["số hóa", "TTHC"],
          },
        ],
      },
      {
        type: "KH",
        number: "20/KH-UBND",
        title: "Kế hoạch xây dựng phường đạt chuẩn đô thị văn minh",
        field: "Đô thị",
        agency: "UBND phường Thanh Liệt",
        issued: "2026-02-10",
        lead: "Phòng Kinh tế, Hạ tầng và Đô thị",
      },
    ],
  },
  {
    type: "CTr",
    title:
      "Chương trình hành động thực hiện Nghị quyết Đại hội Đảng bộ phường lần thứ I, nhiệm kỳ 2025–2030",
    agency: "Đảng ủy phường Thanh Liệt",
    issued: "2025-09-15",
    lead: "Văn phòng Đảng ủy",
    field: "Xây dựng Đảng",
    children: [
      {
        type: "NQ",
        title: "Nghị quyết chuyên đề về nâng cao chất lượng sinh hoạt chi bộ (mẫu)",
        field: "Xây dựng Đảng",
        agency: "Đảng ủy phường Thanh Liệt",
        issued: "2025-10-20",
        lead: "Ban Xây dựng Đảng",
      },
    ],
  },
];

async function seedDocuments(db: Db, createdById: string) {
  const [types, fields, agencies, departments] = await Promise.all([
    db.documentType.findMany(),
    db.field.findMany(),
    db.issuingAgency.findMany(),
    db.department.findMany(),
  ]);
  const typeId = (code: string) => types.find((t) => t.code === code)!.id;
  const byNumber: Record<string, string> = {};
  const all: { id: string; depth: number }[] = [];

  async function create(
    node: NodeInput,
    parent: { id: string; path: string; depth: number; rootId: string } | null,
    sortOrder: number,
  ) {
    const id = crypto.randomUUID();
    const path = `${parent?.path ?? "/"}${id}/`;
    const depth = (parent?.depth ?? 0) + 1;
    await db.documentNode.create({
      data: {
        id,
        parentId: parent?.id ?? null,
        rootId: parent?.rootId ?? null,
        path,
        depth,
        sortOrder,
        typeId: typeId(node.type),
        number: node.number ?? null,
        title: node.title,
        issuingAgencyId: agencies.find((a) => a.name === node.agency)?.id ?? null,
        issuedDate: node.issued ? date(node.issued) : null,
        fieldId: fields.find((f) => f.name === node.field)?.id ?? null,
        leadDepartmentId: departments.find((d) => d.name === node.lead)?.id ?? null,
        tags: node.tags ?? [],
        isInternalPublic: depth <= 2,
        createdById,
        isSample: true,
      },
    });
    all.push({ id, depth });
    if (node.number) byNumber[node.number] = id;
    for (const [i, child] of (node.children ?? []).entries()) {
      await create(child, { id, path, depth, rootId: parent?.rootId ?? id }, i + 1);
    }
  }
  for (const [i, root] of TREE.entries()) await create(root, null, i + 1);
  return { byNumber, count: all.length };
}

// ---------------------------------------------------------------- Yêu cầu báo cáo (kỳ báo cáo sinh ở Giai đoạn 3)
async function seedReportRequirement(db: Db, documentId: string, followerUserId: string) {
  const recipient = await db.issuingAgency.findUnique({ where: { name: "UBND thành phố Hà Nội" } });
  const req = await db.reportRequirement.create({
    data: {
      documentId,
      name: "Báo cáo kết quả số hóa hồ sơ thủ tục hành chính",
      frequency: "MONTHLY",
      dueDayOfPeriod: 20,
      startDate: date("2026-01-01"),
      endDate: date("2026-12-31"),
      recipientAgencyId: recipient?.id,
      departmentIds: await Promise.all(
        [
          "Trung tâm Phục vụ hành chính công",
          "Văn phòng HĐND và UBND",
          "Phòng Kinh tế, Hạ tầng và Đô thị",
        ].map((n) => deptId(db, n)),
      ),
      followerUserId,
      isSample: true,
    },
  });
  // Sinh 12 kỳ × 3 đơn vị và nộp sẵn các kỳ đã qua: đơn vị 1 nộp đúng hạn; đơn vị 2 nộp,
  // riêng tháng 01 nộp trễ 1 ngày; đơn vị 3 bỏ sót vài kỳ (quá hạn) để có số liệu minh hoạ
  const periods = await createMissingPeriods(db, req);
  const today = dayFromToday(0);
  const past = await db.reportPeriod.findMany({
    where: { requirementId: req.id, dueDate: { lt: today } },
    orderBy: { dueDate: "asc" },
  });
  let submitted = 0;
  for (const p of past) {
    const deptIndex = req.departmentIds.indexOf(p.departmentId);
    const month = p.periodStart.getUTCMonth();
    if (deptIndex === 2 && month >= 6) continue; // đơn vị 3: quá hạn chưa nộp từ tháng 7
    const late = deptIndex === 1 && month === 0;
    await db.reportSubmission.create({
      data: {
        periodId: p.id,
        number: `${month + 1}/BC-${deptIndex + 1}`,
        sentDate: new Date(p.dueDate.getTime() + (late ? 1 : -2) * 86_400_000),
        submittedById: followerUserId,
        createdAt: new Date(p.dueDate.getTime() - 86_400_000),
      },
    });
    submitted++;
  }
  return { periods, submitted };
}

// ---------------------------------------------------------------- Công việc (~25, đủ các trạng thái, tính theo ngày chạy seed)
async function seedTasks(db: Db, users: Record<string, string>, docs: Record<string, string>) {
  const deptKT = await deptId(db, "Phòng Kinh tế, Hạ tầng và Đô thị");
  const deptVH = await deptId(db, "Phòng Văn hóa – Xã hội");
  const deptVP = await deptId(db, "Văn phòng HĐND và UBND");
  const docIds = [
    docs["12/KH-UBND"],
    docs["45/QĐ-UBND"],
    docs["88/UBND-VP"],
    docs["20/KH-UBND"],
    null,
  ];
  const assigners = [users.chutich!, users.bithu!, users.vanthu!];
  const leads = [
    { leadUserId: users.canbo1!, leadDepartmentId: deptKT },
    { leadUserId: users.canbo2!, leadDepartmentId: deptVH },
    { leadUserId: null, leadDepartmentId: deptVP },
  ];

  type Plan = {
    kind: string;
    due: number;
    flow: "NEW" | "IN_PROGRESS" | "SUBMITTED" | "DONE";
    progress: number;
    doneAt?: number;
  };
  const plans: Plan[] = [
    ...[-10, -6, -3, -2, -1].map((due) => ({
      kind: "quá hạn",
      due,
      flow: "IN_PROGRESS" as const,
      progress: between(2, 7) * 10,
    })),
    ...[0, 1, 2, 3, 3].map((due) => ({
      kind: "sắp đến hạn",
      due,
      flow: "IN_PROGRESS" as const,
      progress: between(4, 8) * 10,
    })),
    ...[7, 12, 18, 25, 33, 40].map((due) => ({
      kind: "đang làm",
      due,
      flow: "IN_PROGRESS" as const,
      progress: between(1, 6) * 10,
    })),
    ...[20, 45].map((due) => ({ kind: "mới giao", due, flow: "NEW" as const, progress: 0 })),
    { kind: "chờ duyệt", due: 5, flow: "SUBMITTED", progress: 100 },
    ...[-30, -20, -12, -4].map((due) => ({
      kind: "xong đúng hạn",
      due,
      flow: "DONE" as const,
      progress: 100,
      doneAt: due - between(1, 5),
    })),
    ...[-25, -8].map((due) => ({
      kind: "xong trễ hạn",
      due,
      flow: "DONE" as const,
      progress: 100,
      doneAt: due + between(1, 4),
    })),
  ];

  const titles = [
    "Rà soát, cập nhật danh mục thủ tục hành chính trực tuyến",
    "Tổng hợp số liệu dân cư phục vụ Đề án 06",
    "Kiểm tra trật tự xây dựng tuyến đường Nguyễn Xiển",
    "Tuyên truyền thanh toán không dùng tiền mặt tại chợ",
    "Xây dựng kế hoạch tổ chức Ngày hội Đại đoàn kết",
    "Đánh giá chất lượng sinh hoạt chi bộ quý III",
    "Số hóa hồ sơ hộ tịch giai đoạn 2015–2020",
    "Rà soát hộ nghèo, cận nghèo năm 2026",
    "Báo cáo tình hình thu gom rác thải sinh hoạt",
    "Lập danh sách trường đạt chuẩn quốc gia",
    "Kiểm tra an toàn phòng cháy tại khu nhà trọ",
    "Chuẩn bị nội dung giao ban tháng",
    "Cập nhật bản đồ số địa bàn",
  ];

  let n = 0;
  for (const p of plans) {
    const lead = leads[n % leads.length]!;
    const dueDate = dayFromToday(p.due);
    const task = await db.task.create({
      data: {
        title: `${titles[n % titles.length]} (mẫu)`,
        description: `Công việc minh hoạ trạng thái “${p.kind}”.`,
        documentId: docIds[n % docIds.length] ?? null,
        assignerId: assigners[n % assigners.length]!,
        ...lead,
        coDepartmentIds: n % 4 === 0 ? [deptVP] : [],
        coUserIds: [],
        startDate: dayFromToday(p.due - between(10, 30)),
        dueDate,
        priority:
          p.due <= 3 && p.flow === "IN_PROGRESS"
            ? "HIGH"
            : pick(["NORMAL", "NORMAL", "LOW", "URGENT"] as const),
        flow: p.flow,
        progress: p.progress,
        completedAt:
          p.doneAt !== undefined
            ? new Date(dayFromToday(p.doneAt).getTime() + 9 * 3_600_000)
            : null,
        // Mốc báo hoàn thành (D3): việc chờ duyệt báo hôm qua; việc đã duyệt = lúc hoàn thành
        submittedAt:
          p.flow === "SUBMITTED"
            ? new Date(dayFromToday(-1).getTime() + 15 * 3_600_000)
            : p.doneAt !== undefined
              ? new Date(dayFromToday(p.doneAt).getTime() + 9 * 3_600_000)
              : null,
        isSample: true,
      },
    });
    if (p.progress > 0) {
      await db.taskUpdate.create({
        data: {
          taskId: task.id,
          userId: lead.leadUserId ?? users.vanthu!,
          progress: p.progress,
          content:
            p.progress === 100 ? "Đã hoàn thành, gửi kết quả." : "Đang triển khai theo kế hoạch.",
        },
      });
    }
    n++;
  }
  return n;
}

export async function seedSample(db: Db) {
  if (await db.user.findFirst({ where: { isSample: true } })) {
    console.log(
      "• Dữ liệu mẫu đã có — bỏ qua. (Xoá bằng `npm run db:clear-sample` rồi seed lại nếu cần.)",
    );
    return;
  }
  const users = await seedUsers(db);
  const schools = await seedSchools(db);
  const residentials = await seedResidentials(db);
  const partyCount = await seedPartyOrgs(db, residentials, schools);
  const { byNumber, count: docCount } = await seedDocuments(db, users.vanthu!);
  const report = await seedReportRequirement(db, byNumber["88/UBND-VP"]!, users.vanthu!);
  const taskCount = await seedTasks(db, users, byNumber);
  await recomputeAllTrees(db); // tiến độ cộng dồn & chấm đỏ trên cây (Mục 3.4)

  const population = residentials.reduce((s, r) => s + (r.population ?? 0), 0);
  console.log(
    `✔ Dữ liệu mẫu: ${SAMPLE_USERS.length} người dùng (mật khẩu ${SAMPLE_PASSWORD}), ${schools.length} trường, ` +
      `${residentials.length} TDP (tổng ${population.toLocaleString("vi-VN")} nhân khẩu), ${partyCount} tổ chức đảng, ` +
      `${docCount} văn bản, 1 yêu cầu báo cáo (${report.periods} kỳ, đã nộp ${report.submitted}), ${taskCount} công việc.`,
  );
}

// Ghi chú: Mục 15 yêu cầu "số hộ 250–600, nhân khẩu = hộ × 3–3,6, tổng ≈ 92.000" — với 40 TDP ba điều kiện
// này không đồng thời thoả được (tối đa 40 × 600 × 3,6 = 86.400). Seed ưu tiên tổng ≈ 92.000 và tỉ lệ
// hộ/nhân khẩu, nên số hộ mỗi TDP được co giãn lên khoảng 560–850 (xem docs/cau-hoi-mo.md).
