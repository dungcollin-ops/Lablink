namespace LabLink.Domain.Entities;

/// <summary>Nhật ký hoạt động — ai, làm gì, lúc nào, trên đối tượng nào
/// (README · RBAC · bắt buộc log các hành động nhạy cảm).</summary>
public class AuditLog
{
    public long Id { get; set; }

    public Guid? UserId { get; set; }

    /// <summary>Hành động, vd "auth.login", "deal.approve", "result.download".</summary>
    public string Action { get; set; } = "";

    public string? ObjectType { get; set; }
    public string? ObjectId { get; set; }

    /// <summary>Chi tiết bổ sung (JSON).</summary>
    public string? Detail { get; set; }

    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
}
