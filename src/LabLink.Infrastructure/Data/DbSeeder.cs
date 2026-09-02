using LabLink.Application.Auth;
using LabLink.Domain.Authorization;
using LabLink.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LabLink.Infrastructure.Data;

/// <summary>Seed dữ liệu nền: permission, nhóm (role), ánh xạ quyền, và user demo.
/// Idempotent — chạy được nhiều lần. DEMO users chỉ để dev/test.</summary>
public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext db, IPasswordHasher hasher, bool seedDemoUsers = true, CancellationToken ct = default)
    {
        // 1) Permissions
        var existingPerms = await db.Permissions.Select(p => p.Key).ToListAsync(ct);
        foreach (var key in Permissions.All.Except(existingPerms))
            db.Permissions.Add(new Permission { Key = key });
        await db.SaveChangesAsync(ct);

        var permByKey = await db.Permissions.ToDictionaryAsync(p => p.Key, p => p, ct);

        // 2) Roles + role-permissions
        foreach (var seed in DefaultRoles.All)
        {
            var role = await db.Roles
                .Include(r => r.RolePermissions)
                .FirstOrDefaultAsync(r => r.Code == seed.Code, ct);

            if (role is null)
            {
                role = new Role { Code = seed.Code, Name = seed.Name };
                db.Roles.Add(role);
                await db.SaveChangesAsync(ct);
            }

            var have = role.RolePermissions.Select(rp => rp.PermissionId).ToHashSet();
            foreach (var pk in seed.Permissions)
            {
                if (permByKey.TryGetValue(pk, out var perm) && !have.Contains(perm.Id))
                    db.RolePermissions.Add(new RolePermission { RoleId = role.Id, PermissionId = perm.Id });
            }
        }
        await db.SaveChangesAsync(ct);

        // 3) Demo users (dev/test) — bỏ qua nếu Seed:DemoUsers = false
        if (!seedDemoUsers) return;

        var demoUsers = new (string Email, string FullName, string RoleCode)[]
        {
            ("bacsi@lablink.local", "BS. Trần Minh", "doctor"),
            ("khachle@lablink.local", "Nguyễn Khách Lẻ", "retail"),
            ("lab@lablink.local", "KTV. Lê Hoà Hảo", "lab"),
            ("admin@lablink.local", "Quản trị viên", "admin"),
        };

        var rolesByCode = await db.Roles.ToDictionaryAsync(r => r.Code, r => r, ct);

        foreach (var (email, fullName, roleCode) in demoUsers)
        {
            if (await db.Users.AnyAsync(u => u.Email == email, ct)) continue;

            var user = new User
            {
                Email = email,
                FullName = fullName,
                PasswordHash = hasher.Hash("demo"),
            };
            db.Users.Add(user);
            if (rolesByCode.TryGetValue(roleCode, out var role))
                db.UserRoles.Add(new UserRole { User = user, Role = role });
        }
        await db.SaveChangesAsync(ct);
    }
}
