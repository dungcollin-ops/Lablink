namespace LabLink.Domain.Enums;

public enum OrderSource
{
    Doctor = 0,
    Retail = 1,
}

/// <summary>Tiến trình phiếu — 7 bước (B1–B7):
/// Chỉ định → Lấy mẫu → Gom mẫu → Nhận mẫu → Có kết quả → Giao bản cứng → Nhận bản cứng.</summary>
public enum OrderStage
{
    Ordered = 0,          // B1 · Chờ lấy mẫu
    Collected = 1,        // B2 · Đã lấy mẫu
    Gathered = 2,         // B3 · Đã gom mẫu
    Received = 3,         // B4 · Đã nhận mẫu
    Resulted = 4,         // B5 · Có kết quả (file mềm)
    HardCopySent = 5,     // B6 · Đã giao bản cứng
    HardCopyReceived = 6, // B7 · Đã nhận bản cứng (hoàn tất)
}

public enum SampleQuality
{
    Unset = 0,
    Pass = 1,
    Fail = 2,
}
