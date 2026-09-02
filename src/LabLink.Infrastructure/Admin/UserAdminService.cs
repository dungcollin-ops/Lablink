using LabLink.Application.Admin;
using LabLink.Application.Auth;
using LabLink.Domain.Entities;
using LabLink.Domain.Enums;
using LabLink.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace LabLink.Infrastructure.Admin;

public class UserAdminService : IUserAdminService
{
    private readonly AppDbContext _db;
    private readonly IPasswordHasher _hasher;

    public UserAdminService(AppDbContext db, IPasswordHasher hasher)
    {
        _db = db;
        _hasher = hasher;
    }

    public async Task<IReadOnlyList<UserListItemDto>> ListAsync(
        string? query, string? roleCode, string? status, CancellationToken ct = default)
    {
        var q = _db.Users.AsNoTracking()
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query))
        {
            var t = query.Trim();
            q = q.Where(u => EF.Functions.ILike(u.FullName, $"%{t}%")
                          || EF.Functions.ILike(u.Email, $"%{t}%"));
        }
        if (!string.IsNullOrWhiteSpace(roleCode))
            q = q.Where(u => u.UserRoles.Any(ur => ur.Role.Code == roleCode));
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<UserStatus>(status, true, out var st))
            q = q.Where(u => u.Status == st);

        var users = await q.OrderBy(u => u.FullName).ToListAsync(ct);
        return users.Select(Map).ToList();
    }

    public async Task<UserListItemDto?> GetAsync(Guid id, CancellationToken ct = default)
    {
        var u = await _db.Users.AsNoTracking()
            .Include(x => x.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        return u is null ? null : Map(u);
    }

    public async Task<(AdminResult result, Guid? id)> CreateAsync(
        CreateUserRequest req, Guid actorId, CancellationToken ct = default)
    {
        var email = req.Email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(req.FullName))
            return (AdminResult.Fail("Thiếu họ tên."), null);
        if (string.IsNullOrWhiteSpace(email))
            return (AdminResult.Fail("Thiếu email."), null);
        if (string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 4)
            return (AdminResult.Fail("Mật khẩu tối thiểu 4 ký tự."), null);
        if (await _db.Users.AnyAsync(u => u.Email == email, ct))
            return (AdminResult.Fail("Email đã tồn tại."), null);

        var user = new User
        {
            FullName = req.FullName.Trim(),
            Email = email,
            Phone = req.Phone,
            Department = req.Department,
            EmployeeCode = string.IsNullOrWhiteSpace(req.EmployeeCode) ? null : req.EmployeeCode,
            PasswordHash = _hasher.Hash(req.Password),
        };
        _db.Users.Add(user);
        await AssignRolesAsync(user, req.RoleCodes, ct);

        Audit(actorId, "user.create", "User", user.Id.ToString(), user.Email);
        await _db.SaveChangesAsync(ct);
        return (AdminResult.Success, user.Id);
    }

    public async Task<AdminResult> UpdateAsync(Guid id, UpdateUserRequest req, Guid actorId, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return AdminResult.Fail("Không tìm thấy người dùng.");
        if (string.IsNullOrWhiteSpace(req.FullName)) return AdminResult.Fail("Thiếu họ tên.");

        user.FullName = req.FullName.Trim();
        user.Department = req.Department;
        user.Phone = req.Phone;
        user.EmployeeCode = string.IsNullOrWhiteSpace(req.EmployeeCode) ? null : req.EmployeeCode;

        Audit(actorId, "user.update", "User", user.Id.ToString(), null);
        await _db.SaveChangesAsync(ct);
        return AdminResult.Success;
    }

    public async Task<AdminResult> SetRolesAsync(Guid id, SetRolesRequest req, Guid actorId, CancellationToken ct = default)
    {
        var user = await _db.Users.Include(u => u.UserRoles)
            .FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return AdminResult.Fail("Không tìm thấy người dùng.");

        _db.UserRoles.RemoveRange(user.UserRoles);
        await AssignRolesAsync(user, req.RoleCodes, ct);

        Audit(actorId, "user.roles", "User", user.Id.ToString(), string.Join(",", req.RoleCodes));
        await _db.SaveChangesAsync(ct);
        return AdminResult.Success;
    }

    public async Task<AdminResult> SetStatusAsync(Guid id, SetStatusRequest req, Guid actorId, CancellationToken ct = default)
    {
        if (!Enum.TryParse<UserStatus>(req.Status, true, out var st))
            return AdminResult.Fail("Trạng thái không hợp lệ.");
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return AdminResult.Fail("Không tìm thấy người dùng.");

        user.Status = st;
        Audit(actorId, "user.status", "User", user.Id.ToString(), st.ToString());
        await _db.SaveChangesAsync(ct);
        return AdminResult.Success;
    }

    public async Task<AdminResult> ResetPasswordAsync(Guid id, ResetPasswordRequest req, Guid actorId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 4)
            return AdminResult.Fail("Mật khẩu tối thiểu 4 ký tự.");
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return AdminResult.Fail("Không tìm thấy người dùng.");

        user.PasswordHash = _hasher.Hash(req.NewPassword);
        Audit(actorId, "user.reset_password", "User", user.Id.ToString(), null);
        await _db.SaveChangesAsync(ct);
        return AdminResult.Success;
    }

    private async Task AssignRolesAsync(User user, IReadOnlyList<string> codes, CancellationToken ct)
    {
        if (codes.Count == 0) return;
        var roles = await _db.Roles.Where(r => codes.Contains(r.Code)).ToListAsync(ct);
        foreach (var role in roles)
            _db.UserRoles.Add(new UserRole { User = user, Role = role });
    }

    private void Audit(Guid actorId, string action, string objType, string objId, string? detail) =>
        _db.AuditLogs.Add(new AuditLog
        {
            UserId = actorId,
            Action = action,
            ObjectType = objType,
            ObjectId = objId,
            Detail = detail,
        });

    private static UserListItemDto Map(User u) => new(
        u.Id, u.FullName, u.Email, u.Department,
        u.Status.ToString(),
        u.UserRoles.Select(ur => ur.Role.Code).ToList(),
        u.LastLoginAt, u.CreatedAt);
}
