using LabLink.Domain.Enums;

namespace LabLink.Domain.Entities;

/// <summary>Một lần bác sĩ gửi gói đề nghị giá cho lab (README · Screen 2).
/// Scope hiện theo bác sĩ đề nghị; mở rộng theo phòng khám sau.</summary>
public class PriceDealBatch
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProposedById { get; set; }
    public User ProposedBy { get; set; } = null!;

    /// <summary>Phòng khám của người gửi (lấy từ NV) — deal chốt dùng chung trong phòng.</summary>
    public Guid? DepartmentId { get; set; }
    public Department? Department { get; set; }

    /// <summary>Ghi chú chung gửi kèm (dealNote).</summary>
    public string? Note { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<PriceDeal> Items { get; set; } = new List<PriceDeal>();
}
