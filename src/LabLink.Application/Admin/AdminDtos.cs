namespace LabLink.Application.Admin;

// ---- Users ----
public record UserListItemDto(
    Guid Id,
    string FullName,
    string Email,
    string? Department,
    string Status,
    IReadOnlyList<string> Roles,
    DateTimeOffset? LastLoginAt,
    DateTimeOffset CreatedAt);

public record CreateUserRequest(
    string FullName,
    string Email,
    string Password,
    IReadOnlyList<string> RoleCodes,
    string? Department = null,
    string? Phone = null,
    string? EmployeeCode = null);

public record UpdateUserRequest(
    string FullName,
    string? Department,
    string? Phone,
    string? EmployeeCode);

public record SetRolesRequest(IReadOnlyList<string> RoleCodes);
public record SetStatusRequest(string Status);
public record ResetPasswordRequest(string NewPassword);

// ---- Roles / permissions ----
public record RoleDto(
    Guid Id,
    string Code,
    string Name,
    string? Description,
    IReadOnlyList<string> Permissions,
    int UserCount);

public record SetRolePermissionsRequest(IReadOnlyList<string> PermissionKeys);

// ---- Audit ----
public record AuditItemDto(
    long Id,
    Guid? UserId,
    string? UserName,
    string Action,
    string? ObjectType,
    string? ObjectId,
    string? Detail,
    DateTimeOffset At);

public record AuditPage(int Total, int Page, int PageSize, IReadOnlyList<AuditItemDto> Items);

/// <summary>Kết quả thao tác admin — thất bại kèm thông điệp.</summary>
public record AdminResult(bool Ok, string? Error = null)
{
    public static readonly AdminResult Success = new(true);
    public static AdminResult Fail(string msg) => new(false, msg);
}
