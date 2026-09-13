namespace LabLink.Application.Admin;

// ---- Users ----
public record UserListItemDto(
    Guid Id,
    string AccountName,
    string FullName,
    string Email,
    string? Department,
    string Status,
    IReadOnlyList<string> Roles,
    DateTimeOffset? LastLoginAt,
    DateTimeOffset CreatedAt,
    Guid? EmployeeId = null,
    string? EmployeeName = null,
    string? DepartmentName = null);

public record CreateUserRequest(
    string AccountName,
    string Password,
    IReadOnlyList<string> RoleCodes,
    string? Email = null,
    string? FullName = null,
    string? Department = null,
    string? Phone = null,
    string? EmployeeCode = null,
    Guid? EmployeeId = null);

public record UpdateUserRequest(
    string AccountName,
    string? FullName,
    string? Department,
    string? Phone,
    string? EmployeeCode,
    Guid? EmployeeId = null);

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
