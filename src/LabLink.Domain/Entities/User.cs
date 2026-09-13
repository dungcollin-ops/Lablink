using LabLink.Domain.Enums;

namespace LabLink.Domain.Entities;

/// <summary>Người dùng hệ thống (README · RBAC · Đối tượng dữ liệu).</summary>
public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Mã nhân viên.</summary>
    public string? EmployeeCode { get; set; }

    /// <summary>Tên tài khoản (hiển thị/nhận diện) — tách khỏi Họ tên (lấy từ Nhân viên).</summary>
    public string AccountName { get; set; } = "";

    /// <summary>Họ tên (lấy từ Nhân viên nếu có gắn).</summary>
    public string FullName { get; set; } = "";

    /// <summary>Email — chỉ bắt buộc với khách lẻ; đăng nhập được bằng email (unique khi có).</summary>
    public string? Email { get; set; }

    public string PasswordHash { get; set; } = "";

    public string? Phone { get; set; }

    /// <summary>Đơn vị / phòng ban.</summary>
    public string? Department { get; set; }

    public UserStatus Status { get; set; } = UserStatus.Active;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? LastLoginAt { get; set; }

    /// <summary>Nhân viên (danh mục) mà tài khoản này đại diện — từ đó biết phòng ban.</summary>
    public Guid? EmployeeId { get; set; }
    public Employee? Employee { get; set; }

    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
}
