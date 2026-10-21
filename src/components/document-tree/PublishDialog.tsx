"use client";

import { Search, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { hasRecipients, resolveRecipients } from "@/lib/publish";
import { normalizeForSearch } from "@/lib/text";
import { publishDocument } from "@/server/actions/publishing";

import { SecretWarning } from "./SecretWarning";

export type PublishOptions = {
  departments: { value: string; label: string }[];
  users: { value: string; label: string; departmentId: string | null }[];
};

type Props = {
  documentId: string;
  documentLabel: string;
  /** Đã ban hành trước đó → nút "Gửi bổ sung" */
  published: boolean;
  /** Người đã nhận (để đếm người mới) */
  alreadyIds: string[];
  currentUserId: string;
  options: PublishOptions;
};

/** Ban hành / gửi văn bản tới Toàn phường, đơn vị, cá nhân — người nhận có thông báo và được xem, tải tệp */
export function PublishButton(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Send aria-hidden />
        {props.published ? "Gửi bổ sung" : "Ban hành / Gửi"}
      </Button>
      {open && <PublishDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function PublishDialog({
  documentId,
  documentLabel,
  published,
  alreadyIds,
  currentUserId,
  options,
  onClose,
}: Props & { onClose: () => void }) {
  const router = useRouter();
  const ids = useId();
  const [all, setAll] = useState(false);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of options.users)
      if (u.departmentId && u.value !== currentUserId)
        m.set(u.departmentId, (m.get(u.departmentId) ?? 0) + 1);
    return m;
  }, [options.users, currentUserId]);

  const choice = { all, departmentIds, userIds };
  const resolved = resolveRecipients(
    choice,
    options.users.map((u) => ({ id: u.value, departmentId: u.departmentId, active: true })),
    currentUserId,
  ).userIds;
  const already = new Set(alreadyIds);
  const newCount = resolved.filter((id) => !already.has(id)).length;

  const q = normalizeForSearch(query);
  const userList = options.users.filter(
    (u) => u.value !== currentUserId && (!q || normalizeForSearch(u.label).includes(q)),
  );
  const userLabel = new Map(options.users.map((u) => [u.value, u.label]));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasRecipients(choice)) {
      setError("Hãy chọn người nhận: Toàn phường, ít nhất một đơn vị hoặc một người.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await publishDocument({ id: documentId, ...choice, message });
      if (!r.ok) {
        setError(r.error.fieldErrors?.recipients ?? r.error.message);
        return;
      }
      toast.success(
        r.data.added === 0
          ? "Những người đã chọn đều đã nhận văn bản này trước đó."
          : `${r.data.firstTime ? "Đã ban hành" : "Đã gửi bổ sung"} tới ${r.data.added} người — họ sẽ nhận được thông báo.`,
      );
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {published ? "Gửi bổ sung văn bản" : "Ban hành / gửi văn bản"}
            </DialogTitle>
            <DialogDescription>
              “{documentLabel}” — người nhận có thông báo trên chuông, được xem chi tiết và tải tệp
              đính kèm.
            </DialogDescription>
          </DialogHeader>
          <SecretWarning />

          <fieldset
            className="flex flex-col gap-3"
            aria-describedby={error ? `${ids}-err` : undefined}
          >
            <legend className="mb-1 font-semibold">
              Người nhận <span className="text-accent-red">*</span>
            </legend>
            <label className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox checked={all} onCheckedChange={(v) => setAll(v === true)} />
              <span>
                <span className="font-medium">Toàn phường</span>
                <span className="block text-sm text-muted-foreground">
                  Mọi tài khoản đang hoạt động
                </span>
              </span>
            </label>

            {!all && (
              <>
                <div>
                  <p className="mb-2 font-medium">Đơn vị</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {options.departments.map((d) => (
                      <label
                        key={d.value}
                        className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted"
                      >
                        <Checkbox
                          checked={departmentIds.includes(d.value)}
                          onCheckedChange={() => toggle(departmentIds, setDepartmentIds, d.value)}
                        />
                        <span className="min-w-0 flex-1">{d.label}</span>
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {counts.get(d.value) ?? 0} người
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor={`${ids}-q`} className="mb-2">
                    Cá nhân
                  </Label>
                  {userIds.length > 0 && (
                    <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Cá nhân đã chọn">
                      {userIds.map((id) => (
                        <li key={id}>
                          <button
                            type="button"
                            onClick={() => toggle(userIds, setUserIds, id)}
                            className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-sm text-brand"
                            aria-label={`Bỏ ${userLabel.get(id)}`}
                          >
                            {userLabel.get(id)}
                            <X className="size-3.5" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      id={`${ids}-q`}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Tìm theo tên hoặc đơn vị…"
                      className="pl-9"
                    />
                  </div>
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border">
                    {userList.length === 0 ? (
                      <p className="p-3 text-muted-foreground">Không tìm thấy người phù hợp.</p>
                    ) : (
                      userList.map((u) => (
                        <label
                          key={u.value}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-muted"
                        >
                          <Checkbox
                            checked={userIds.includes(u.value)}
                            onCheckedChange={() => toggle(userIds, setUserIds, u.value)}
                          />
                          <span>{u.label}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
            {error && (
              <p id={`${ids}-err`} className="text-destructive" role="alert">
                {error}
              </p>
            )}
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${ids}-msg`}>Lời gửi kèm</Label>
            <Textarea
              id={`${ids}-msg`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={4000}
              placeholder={
                "Kính gửi: các đơn vị…\nĐề nghị các đơn vị nghiên cứu, triển khai thực hiện."
              }
            />
          </div>

          <DialogFooter className="items-center gap-3 sm:justify-between">
            <p className="text-muted-foreground" aria-live="polite">
              {resolved.length === 0
                ? "Chưa chọn người nhận."
                : published
                  ? `${newCount} người nhận mới (${resolved.length} người đã chọn)`
                  : `Sẽ gửi tới ${resolved.length} người`}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Huỷ
              </Button>
              <Button type="submit" disabled={pending}>
                <Send aria-hidden />
                {pending ? "Đang gửi…" : published ? "Gửi bổ sung" : "Ban hành"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
