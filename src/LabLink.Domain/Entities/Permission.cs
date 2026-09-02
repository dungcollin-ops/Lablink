namespace LabLink.Domain.Entities;

/// <summary>Quyền hạt nhỏ dạng "&lt;đối tượng&gt;.&lt;hành động&gt;"
/// vd "order.create", "deal.approve" (README · RBAC).</summary>
public class Permission
{
    public int Id { get; set; }

    /// <summary>Key duy nhất, vd "order.create".</summary>
    public string Key { get; set; } = "";

    public string? Description { get; set; }

    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
}
