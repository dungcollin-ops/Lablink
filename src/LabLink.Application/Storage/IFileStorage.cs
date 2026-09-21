namespace LabLink.Application.Storage;

/// <summary>Lưu file nhị phân (kết quả XN, ảnh bằng chứng…) ra nơi lưu trữ ngoài DB.
/// Bản hiện tại: đĩa cục bộ trên VPS. DB chỉ giữ "key" (đường dẫn tương đối).</summary>
public interface IFileStorage
{
    /// <summary>Lưu file vào nhóm <paramref name="category"/> (vd "results", "qc"),
    /// trả về key tương đối để lưu vào DB.</summary>
    Task<string> SaveAsync(string category, string originalFileName, byte[] content, CancellationToken ct = default);

    /// <summary>Đọc file theo key. Null nếu không tồn tại.</summary>
    Task<byte[]?> ReadAsync(string key, CancellationToken ct = default);

    /// <summary>Xoá file theo key (bỏ qua nếu không có).</summary>
    void Delete(string key);
}
