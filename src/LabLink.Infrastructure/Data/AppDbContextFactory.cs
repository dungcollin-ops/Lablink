using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace LabLink.Infrastructure.Data;

/// <summary>Factory dùng lúc thiết kế (dotnet ef migrations add ...).
/// Không kết nối DB thật — chỉ cần chuỗi hợp lệ về cú pháp để sinh migration.
/// Runtime (database update / chạy app) dùng connection string từ config.</summary>
public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var conn =
            Environment.GetEnvironmentVariable("LABLINK_CONNECTION")
            ?? "Host=localhost;Port=5432;Database=lablink;Username=postgres;Password=postgres";

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(conn)
            .Options;

        return new AppDbContext(options);
    }
}
