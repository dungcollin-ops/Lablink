namespace LabLink.Domain.Entities;

/// <summary>Phòng ban / đơn vị gửi mẫu: Phòng khám, Phòng xét nghiệm, Phòng CĐHA,
/// Phòng mạch, Nội bộ FastLab… Nhân viên thuộc về một Phòng ban.</summary>
public class Department
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Name { get; set; } = "";

    /// <summary>Loại phòng ban (danh sách cố định ở UI):
    /// Phòng khám · Phòng xét nghiệm · Phòng CĐHA · Phòng mạch · Nội bộ…</summary>
    public string Type { get; set; } = "Phòng khám";

    public string? Address { get; set; }
    public string? Phone { get; set; }

    /// <summary>Đơn vị có lấy bản cứng không → quyết định phiếu của đơn vị này có B6/B7.</summary>
    public bool HardCopyRequired { get; set; } = true;

    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
