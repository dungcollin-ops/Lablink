namespace LabLink.Domain.Entities;

/// <summary>Nhóm quyền. Một user có thể mang nhiều role (README · RBAC).</summary>
public class Role
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Mã role, vd "doctor", "lab", "admin" (unique).</summary>
    public string Code { get; set; } = "";

    public string Name { get; set; } = "";

    public string? Description { get; set; }

    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
}
