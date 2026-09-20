namespace LabLink.Application.Auth;

public interface IAuthService
{
    /// <summary>Xác thực tên đăng nhập/email + mật khẩu; trả token + phiên, hoặc lý do lỗi rõ ràng.</summary>
    Task<LoginResult> LoginAsync(LoginRequest request, CancellationToken ct = default);

    /// <summary>Lấy thông tin phiên theo userId (cho GET /api/me).</summary>
    Task<MeDto?> GetMeAsync(Guid userId, CancellationToken ct = default);
}
