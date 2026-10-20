// Mọi chuỗi hiển thị cho người dùng (Mục 17.2). Code dùng `vi.<nhóm>.<khoá>`, không viết chữ trực tiếp trong component.

export const vi = {
  app: {
    name: "Theo dõi văn bản, báo cáo & công việc",
    wardName: "Phường Thanh Liệt",
    shortName: "TL",
    description: "Hệ thống theo dõi văn bản, báo cáo và công việc — Phường Thanh Liệt",
  },

  nav: {
    dashboard: "Bảng điều hành",
    myWork: "Việc của tôi",
    documents: "Văn bản",
    reports: "Theo dõi báo cáo",
    tasks: "Công việc",
    area: "Địa bàn",
    wardProfile: "Thông tin phường",
    schools: "Trường học",
    residentials: "Tổ dân phố",
    partyOrgs: "Tổ chức đảng",
    admin: "Quản trị",
    users: "Người dùng",
    departments: "Đơn vị",
    catalogs: "Danh mục",
    auditLog: "Nhật ký",
    trash: "Thùng rác",
    presentation: "Trình chiếu",
    login: "Đăng nhập",
  },

  layout: {
    mainMenu: "Menu chính",
    openMenu: "Mở menu",
    collapseSidebar: "Thu gọn thanh bên",
    expandSidebar: "Mở rộng thanh bên",
    skipToContent: "Bỏ qua, đến nội dung chính",
    search: "Tìm kiếm…",
    searchShortcut: "Ctrl K",
    searchComingSoon: "Tìm kiếm toàn cục sẽ có ở Giai đoạn 5",
    notifications: "Thông báo",
    account: "Tài khoản",
    guest: "Chưa đăng nhập",
  },

  auth: {
    loginTitle: "Đăng nhập hệ thống",
    username: "Tên đăng nhập",
    password: "Mật khẩu",
    login: "Đăng nhập",
    loggingIn: "Đang đăng nhập…",
    logout: "Đăng xuất",
    changePassword: "Đổi mật khẩu",
    currentPassword: "Mật khẩu hiện tại",
    newPassword: "Mật khẩu mới",
    confirmPassword: "Nhập lại mật khẩu mới",
    passwordRule: "Ít nhất 8 ký tự, có cả chữ và số.",
    mustChangeNotice:
      "Đây là lần đăng nhập đầu tiên hoặc mật khẩu vừa được đặt lại. Vui lòng đổi mật khẩu để tiếp tục.",
    changedPassword: "Đã đổi mật khẩu thành công.",
    secretWarning: "Không lưu văn bản có độ mật (Mật, Tối mật, Tuyệt mật) trên hệ thống này.",
    forbiddenTitle: "Không có quyền truy cập",
    forbiddenBody:
      "Tài khoản của bạn không được phép xem trang này. Nếu cần, hãy liên hệ quản trị viên.",
  },

  fontSize: {
    group: "Cỡ chữ",
    decrease: "Giảm cỡ chữ",
    increase: "Tăng cỡ chữ",
    current: (percent: number) => `Cỡ chữ hiện tại ${percent}%`,
  },

  common: {
    underConstruction: "Chức năng đang được xây dựng",
    plannedForPhase: (phase: number) => `Chức năng này sẽ có ở Giai đoạn ${phase}.`,
    backHome: "Về Bảng điều hành",
    retry: "Thử lại",
  },

  errors: {
    notFoundTitle: "Không tìm thấy trang",
    notFoundBody: "Trang bạn tìm không tồn tại hoặc đã được chuyển đi.",
    genericTitle: "Đã có lỗi xảy ra",
    genericBody:
      "Hệ thống gặp sự cố khi xử lý yêu cầu. Vui lòng thử lại; nếu vẫn lỗi, báo cho quản trị viên kèm mã lỗi bên dưới.",
    errorCode: (code: string) => `Mã lỗi: ${code}`,
  },

  format: {
    dueToday: "đến hạn hôm nay",
    daysLeft: (n: number) => `còn ${n} ngày`,
    daysOverdue: (n: number) => `quá ${n} ngày`,
  },
} as const;

export type Vi = typeof vi;
