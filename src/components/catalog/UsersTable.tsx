"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { KeyRound, LockOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { CrudTable } from "@/components/common/CrudTable";
import type { FieldConfig, Option } from "@/components/common/EntityForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Role } from "@/generated/prisma/enums";
import { formatDateTime } from "@/lib/format";
import { vi } from "@/lib/i18n/vi";
import { ROLE_LABELS, ROLES } from "@/lib/permissions";
import { createUserSchema, updateUserSchema } from "@/lib/schemas/user";
import { createUser, resetUserPassword, unlockUser, updateUser } from "@/server/actions/users";

export type UserRow = {
  id: string;
  username: string;
  fullName: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  roles: Role[];
  active: boolean;
  departmentId: string | null;
  departmentName: string | null;
  lockedUntil: Date | null;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
};

function isLockedNow(u: UserRow) {
  return !!u.lockedUntil && new Date(u.lockedUntil).getTime() > Date.now();
}

function StatusCell({ user }: { user: UserRow }) {
  if (!user.active)
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Ngừng hoạt động
      </Badge>
    );
  if (isLockedNow(user)) {
    return (
      <Badge className="bg-status-overdue/15 text-status-overdue">
        Tạm khoá đến {formatDateTime(user.lockedUntil).slice(-5)}
      </Badge>
    );
  }
  if (user.mustChangePassword)
    return <Badge className="bg-status-due-soon/20 text-amber-900">Chờ đổi mật khẩu</Badge>;
  return <Badge className="bg-status-done/15 text-status-done-late">Đang hoạt động</Badge>;
}

const COLUMNS: ColumnDef<UserRow, unknown>[] = [
  {
    accessorKey: "username",
    header: "Tên đăng nhập",
    cell: ({ getValue }) => <span className="font-mono">{getValue() as string}</span>,
  },
  { accessorKey: "fullName", header: "Họ và tên", meta: { hideOnCard: true } },
  {
    accessorKey: "position",
    header: "Chức vụ",
    cell: ({ getValue }) => (getValue() as string | null) ?? "—",
  },
  {
    accessorKey: "departmentName",
    header: "Đơn vị",
    cell: ({ getValue }) => (getValue() as string | null) ?? "—",
  },
  {
    id: "roles",
    header: "Vai trò",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.roles.map((r) => (
          <Badge key={r} variant="secondary">
            {ROLE_LABELS[r]}
          </Badge>
        ))}
      </div>
    ),
  },
  {
    id: "status",
    header: "Trạng thái",
    enableSorting: false,
    cell: ({ row }) => <StatusCell user={row.original} />,
  },
  {
    accessorKey: "lastLoginAt",
    header: "Đăng nhập gần nhất",
    cell: ({ getValue }) => formatDateTime(getValue() as Date | null) || "Chưa đăng nhập",
  },
];

const ROLE_OPTIONS: Option[] = ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

