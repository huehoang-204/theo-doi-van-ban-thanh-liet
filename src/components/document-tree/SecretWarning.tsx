import { ShieldAlert } from "lucide-react";

/** Cảnh báo bắt buộc trên mọi nơi tải tệp (Mục 13.3) */
export function SecretWarning() {
  return (
    <p
      role="note"
      className="flex items-start gap-2 rounded-lg border border-accent-red/40 bg-accent-red/5 px-3 py-2 font-medium text-accent-red"
    >
      <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
      Không tải lên văn bản có độ mật (Mật, Tối mật, Tuyệt mật).
    </p>
  );
}
