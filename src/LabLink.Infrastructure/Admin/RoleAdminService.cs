using LabLink.Application.Admin;
using LabLink.Domain.Entities;
using LabLink.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace LabLink.Infrastructure.Admin;

public class RoleAdminService : IRoleAdminService
{
    private readonly AppDbContext _db;

    public RoleAdminService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<RoleDto>> ListAsync(CancellationToken ct = default)
    {
        var roles = await _db.Roles.AsNoTracking()
            .Include(r => r.RolePermissions).ThenInclude(rp => rp.Permission)
            .Include(r => r.UserRoles)
            .OrderBy(r => r.Name)
            .ToListAsync(ct);

        return roles.Select(r => new RoleDto(
            r.Id, r.Code, r.Name, r.Description,
            r.RolePermissions.Select(rp => rp.Permission.Key).OrderBy(k => k).ToList(),
            r.UserRoles.Count)).ToList();
    }

    public async Task<IReadOnlyList<string>> AllPermissionsAsync(CancellationToken ct = default) =>
        await _db.Permissions.AsNoTracking().Select(p => p.Key).OrderBy(k => k).ToListAsync(ct);

    public async Task<AdminResult> SetPermissionsAsync(
        Guid roleId, SetRolePermissionsRequest req, Guid actorId, CancellationToken ct = default)
    {
        var role = await _db.Roles.Include(r => r.RolePermissions)
            .FirstOrDefaultAsync(r => r.Id == roleId, ct);
        if (role is null) return AdminResult.Fail("Không tìm thấy vai trò.");

        var perms = await _db.Permissions
            .Where(p => req.PermissionKeys.Contains(p.Key))
            .ToListAsync(ct);

        _db.RolePermissions.RemoveRange(role.RolePermissions);
        foreach (var p in perms)
            _db.RolePermissions.Add(new RolePermission { RoleId = role.Id, PermissionId = p.Id });

        _db.AuditLogs.Add(new AuditLog
        {
            UserId = actorId,
            Action = "role.permissions",
            ObjectType = "Role",
            ObjectId = role.Id.ToString(),
            Detail = $"{role.Code}: {perms.Count} quyền",
        });
        await _db.SaveChangesAsync(ct);
        return AdminResult.Success;
    }
}

public class AuditQueryService : IAuditQueryService
{
    private readonly AppDbContext _db;

    public AuditQueryService(AppDbContext db) => _db = db;

    public async Task<AuditPage> ListAsync(string? action, int page, int pageSize, CancellationToken ct = default)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 200 ? 50 : pageSize;

        var q = _db.AuditLogs.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(action))
            q = q.Where(a => a.Action == action);

        var total = await q.CountAsync(ct);

        var rows = await q.OrderByDescending(a => a.At)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync(ct);

        // Lookup tên người thực hiện (giữ cả bản ghi không có actor).
        var ids = rows.Where(r => r.UserId != null).Select(r => r.UserId!.Value).Distinct().ToList();
        var names = await _db.Users.Where(u => ids.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FullName, ct);

        var items = rows.Select(a => new AuditItemDto(
            a.Id, a.UserId,
            a.UserId != null && names.TryGetValue(a.UserId.Value, out var n) ? n : null,
            a.Action, a.ObjectType, a.ObjectId, a.Detail, a.At)).ToList();

        return new AuditPage(total, page, pageSize, items);
    }
}
