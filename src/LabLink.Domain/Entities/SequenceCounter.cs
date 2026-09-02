namespace LabLink.Domain.Entities;

/// <summary>Bộ đếm tăng dần dùng chung, tăng atomic phía server để sinh
/// SID / MaBN / mã phiếu (chống trùng khi nhiều máy chạy song song).
/// Key ví dụ: "SID:130826", "MABN:0826", "ORDER".</summary>
public class SequenceCounter
{
    public string Key { get; set; } = "";
    public long NextSeq { get; set; }
}
