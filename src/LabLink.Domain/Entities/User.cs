using LabLink.Domain.Enums;

namespace LabLink.Domain.Entities;

/// <summary>Người dùng hệ thống (README · RBAC · Đối tượng dữ liệu).</summary>
public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Mã nhân viên.</summary>
    public string? EmployeeCode { get; set; }

    public string FullName { get; set; } = "";

    /// <summary>Email — dùng để đăng nhập (unique).</summary>
    public string Email { get; set; } = "";

    public string PasswordHash { get; set; } = "";

    public string? Phone { get; set; }

    /// <summary>Đơn vị / phòng ban.</summary>
    public string? Department { get; set; }

    public UserStatus Status { get; set; } = UserStatus.Active;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? LastLoginAt { get; set; }

    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
}
