namespace LabLink.Domain.Entities;

/// <summary>File kết quả xét nghiệm của phiếu (README · Screen 8 · trả kết quả).
/// Lưu có kiểm soát truy cập; mọi lần tải đều ghi log (audit).</summary>
public class TestResult
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;

    public string FileName { get; set; } = "";
    public string ContentType { get; set; } = "application/pdf";

    /// <summary>Nội dung file (bytea). Bản production lớn nên chuyển sang object storage.</summary>
    public byte[] Content { get; set; } = Array.Empty<byte>();

    public long Size { get; set; }

    public Guid UploadedById { get; set; }
    public DateTimeOffset UploadedAt { get; set; } = DateTimeOffset.UtcNow;

    public Guid? VerifiedById { get; set; }
    public DateTimeOffset? VerifiedAt { get; set; }
}
