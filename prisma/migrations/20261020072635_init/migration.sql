-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'LEADER', 'CLERK', 'OFFICER', 'PARTY_ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('NORMAL', 'URGENT', 'VERY_URGENT', 'FLASH');

-- CreateEnum
CREATE TYPE "DocValidity" AS ENUM ('ACTIVE', 'EXPIRED', 'REPLACED');

-- CreateEnum
CREATE TYPE "TaskFlow" AS ENUM ('NEW', 'IN_PROGRESS', 'SUBMITTED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ExtensionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReportFrequency" AS ENUM ('ONCE', 'MONTHLY', 'QUARTERLY', 'HALF_YEAR', 'YEARLY');

-- CreateEnum
CREATE TYPE "SchoolLevel" AS ENUM ('MAM_NON', 'TIEU_HOC', 'THCS', 'THPT', 'LIEN_CAP', 'GDNN_GDTX');

-- CreateEnum
CREATE TYPE "SchoolOwnership" AS ENUM ('CONG_LAP', 'TU_THUC', 'DAN_LAP');

-- CreateEnum
CREATE TYPE "PartyOrgType" AS ENUM ('DANG_BO_PHUONG', 'DANG_BO_BO_PHAN', 'DANG_BO_CO_SO', 'CHI_BO_CO_SO', 'CHI_BO_TRUC_THUOC');

-- CreateEnum
CREATE TYPE "PartyBlock" AS ENUM ('KHU_DAN_CU', 'CO_QUAN', 'TRUONG_HOC', 'Y_TE', 'DOANH_NGHIEP', 'CONG_AN', 'QUAN_SU', 'KHAC');

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "position" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "roles" "Role"[],
    "departmentId" TEXT,
    "fontScale" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WardProfile" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL DEFAULT 'Phường Thanh Liệt',
    "city" TEXT NOT NULL DEFAULT 'Hà Nội',
    "areaKm2" DECIMAL(8,2) NOT NULL,
    "population" INTEGER NOT NULL,
    "populationIsEstimate" BOOLEAN NOT NULL DEFAULT true,
    "households" INTEGER,
    "establishedDate" DATE,
    "address" TEXT,
    "phone" TEXT,
    "partyOrgCountOverride" INTEGER,
    "partyCellCountOverride" INTEGER,
    "partyMemberCountOverride" INTEGER,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WardProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#1E3A8A',
    "icon" TEXT NOT NULL DEFAULT 'file-text',
    "isProgram" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DocumentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Field" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Field_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssuingAgency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "IssuingAgency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentNode" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "rootId" TEXT,
    "path" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "typeId" TEXT NOT NULL,
    "number" TEXT,
    "title" VARCHAR(500) NOT NULL,
    "summary" TEXT,
    "issuingAgencyId" TEXT,
    "issuingAgencyText" TEXT,
    "signer" TEXT,
    "issuedDate" DATE,
    "effectiveDate" DATE,
    "dueDate" DATE,
    "fieldId" TEXT,
    "urgency" "Urgency" NOT NULL DEFAULT 'NORMAL',
    "validity" "DocValidity" NOT NULL DEFAULT 'ACTIVE',
    "replacedById" TEXT,
    "tags" TEXT[],
    "leadDepartmentId" TEXT,
    "coDepartmentIds" TEXT[],
    "isInternalPublic" BOOLEAN NOT NULL DEFAULT false,
    "progressCache" INTEGER NOT NULL DEFAULT 0,
    "hasOverdueDescendant" BOOLEAN NOT NULL DEFAULT false,
    "searchText" TEXT NOT NULL DEFAULT '',
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentShare" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentFollow" (
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentFollow_pkey" PRIMARY KEY ("documentId","userId")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "documentId" TEXT,
    "taskUpdateId" TEXT,
    "submissionId" TEXT,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "documentId" TEXT,
    "assignerId" TEXT NOT NULL,
    "leadDepartmentId" TEXT,
    "leadUserId" TEXT,
    "coDepartmentIds" TEXT[],
    "coUserIds" TEXT[],
    "startDate" DATE,
    "dueDate" DATE,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "flow" "TaskFlow" NOT NULL DEFAULT 'NEW',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskUpdate" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskExtension" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "oldDueDate" DATE NOT NULL,
    "newDueDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ExtensionStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskExtension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportRequirement" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" "ReportFrequency" NOT NULL,
    "onceDueDate" DATE,
    "dueDayOfPeriod" INTEGER,
    "dueMonthOffset" INTEGER,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "recipientAgencyId" TEXT,
    "departmentIds" TEXT[],
    "followerUserId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportPeriod" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "ReportPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSubmission" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "number" TEXT,
    "sentDate" DATE NOT NULL,
    "note" TEXT,
    "submittedById" TEXT NOT NULL,
    "linkedDocumentId" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "SchoolLevel" NOT NULL,
    "ownership" "SchoolOwnership" NOT NULL DEFAULT 'CONG_LAP',
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "principal" TEXT,
    "principalPhone" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolYearStat" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "schoolYear" TEXT NOT NULL,
    "staffTotal" INTEGER NOT NULL,
    "managers" INTEGER,
    "teachers" INTEGER,
    "employees" INTEGER,
    "classes" INTEGER,
    "students" INTEGER NOT NULL,
    "femaleStudents" INTEGER,
    "note" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolYearStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OldArea" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OldArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Residential" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" INTEGER,
    "oldAreaId" TEXT,
    "leaderName" TEXT,
    "leaderPhone" TEXT,
    "households" INTEGER,
    "population" INTEGER,
    "partyOrgId" TEXT,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Residential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyOrg" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PartyOrgType" NOT NULL,
    "block" "PartyBlock" NOT NULL DEFAULT 'KHU_DAN_CU',
    "parentId" TEXT,
    "secretary" TEXT,
    "secretaryPhone" TEXT,
    "deputySecretary" TEXT,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "officialMembers" INTEGER,
    "probationaryMembers" INTEGER,
    "latestRating" TEXT,
    "ratingYear" INTEGER,
    "residentialId" TEXT,
    "schoolId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyOrg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "dedupKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentType_code_key" ON "DocumentType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Field_name_key" ON "Field"("name");

-- CreateIndex
CREATE UNIQUE INDEX "IssuingAgency_name_key" ON "IssuingAgency"("name");

-- CreateIndex
CREATE INDEX "DocumentNode_parentId_idx" ON "DocumentNode"("parentId");

-- CreateIndex
CREATE INDEX "DocumentNode_rootId_idx" ON "DocumentNode"("rootId");

-- CreateIndex
CREATE INDEX "DocumentNode_path_idx" ON "DocumentNode"("path" text_pattern_ops);

-- CreateIndex
CREATE INDEX "DocumentNode_issuedDate_idx" ON "DocumentNode"("issuedDate");

-- CreateIndex
CREATE INDEX "DocumentNode_deletedAt_idx" ON "DocumentNode"("deletedAt");

-- CreateIndex
CREATE INDEX "DocumentNode_searchText_idx" ON "DocumentNode" USING GIN ("searchText" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "DocumentShare_userId_idx" ON "DocumentShare"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentShare_documentId_userId_key" ON "DocumentShare"("documentId", "userId");

-- CreateIndex
CREATE INDEX "DocumentFollow_userId_idx" ON "DocumentFollow"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");

-- CreateIndex
CREATE INDEX "Attachment_documentId_idx" ON "Attachment"("documentId");

-- CreateIndex
CREATE INDEX "Attachment_taskUpdateId_idx" ON "Attachment"("taskUpdateId");

-- CreateIndex
CREATE INDEX "Attachment_submissionId_idx" ON "Attachment"("submissionId");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex
CREATE INDEX "Task_leadDepartmentId_idx" ON "Task"("leadDepartmentId");

-- CreateIndex
CREATE INDEX "Task_leadUserId_idx" ON "Task"("leadUserId");

-- CreateIndex
CREATE INDEX "Task_documentId_idx" ON "Task"("documentId");

-- CreateIndex
CREATE INDEX "TaskUpdate_taskId_idx" ON "TaskUpdate"("taskId");

-- CreateIndex
CREATE INDEX "TaskExtension_taskId_idx" ON "TaskExtension"("taskId");

-- CreateIndex
CREATE INDEX "ReportRequirement_documentId_idx" ON "ReportRequirement"("documentId");

-- CreateIndex
CREATE INDEX "ReportPeriod_dueDate_idx" ON "ReportPeriod"("dueDate");

-- CreateIndex
CREATE INDEX "ReportPeriod_departmentId_idx" ON "ReportPeriod"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportPeriod_requirementId_periodStart_departmentId_key" ON "ReportPeriod"("requirementId", "periodStart", "departmentId");

-- CreateIndex
CREATE INDEX "ReportSubmission_periodId_idx" ON "ReportSubmission"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "School_name_key" ON "School"("name");

-- CreateIndex
CREATE INDEX "SchoolYearStat_schoolYear_idx" ON "SchoolYearStat"("schoolYear");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolYearStat_schoolId_schoolYear_key" ON "SchoolYearStat"("schoolId", "schoolYear");

-- CreateIndex
CREATE UNIQUE INDEX "OldArea_name_key" ON "OldArea"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Residential_name_key" ON "Residential"("name");

-- CreateIndex
CREATE INDEX "PartyOrg_parentId_idx" ON "PartyOrg"("parentId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupKey_key" ON "Notification"("userId", "dedupKey");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WardProfile" ADD CONSTRAINT "WardProfile_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentNode" ADD CONSTRAINT "DocumentNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DocumentNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentNode" ADD CONSTRAINT "DocumentNode_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "DocumentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentNode" ADD CONSTRAINT "DocumentNode_issuingAgencyId_fkey" FOREIGN KEY ("issuingAgencyId") REFERENCES "IssuingAgency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentNode" ADD CONSTRAINT "DocumentNode_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentNode" ADD CONSTRAINT "DocumentNode_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "DocumentNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentNode" ADD CONSTRAINT "DocumentNode_leadDepartmentId_fkey" FOREIGN KEY ("leadDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentNode" ADD CONSTRAINT "DocumentNode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentNode" ADD CONSTRAINT "DocumentNode_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentShare" ADD CONSTRAINT "DocumentShare_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentShare" ADD CONSTRAINT "DocumentShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentShare" ADD CONSTRAINT "DocumentShare_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFollow" ADD CONSTRAINT "DocumentFollow_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFollow" ADD CONSTRAINT "DocumentFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_taskUpdateId_fkey" FOREIGN KEY ("taskUpdateId") REFERENCES "TaskUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ReportSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignerId_fkey" FOREIGN KEY ("assignerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_leadDepartmentId_fkey" FOREIGN KEY ("leadDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_leadUserId_fkey" FOREIGN KEY ("leadUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskUpdate" ADD CONSTRAINT "TaskUpdate_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskUpdate" ADD CONSTRAINT "TaskUpdate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskExtension" ADD CONSTRAINT "TaskExtension_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskExtension" ADD CONSTRAINT "TaskExtension_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskExtension" ADD CONSTRAINT "TaskExtension_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRequirement" ADD CONSTRAINT "ReportRequirement_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRequirement" ADD CONSTRAINT "ReportRequirement_recipientAgencyId_fkey" FOREIGN KEY ("recipientAgencyId") REFERENCES "IssuingAgency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRequirement" ADD CONSTRAINT "ReportRequirement_followerUserId_fkey" FOREIGN KEY ("followerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportPeriod" ADD CONSTRAINT "ReportPeriod_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "ReportRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportPeriod" ADD CONSTRAINT "ReportPeriod_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSubmission" ADD CONSTRAINT "ReportSubmission_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "ReportPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSubmission" ADD CONSTRAINT "ReportSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSubmission" ADD CONSTRAINT "ReportSubmission_linkedDocumentId_fkey" FOREIGN KEY ("linkedDocumentId") REFERENCES "DocumentNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolYearStat" ADD CONSTRAINT "SchoolYearStat_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolYearStat" ADD CONSTRAINT "SchoolYearStat_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Residential" ADD CONSTRAINT "Residential_oldAreaId_fkey" FOREIGN KEY ("oldAreaId") REFERENCES "OldArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Residential" ADD CONSTRAINT "Residential_partyOrgId_fkey" FOREIGN KEY ("partyOrgId") REFERENCES "PartyOrg"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Residential" ADD CONSTRAINT "Residential_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyOrg" ADD CONSTRAINT "PartyOrg_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PartyOrg"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyOrg" ADD CONSTRAINT "PartyOrg_residentialId_fkey" FOREIGN KEY ("residentialId") REFERENCES "Residential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyOrg" ADD CONSTRAINT "PartyOrg_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyOrg" ADD CONSTRAINT "PartyOrg_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
