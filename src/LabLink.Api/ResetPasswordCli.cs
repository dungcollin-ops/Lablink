using System.Text;
using LabLink.Application.Auth;
using LabLink.Domain.Entities;
using LabLink.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace LabLink.Api;

/// <summary>Đặt lại mật khẩu từ dòng lệnh — dùng khi không còn tài khoản admin nào đăng nhập được.
/// Mật khẩu nhập ẩn (không hiện ký tự), không đi qua mạng, không lưu vào lịch sử shell.</summary>
public static class ResetPasswordCli
{
    public static async Task RunAsync(IServiceProvider services, string login)
    {
        Console.OutputEncoding = Encoding.UTF8;
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var key = login.Trim();
        var lower = key.ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.AccountName == key || (u.Email != null && u.Email == lower));
        if (user is null)
        {
            Console.Error.WriteLine($"Không tìm thấy tài khoản '{key}'.");
            Environment.ExitCode = 1;
            return;
        }

        Console.WriteLine($"Đặt lại mật khẩu cho: {user.AccountName} — {user.FullName}");
        var pw = ReadSecret("Mật khẩu mới (tối thiểu 8 ký tự): ");
        if (pw.Length < 8)
        {
            Console.Error.WriteLine("Mật khẩu tối thiểu 8 ký tự. Không thay đổi gì.");
            Environment.ExitCode = 1;
            return;
        }
        if (ReadSecret("Nhập lại mật khẩu: ") != pw)
        {
            Console.Error.WriteLine("Hai lần nhập không khớp. Không thay đổi gì.");
            Environment.ExitCode = 1;
            return;
        }

        user.PasswordHash = hasher.Hash(pw);
        db.AuditLogs.Add(new AuditLog
        {
            UserId = user.Id, Action = "user.reset_password",
            ObjectType = "User", ObjectId = user.Id.ToString(), Detail = "cli (break-glass)",
        });
        await db.SaveChangesAsync();
        Console.WriteLine("Đã đổi mật khẩu. Đăng nhập lại bằng mật khẩu mới.");
    }

    /// <summary>Đọc chuỗi từ bàn phím, không hiện ký tự.</summary>
    private static string ReadSecret(string prompt)
    {
        Console.Write(prompt);
        var sb = new StringBuilder();
        while (true)
        {
            var k = Console.ReadKey(intercept: true);
            if (k.Key == ConsoleKey.Enter) break;
            if (k.Key == ConsoleKey.Backspace) { if (sb.Length > 0) sb.Length--; continue; }
            if (!char.IsControl(k.KeyChar)) sb.Append(k.KeyChar);
        }
        Console.WriteLine();
        return sb.ToString();
    }
}
