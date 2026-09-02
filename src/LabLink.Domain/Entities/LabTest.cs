namespace LabLink.Domain.Entities;

/// <summary>Mục danh mục xét nghiệm (README · Catalog).
/// Dữ liệu seed thật ~1184 mục, 2 nhà cung cấp (FastLab, Medic Hòa Hảo).</summary>
public class LabTest
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Mã seed gốc từ prototype (vd "c1") — unique, dùng để seed idempotent.</summary>
    public string ExternalId { get; set; } = "";

    /// <summary>Mã xét nghiệm (vd "XN0001") — KHÔNG unique (lặp theo nhà cung cấp).</summary>
    public string Code { get; set; } = "";

    public string Name { get; set; } = "";

    /// <summary>Nhà cung cấp / nơi thực hiện (FastLab, Medic Hòa Hảo).</summary>
    public string Provider { get; set; } = "";

    /// <summary>Giá niêm yết (VND).</summary>
    public long ListPrice { get; set; }

    /// <summary>Nhóm chuyên môn (Sinh hóa, Huyết học, Miễn dịch...).</summary>
    public string Group { get; set; } = "";

    /// <summary>Loại mẫu + ghi chú lấy mẫu (mảng, thường 1 phần tử).</summary>
    public List<string> Samples { get; set; } = new();

    /// <summary>Thời gian trả kết quả (hiện trống trong dữ liệu nguồn).</summary>
    public string? Turnaround { get; set; }

    public bool IsActive { get; set; } = true;
}
