namespace LabLink.Domain.Entities;

/// <summary>Nhân viên thuộc một Phòng ban (bác sĩ, điều dưỡng, KTV, giao nhận…).
/// User đăng nhập được map tới một Employee.</summary>
public class Employee
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid DepartmentId { get; set; }
    public Department Department { get; set; } = null!;

    public string FullName { get; set; } = "";

    /// <summary>Mã nhân viên (tuỳ chọn).</summary>
    public string? Code { get; set; }

    /// <summary>Chức danh (danh sách cố định ở UI): Bác sĩ · Điều dưỡng · KTV · Giao nhận · Khác.</summary>
    public string Position { get; set; } = "";

    public string? Phone { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
