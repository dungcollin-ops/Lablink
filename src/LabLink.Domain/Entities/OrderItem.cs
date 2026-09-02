namespace LabLink.Domain.Entities;

/// <summary>Dòng xét nghiệm trong phiếu. Giá &amp; tên chốt tại thời điểm tạo.</summary>
public class OrderItem
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;

    public Guid LabTestId { get; set; }
    public string TestCode { get; set; } = "";
    public string TestName { get; set; } = "";

    /// <summary>Loại mẫu đã chọn cho dòng này.</summary>
    public string SampleType { get; set; } = "";

    public int Qty { get; set; } = 1;

    /// <summary>Giá áp dụng (giá chốt deal nếu có, ngược lại niêm yết).</summary>
    public long UnitPrice { get; set; }
}
