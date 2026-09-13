namespace LabLink.Application.Admin;

public interface IUserAdminService
{
    Task<IReadOnlyList<UserListItemDto>> ListAsync(
        string? query, string? roleCode, string? status, CancellationToken ct = default);

    Task<UserListItemDto?> GetAsync(Guid id, CancellationToken ct = default);

    Task<(AdminResult result, Guid? id)> CreateAsync(
        CreateUserRequest req, Guid actorId, CancellationToken ct = default);

    Task<AdminResult> UpdateAsync(Guid id, UpdateUserRequest req, Guid actorId, CancellationToken ct = default);
    Task<AdminResult> SetRolesAsync(Guid id, SetRolesRequest req, Guid actorId, CancellationToken ct = default);
    Task<AdminResult> SetStatusAsync(Guid id, SetStatusRequest req, Guid actorId, CancellationToken ct = default);
    Task<AdminResult> ResetPasswordAsync(Guid id, ResetPasswordRequest req, Guid actorId, CancellationToken ct = default);

    /// <summary>Xóa hẳn user — chỉ khi CHƯA phát sinh dữ liệu (không có phiếu / đề xuất giá). Không tự xóa chính mình.</summary>
    Task<AdminResult> DeleteAsync(Guid id, Guid actorId, CancellationToken ct = default);
}

public interface IRoleAdminService
{
    Task<IReadOnlyList<RoleDto>> ListAsync(CancellationToken ct = default);
    Task<IReadOnlyList<string>> AllPermissionsAsync(CancellationToken ct = default);
    Task<AdminResult> SetPermissionsAsync(Guid roleId, SetRolePermissionsRequest req, Guid actorId, CancellationToken ct = default);
}

public interface IAuditQueryService
{
    Task<AuditPage> ListAsync(string? action, int page, int pageSize, CancellationToken ct = default);
}
