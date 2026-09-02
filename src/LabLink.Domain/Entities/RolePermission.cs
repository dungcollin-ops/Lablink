namespace LabLink.Domain.Entities;

/// <summary>Bảng nối Role × Permission (composite PK).</summary>
public class RolePermission
{
    public Guid RoleId { get; set; }
    public Role Role { get; set; } = null!;

    public int PermissionId { get; set; }
    public Permission Permission { get; set; } = null!;
}
