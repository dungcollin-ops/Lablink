using LabLink.Domain.Enums;

namespace LabLink.Domain.Entities;

/// <summary>Mẫu bệnh phẩm — 1 loại mẫu = 1 SID (README · buildSamples).</summary>
public class Sample
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;

    /// <summary>Mã SID DDMMYY-#### (sinh atomic phía server).</summary>
    public string Sid { get; set; } = "";

    public string SampleType { get; set; } = "";
    public string? TubeType { get; set; }

    public SampleQuality Quality { get; set; } = SampleQuality.Unset;

    // Tiến trình mẫu (điền ở phase lab workflow).
    public string? CollectedBy { get; set; }
    public DateTimeOffset? CollectedAt { get; set; }
    public string? ReceivedBy { get; set; }
    public DateTimeOffset? ReceivedAt { get; set; }
}
