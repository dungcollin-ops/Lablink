using LabLink.Application.Auth;
using LabLink.Domain.Entities;
using LabLink.Domain.Enums;
using LabLink.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace LabLink.Infrastructure.Auth;

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenService _jwt;

    public AuthService(AppDbContext db, IPasswordHasher hasher, IJwtTokenService jwt)
    {
        _db = db;
        _hasher = hasher;
        _jwt = jwt;
    }

    public async Task<LoginResult> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        // Định danh đăng nhập = Tên tài khoản HOẶC Email (khách lẻ). So khớp không phân biệt hoa/thường.
        var login = request.Email.Trim();
        var loginLower = login.ToLowerInvariant();

        var user = await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role).ThenInclude(r => r.RolePermissions).ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(u => u.AccountName == login
                || (u.Email != null && u.Email == loginLower), ct);

        // Báo rõ người dùng sai cái gì (hệ nội bộ) để họ sửa nhanh.
        if (user is null) return new LoginResult(null, "Tên đăng nhập không tồn tại.");
        if (user.Status != UserStatus.Active) return new LoginResult(null, "Tài khoản đang bị khoá — liên hệ quản trị.");
        if (!_hasher.Verify(request.Password, user.PasswordHash)) return new LoginResult(null, "Mật khẩu không đúng.");

        var (roles, permissions) = Aggregate(user);
        var (token, expiresAt) = _jwt.CreateToken(user, roles, permissions);

        user.LastLoginAt = DateTimeOffset.UtcNow;
        _db.AuditLogs.Add(new AuditLog { UserId = user.Id, Action = "auth.login" });
        await _db.SaveChangesAsync(ct);

        return new LoginResult(new LoginResponse(token, expiresAt, ToMe(user, roles, permissions)), null);
    }

    public async Task<MeDto?> GetMeAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role).ThenInclude(r => r.RolePermissions).ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(u => u.Id == userId, ct);

        if (user is null) return null;
        var (roles, permissions) = Aggregate(user);
        return ToMe(user, roles, permissions);
    }

    private static (List<string> roles, List<string> permissions) Aggregate(User user)
    {
        var roles = user.UserRoles.Select(ur => ur.Role.Code).Distinct().ToList();
        var permissions = user.UserRoles
            .SelectMany(ur => ur.Role.RolePermissions)
            .Select(rp => rp.Permission.Key)
            .Distinct()
            .ToList();
        return (roles, permissions);
    }

    private static MeDto ToMe(User user, List<string> roles, List<string> permissions) =>
        new(user.Id, user.FullName, user.Email ?? "", roles, permissions, user.EmployeeId);
}
