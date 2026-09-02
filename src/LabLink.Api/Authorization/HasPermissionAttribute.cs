using Microsoft.AspNetCore.Authorization;

namespace LabLink.Api.Authorization;

/// <summary>Gắn lên endpoint để yêu cầu 1 permission cụ thể.
/// Vd: [HasPermission(Permissions.DealApprove)]. Server luôn kiểm tra ở đây,
/// client chỉ ẩn/hiện UI.</summary>
public sealed class HasPermissionAttribute : AuthorizeAttribute
{
    public const string Prefix = "perm:";

    public HasPermissionAttribute(string permission) => Policy = Prefix + permission;
}
