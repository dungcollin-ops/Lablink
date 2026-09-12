using LabLink.Domain.Enums;

namespace LabLink.Domain.Entities;

/// <summary>Nhật ký từng bước của phiếu (timeline "ai làm gì lúc nào").
/// Mỗi lần một actor xác nhận 1 bước → ghi 1 dòng.</summary>
public class OrderEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;

    /// <summary>Bước vừa xác nhận (trạng thái phiếu chuyển tới).</summary>
    public OrderStage Step { get; set; }

    public Guid ActorId { get; set; }

    /// <summary>Tên người thực hiện — chụp lại lúc xác nhận để hiển thị khỏi join.</summary>
    public string ActorName { get; set; } = "";

    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;

    public string? Note { get; set; }
}
