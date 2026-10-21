"use client";

import {
  CalendarClock,
  CheckCheck,
  CircleCheck,
  Pencil,
  Send,
  TrendingUp,
  Undo2,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { FilePickList } from "@/components/common/FilePickList";
import { uploadMany } from "@/components/document-tree/upload";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/common/DateInput";
import { formatDate } from "@/lib/format";
import {
  approveTask,
  cancelTask,
  decideExtension,
  postTaskUpdate,
  requestExtension,
  returnTask,
  submitTask,
} from "@/server/actions/tasks";
import type { ActionResult } from "@/server/errors";

import { TaskFormDialog, type TaskEditValues, type TaskFormOptions } from "./TaskFormDialog";

export type TaskPermissions = {
  canUpdate: boolean;
  canApprove: boolean;
  /** Đang có đề nghị gia hạn chờ duyệt */
  pendingExtension: { id: string; newDueDate: Date; reason: string; requestedBy: string } | null;
};

type DialogKind =
  "progress" | "submit" | "approve" | "return" | "cancel" | "extension" | "decide" | "edit" | null;

type Props = {
  taskId: string;
  title: string;
  flow: "NEW" | "IN_PROGRESS" | "SUBMITTED" | "DONE" | "CANCELLED";
  progress: number;
  dueDate: Date | null;
  permissions: TaskPermissions;
  edit?: { task: TaskEditValues; options: TaskFormOptions };
  /** Chỉ hiện nút cập nhật tiến độ (dùng ở "Việc của tôi") */
  compact?: boolean;
};

async function finish(
  result: ActionResult<unknown>,
  message: string,
  after?: () => void | Promise<void>,
) {
  if (!result.ok) {
    toast.error(result.error.message);
    return false;
  }
  await after?.();
  toast.success(message);
  return true;
}

/** Các thao tác theo luồng công việc (Mục 5.2) — nút hiện tuỳ trạng thái và quyền */
export function TaskActions({
  taskId,
  title,
  flow,
  progress: currentProgress,
  dueDate,
  permissions,
  edit,
  compact,
}: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(currentProgress);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [newDue, setNewDue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const open = (kind: DialogKind) => {
    setContent("");
    setFiles([]);
    setError(null);
    setProgress(currentProgress);
    setNewDue("");
    setDialog(kind);
  };
  const close = () => setDialog(null);
  const working = flow === "NEW" || flow === "IN_PROGRESS";

  async function run(fn: () => Promise<boolean>) {
    setPending(true);
    try {
      if (await fn()) {
        close();
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  async function uploadEvidence(updateId: string) {
    if (files.length === 0) return;
    const results = await uploadMany({ taskUpdateId: updateId }, files);
    for (const r of results) if (!r.ok) toast.error(r.message, { duration: 10_000 });
  }

  const textarea = (label: string, required: boolean, placeholder?: string) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`task-${dialog}-content`}>
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
      </Label>
      <Textarea
        id={`task-${dialog}-content`}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        rows={4}
      />
    </div>
  );

  const footer = (
    label: string,
    onClick: () => void,
    variant: "default" | "destructive" = "default",
    disabled = false,
  ) => (
    <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
      <Button variant="outline" size="lg" onClick={close} disabled={pending}>
        Huỷ
      </Button>
      <Button size="lg" variant={variant} onClick={onClick} disabled={pending || disabled}>
        {pending ? "Đang lưu…" : label}
      </Button>
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {permissions.canUpdate && working && (
          <Button
            variant={compact ? "outline" : "default"}
            size={compact ? "sm" : "default"}
            onClick={() => open("progress")}
          >
            <TrendingUp aria-hidden />
            Cập nhật tiến độ
          </Button>
        )}
        {!compact && permissions.canUpdate && working && (
          <Button variant="outline" onClick={() => open("submit")}>
            <Send aria-hidden />
            Báo hoàn thành
          </Button>
        )}
        {!compact && permissions.canApprove && flow === "SUBMITTED" && (
          <>
            <Button onClick={() => open("approve")}>
              <CheckCheck aria-hidden />
              Duyệt hoàn thành
            </Button>
            <Button variant="outline" onClick={() => open("return")}>
              <Undo2 aria-hidden />
              Trả lại
            </Button>
          </>
        )}
        {!compact &&
          permissions.canUpdate &&
          working &&
          !permissions.pendingExtension &&
          dueDate && (
            <Button variant="outline" onClick={() => open("extension")}>
              <CalendarClock aria-hidden />
              Đề nghị gia hạn
            </Button>
          )}
        {!compact && permissions.canApprove && permissions.pendingExtension && (
          <Button
            variant="outline"
            className="border-status-due-soon"
            onClick={() => open("decide")}
          >
            <CircleCheck aria-hidden />
            Xét đề nghị gia hạn
          </Button>
        )}
        {!compact && permissions.canApprove && edit && flow !== "DONE" && flow !== "CANCELLED" && (
          <>
            <Button variant="outline" onClick={() => setDialog("edit")}>
              <Pencil aria-hidden />
              Sửa
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => open("cancel")}
            >
              <XCircle aria-hidden />
              Huỷ việc
            </Button>
          </>
        )}
      </div>

      <Dialog open={dialog !== null && dialog !== "edit"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          {dialog === "progress" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">Cập nhật tiến độ</DialogTitle>
                <DialogDescription>{title}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor="task-progress">
                  Tiến độ: <strong className="text-2xl text-brand tabular-nums">{progress}%</strong>
                </Label>
                <input
                  id="task-progress"
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="h-8 w-full accent-[var(--brand)]"
                  aria-valuetext={`${progress}%`}
                />
                <div className="flex justify-between text-sm text-muted-foreground" aria-hidden>
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
              {textarea("Nội dung đã làm", true, "VD: Đã rà soát 40/60 hồ sơ…")}
              <div className="flex flex-col gap-1.5">
                <span className="font-medium">Tệp minh chứng</span>
                <FilePickList files={files} onChange={setFiles} />
              </div>
              {footer("Lưu tiến độ", () =>
                run(async () => {
                  const r = await postTaskUpdate({ taskId, progress, content });
                  return finish(r, "Đã cập nhật tiến độ.", () =>
                    r.ok ? uploadEvidence(r.data.updateId) : undefined,
                  );
                }),
              )}
            </>
          )}
          {dialog === "submit" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">Báo hoàn thành</DialogTitle>
                <DialogDescription>
                  Người giao việc sẽ xác nhận (đóng) hoặc trả lại. Tiến độ được đặt 100%.
                </DialogDescription>
              </DialogHeader>
              {textarea("Kết quả thực hiện", true)}
              <div className="flex flex-col gap-1.5">
                <span className="font-medium">Tệp minh chứng</span>
                <FilePickList files={files} onChange={setFiles} />
              </div>
              {footer("Báo hoàn thành", () =>
                run(async () => {
                  const r = await submitTask({ taskId, content });
                  return finish(r, "Đã báo hoàn thành, chờ duyệt.", () =>
                    r.ok ? uploadEvidence(r.data.updateId) : undefined,
                  );
                }),
              )}
            </>
          )}
          {dialog === "approve" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">Duyệt hoàn thành</DialogTitle>
                <DialogDescription>
                  Công việc sẽ được đóng. Ngày hoàn thành tính theo lúc báo hoàn thành.
                </DialogDescription>
              </DialogHeader>
              {textarea("Ý kiến (không bắt buộc)", false)}
              {footer("Duyệt hoàn thành", () =>
                run(async () =>
                  finish(await approveTask({ taskId, note: content }), "Đã duyệt hoàn thành."),
                ),
              )}
            </>
          )}
          {dialog === "return" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">Trả lại công việc</DialogTitle>
                <DialogDescription>
                  Công việc quay về “Đang thực hiện” để người thực hiện bổ sung.
                </DialogDescription>
              </DialogHeader>
              {textarea("Lý do trả lại", true)}
              {footer(
                "Trả lại",
                () =>
                  run(async () =>
                    finish(await returnTask({ taskId, note: content }), "Đã trả lại công việc."),
                  ),
                "default",
                !content.trim(),
              )}
            </>
          )}
          {dialog === "cancel" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">Huỷ công việc?</DialogTitle>
                <DialogDescription>
                  Công việc sẽ không còn tính vào tiến độ và thống kê. Thao tác không hoàn tác được.
                </DialogDescription>
              </DialogHeader>
              {textarea("Lý do huỷ", true)}
              {footer(
                "Huỷ việc",
                () =>
                  run(async () =>
                    finish(await cancelTask({ taskId, note: content }), "Đã huỷ công việc."),
                  ),
                "destructive",
                !content.trim(),
              )}
            </>
          )}
          {dialog === "extension" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">Đề nghị gia hạn</DialogTitle>
                <DialogDescription>
                  Hạn hiện tại: {formatDate(dueDate)}. Người giao việc sẽ duyệt hoặc từ chối.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="task-new-due">
                  Hạn mới
                  <span className="text-destructive" aria-hidden>
                    *
                  </span>
                </Label>
                <DateInput id="task-new-due" label="Hạn mới" value={newDue} onChange={setNewDue} />
              </div>
              {textarea("Lý do", true)}
              {error && (
                <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
                  {error}
                </p>
              )}
              {footer("Gửi đề nghị", () =>
                run(async () => {
                  const r = await requestExtension({ taskId, newDueDate: newDue, reason: content });
                  if (!r.ok)
                    setError(Object.values(r.error.fieldErrors ?? {})[0] ?? r.error.message);
                  return r.ok ? finish(r, "Đã gửi đề nghị gia hạn.") : false;
                }),
              )}
            </>
          )}
          {dialog === "decide" && permissions.pendingExtension && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">Xét đề nghị gia hạn</DialogTitle>
                <DialogDescription>
                  {permissions.pendingExtension.requestedBy} đề nghị gia hạn từ{" "}
                  {formatDate(dueDate)} đến{" "}
                  <strong>{formatDate(permissions.pendingExtension.newDueDate)}</strong>.
                </DialogDescription>
              </DialogHeader>
              <p className="rounded-lg bg-muted p-3">
                Lý do: {permissions.pendingExtension.reason}
              </p>
              {textarea("Ý kiến (không bắt buộc)", false)}
              <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  size="lg"
                  disabled={pending}
                  onClick={() =>
                    run(async () =>
                      finish(
                        await decideExtension({
                          extensionId: permissions.pendingExtension!.id,
                          approve: false,
                          note: content,
                        }),
                        "Đã từ chối gia hạn.",
                      ),
                    )
                  }
                >
                  Từ chối
                </Button>
                <Button
                  size="lg"
                  disabled={pending}
                  onClick={() =>
                    run(async () =>
                      finish(
                        await decideExtension({
                          extensionId: permissions.pendingExtension!.id,
                          approve: true,
                          note: content,
                        }),
                        "Đã đồng ý gia hạn.",
                      ),
                    )
                  }
                >
                  Đồng ý gia hạn
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {edit && dialog === "edit" && (
        <TaskFormDialog
          open
          onOpenChange={(o) => !o && close()}
          options={edit.options}
          task={edit.task}
        />
      )}
    </>
  );
}