export function UsersTable({
  rows,
  departments,
  currentUserId,
}: {
  rows: UserRow[];
  departments: Option[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [unlocking, setUnlocking] = useState<UserRow | null>(null);
  const [tempPassword, setTempPassword] = useState<{ user: UserRow; password: string } | null>(
    null,
  );

  const fields = (row: UserRow | null): FieldConfig[] => [
    {
      name: "username",
      label: vi.auth.username,
      required: true,
      disabled: !!row,
      hint: "Chữ không dấu, số, dấu chấm, gạch dưới. Không đổi được sau khi tạo.",
    },
    { name: "fullName", label: "Họ và tên", required: true },
    { name: "position", label: "Chức vụ", placeholder: "VD: Phó Chủ tịch UBND" },
    { name: "departmentId", label: "Đơn vị", type: "select", options: departments },
    { name: "phone", label: "Điện thoại", type: "tel" },
    { name: "email", label: "Email", type: "email" },
    ...(row
      ? []
      : [
          {
            name: "password",
            label: "Mật khẩu ban đầu",
            type: "password" as const,
            required: true,
            hint: `${vi.auth.passwordRule} Người dùng phải đổi khi đăng nhập lần đầu.`,
          },
        ]),
    {
      name: "roles",
      label: "Vai trò",
      type: "checkboxes",
      required: true,
      options: ROLE_OPTIONS,
      hint: "Một người có thể có nhiều vai trò; quyền là hợp của các vai trò.",
    },
    {
      name: "active",
      label: "Trạng thái",
      type: "checkbox",
      placeholder: "Đang hoạt động",
      disabled: row?.id === currentUserId,
    },
  ];

  return (
    <>
      <CrudTable
        entityName="người dùng"
        rows={rows}
        columns={COLUMNS}
        canManage
        fields={fields}
        schema={(row) => (row ? updateUserSchema : createUserSchema)}
        toFormValues={(r) => ({
          ...(r ? { id: r.id } : { password: "" }),
          username: r?.username ?? "",
          fullName: r?.fullName ?? "",
          position: r?.position ?? "",
          departmentId: r?.departmentId ?? "",
          phone: r?.phone ?? "",
          email: r?.email ?? "",
          roles: r?.roles ?? ["OFFICER"],
          active: r?.active ?? true,
        })}
        save={(values, row) =>
          row
            ? updateUser({
                ...(values as Record<string, unknown>),
                // Ô bị khoá (disabled) không được gửi lên → điền lại giá trị gốc
                id: row.id,
                username: row.username,
                ...(row.id === currentUserId ? { active: true } : {}),
              } as never)
            : createUser(values as never)
        }
        rowLabel={(r) => r.fullName}
        searchText={(r) =>
          `${r.username} ${r.fullName} ${r.position ?? ""} ${r.departmentName ?? ""}`
        }
        exportHref="/api/export/users"
        rowClassName={(r) => (r.active ? undefined : "opacity-60")}
        rowActions={(r) => (
          <>
            {isLockedNow(r) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setUnlocking(r)}
                aria-label={`Mở khoá ${r.fullName}`}
                title="Mở khoá"
              >
                <LockOpen aria-hidden />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setResetting(r)}
              aria-label={`Đặt lại mật khẩu ${r.fullName}`}
              title="Đặt lại mật khẩu"
            >
              <KeyRound aria-hidden />
            </Button>
          </>
        )}
      />

      {resetting && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setResetting(null)}
          title={`Đặt lại mật khẩu cho “${resetting.fullName}”?`}
          description="Hệ thống sẽ tạo mật khẩu tạm và hiển thị MỘT LẦN để bạn gửi cho người dùng. Người dùng phải đổi mật khẩu khi đăng nhập. Tài khoản đang bị khoá cũng được mở khoá."
          confirmLabel="Đặt lại mật khẩu"
          destructive={false}
          successMessage="Đã đặt lại mật khẩu."
          onConfirm={async () => {
            const result = await resetUserPassword({ id: resetting.id });
            if (result.ok)
              setTempPassword({ user: resetting, password: result.data.temporaryPassword });
            return result;
          }}
          onSuccess={() => router.refresh()}
        />
      )}

      {unlocking && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setUnlocking(null)}
          title={`Mở khoá tài khoản “${unlocking.fullName}”?`}
          description="Tài khoản bị khoá tạm do nhập sai mật khẩu 5 lần. Mở khoá để người dùng đăng nhập lại ngay."
          confirmLabel="Mở khoá"
          destructive={false}
          successMessage="Đã mở khoá tài khoản."
          onConfirm={() => unlockUser({ id: unlocking.id })}
          onSuccess={() => router.refresh()}
        />
      )}

      <Dialog open={!!tempPassword} onOpenChange={(o) => !o && setTempPassword(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Mật khẩu tạm</DialogTitle>
            <DialogDescription>
              Gửi mật khẩu này cho <strong>{tempPassword?.user.fullName}</strong> (
              {tempPassword?.user.username}). Mật khẩu chỉ hiển thị một lần.
            </DialogDescription>
          </DialogHeader>
          <p
            className="rounded-lg bg-muted p-4 text-center font-mono text-2xl tracking-widest select-all"
            data-testid="temp-password"
          >
            {tempPassword?.password}
          </p>
          <Button
            size="lg"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(tempPassword?.password ?? "")
                .then(() => toast.success("Đã sao chép mật khẩu."));
            }}
          >
            Sao chép
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
