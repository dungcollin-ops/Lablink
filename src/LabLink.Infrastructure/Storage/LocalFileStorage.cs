using LabLink.Application.Storage;

namespace LabLink.Infrastructure.Storage;

/// <summary>Lưu file ra đĩa cục bộ (trên VPS). Key = đường dẫn tương đối "category/xxxx.ext".
/// Root cấu hình qua Storage:Path; mặc định {thư mục chạy}/storage.</summary>
public class LocalFileStorage : IFileStorage
{
    private readonly string _root;

    public LocalFileStorage(string root)
    {
        _root = root;
        Directory.CreateDirectory(_root);
    }

    private string FullPath(string key) => Path.Combine(_root, key.Replace('/', Path.DirectorySeparatorChar));

    public async Task<string> SaveAsync(string category, string originalFileName, byte[] content, CancellationToken ct = default)
    {
        var ext = Path.GetExtension(originalFileName ?? "");
        var key = $"{category}/{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid():N}{ext}";
        var full = FullPath(key);
        Directory.CreateDirectory(Path.GetDirectoryName(full)!);
        await File.WriteAllBytesAsync(full, content, ct);
        return key;
    }

    public async Task<byte[]?> ReadAsync(string key, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(key)) return null;
        var full = FullPath(key);
        if (!File.Exists(full)) return null;
        return await File.ReadAllBytesAsync(full, ct);
    }

    public void Delete(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) return;
        var full = FullPath(key);
        if (File.Exists(full)) File.Delete(full);
    }
}
