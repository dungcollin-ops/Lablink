namespace LabLink.Domain.Entities;

/// <summary>Hồ sơ bệnh nhân (README · Screen 3 · form hành chính).</summary>
public class Patient
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Mã bệnh nhân MMYY#### — tự sinh khi trống.</summary>
    public string MaBN { get; set; } = "";

    public string FullName { get; set; } = "";

    /// <summary>Ngày sinh lưu dạng partial: "yyyy" (chỉ năm) | "yyyy-MM" | "yyyy-MM-dd".
    /// Năm bắt buộc; ngày/tháng tùy chọn (BS/BN có thể không biết ngày/tháng).</summary>
    public string? Dob { get; set; }
    public string? Gender { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }

    /// <summary>CCCD.</summary>
    public string? NationalId { get; set; }

    public string? Bhyt { get; set; }
    public string? Address { get; set; }
    public string? Note { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
