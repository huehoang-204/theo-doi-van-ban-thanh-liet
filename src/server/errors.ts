// Kiểu kết quả & lỗi nghiệp vụ dùng chung cho server action và route handler.

export type ActionError = {
  /** Mã ngắn để hỗ trợ (VD FORBIDDEN, DUPLICATE, E1A2B3C) */
  code: string;
  /** Câu tiếng Việt đầy đủ hiển thị cho người dùng */
  message: string;
  /** Lỗi theo từng ô nhập (khoá = tên trường) */
  fieldErrors?: Record<string, string>;
};

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

/** Lỗi có chủ đích — thông điệp an toàn để hiện cho người dùng */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }

  toJSON(): ActionError {
    return { code: this.code, message: this.message, fieldErrors: this.fieldErrors };
  }
}
