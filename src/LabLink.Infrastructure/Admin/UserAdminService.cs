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
            .Include(u => u.Employee).ThenInclude(e => e!.Department)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query))
        {
            var t = query.Trim();
            q = q.Where(u => EF.Functions.ILike(u.FullName, $"%{t}%")
                          || EF.Functions.ILike(u.AccountName, $"%{t}%")
                          || (u.Email != null && EF.Functions.ILike(u.Email, $"%{t}%")));
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
            .Include(x => x.Employee).ThenInclude(e => e!.Department)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        return u is null ? null : Map(u);
    }

    public async Task<(AdminResult result, Guid? id)> CreateAsync(
        CreateUserRequest req, Guid actorId, CancellationToken ct = default)
    {
        var accountName = req.AccountName?.Trim() ?? "";
        var email = string.IsNullOrWhiteSpace(req.Email) ? null : req.Email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(accountName))
            return (AdminResult.Fail("Thiếu tên tài khoản."), null);
        if (string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 4)
            return (AdminResult.Fail("Mật khẩu tối thiểu 4 ký tự."), null);
        if (await _db.Users.AnyAsync(u => u.AccountName == accountName, ct))
            return (AdminResult.Fail("Tên tài khoản đã tồn tại."), null);
        if (email is not null && await _db.Users.AnyAsync(u => u.Email == email, ct))
            return (AdminResult.Fail("Email đã tồn tại."), null);

        // Họ tên lấy từ Nhân viên nếu có gắn, không thì dùng tên tài khoản.
        var fullName = req.FullName?.Trim();
        var department = req.Department;
        if (req.EmployeeId is Guid ceid)
        {
            var emp = await _db.Employees.Include(e => e.Department).FirstOrDefaultAsync(e => e.Id == ceid, ct);
            if (emp is not null) { fullName = emp.FullName; department = emp.Department.Name; }
        }

        var user = new User
        {
            AccountName = accountName,
            FullName = string.IsNullOrWhiteSpace(fullName) ? accountName : fullName,
            Email = email,
            Phone = req.Phone,
            Department = department,
            EmployeeCode = string.IsNullOrWhiteSpace(req.EmployeeCode) ? null : req.EmployeeCode,
            EmployeeId = req.EmployeeId,
            PasswordHash = _hasher.Hash(req.Password),
        };
        _db.Users.Add(user);
        await AssignRolesAsync(user, req.RoleCodes, ct);

        Audit(actorId, "user.create", "User", user.Id.ToString(), user.AccountName);
        await _db.SaveChangesAsync(ct);
        return (AdminResult.Success, user.Id);
    }

    public async Task<AdminResult> UpdateAsync(Guid id, UpdateUserRequest req, Guid actorId, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return AdminResult.Fail("Không tìm thấy người dùng.");

        var accountName = req.AccountName?.Trim();
        if (!string.IsNullOrWhiteSpace(accountName) && accountName != user.AccountName)
        {
            if (await _db.Users.AnyAsync(u => u.AccountName == accountName && u.Id != id, ct))
                return AdminResult.Fail("Tên tài khoản đã tồn tại.");
            user.AccountName = accountName;
        }

        user.Department = req.Department;
        user.Phone = req.Phone;
        user.EmployeeCode = string.IsNullOrWhiteSpace(req.EmployeeCode) ? null : req.EmployeeCode;
        user.EmployeeId = req.EmployeeId;
        // Họ tên & phòng ban theo Nhân viên gắn kèm.
        if (req.EmployeeId is Guid eid)
        {
            var emp = await _db.Employees.Include(e => e.Department).FirstOrDefaultAsync(e => e.Id == eid, ct);
            if (emp is not null) { user.FullName = emp.FullName; user.Department = emp.Department.Name; }
        }
        else if (!string.IsNullOrWhiteSpace(req.FullName))
        {
            user.FullName = req.FullName.Trim();
        }

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

    public async Task<AdminResult> DeleteAsync(Guid id, Guid actorId, CancellationToken ct = default)
    {
        if (id == actorId) return AdminResult.Fail("Không thể tự xóa tài khoản của mình.");

        var user = await _db.Users.Include(u => u.UserRoles).FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return AdminResult.Fail("Không tìm thấy người dùng.");

        // Chỉ xóa khi chưa phát sinh dữ liệu nghiệp vụ.
        if (await _db.Orders.AnyAsync(o => o.CreatedById == id, ct))
            return AdminResult.Fail("Đã phát sinh phiếu — không xóa được (hãy khoá tài khoản).");
        if (await _db.PriceDealBatches.AnyAsync(b => b.ProposedById == id, ct))
            return AdminResult.Fail("Đã phát sinh đề xuất giá — không xóa được (hãy khoá tài khoản).");

        // Dọn dữ liệu phụ thuộc: vai trò + nhật ký hoạt động của chính user này.
        _db.UserRoles.RemoveRange(user.UserRoles);
        var logs = await _db.AuditLogs.Where(a => a.UserId == id).ToListAsync(ct);
        _db.AuditLogs.RemoveRange(logs);
        _db.Users.Remove(user);

        Audit(actorId, "user.delete", "User", id.ToString(), user.AccountName);
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
        u.Id, u.AccountName, u.FullName, u.Email ?? "", u.Department,
        u.Status.ToString(),
        u.UserRoles.Select(ur => ur.Role.Code).ToList(),
        u.LastLoginAt, u.CreatedAt,
        u.EmployeeId, u.Employee?.FullName, u.Employee?.Department?.Name);
}
