using LabLink.Domain.Enums;

namespace LabLink.Domain.Entities;

/// <summary>Đề nghị giá cho 1 xét nghiệm trong gói. Lab duyệt/từ chối từng dòng.
/// Giá đã chốt (Approved) là giá dùng khi tạo chỉ định (README · Screen 2).</summary>
public class PriceDeal
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid BatchId { get; set; }
    public PriceDealBatch Batch { get; set; } = null!;

    public Guid LabTestId { get; set; }
    public LabTest LabTest { get; set; } = null!;

    /// <summary>Giá bác sĩ đề nghị (VND).</summary>
    public long ProposedPrice { get; set; }

    public DealStatus Status { get; set; } = DealStatus.Pending;

    public Guid? DecidedById { get; set; }
    public DateTimeOffset? DecidedAt { get; set; }
}
