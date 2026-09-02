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

    public async Task<LoginResponse?> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        var user = await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role).ThenInclude(r => r.RolePermissions).ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(u => u.Email == email, ct);

        if (user is null || user.Status != UserStatus.Active) return null;
        if (!_hasher.Verify(request.Password, user.PasswordHash)) return null;

        var (roles, permissions) = Aggregate(user);
        var (token, expiresAt) = _jwt.CreateToken(user, roles, permissions);

        user.LastLoginAt = DateTimeOffset.UtcNow;
        _db.AuditLogs.Add(new AuditLog { UserId = user.Id, Action = "auth.login" });
        await _db.SaveChangesAsync(ct);

        return new LoginResponse(token, expiresAt, ToMe(user, roles, permissions));
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
        new(user.Id, user.FullName, user.Email, roles, permissions);
}
