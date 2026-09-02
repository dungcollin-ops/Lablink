namespace LabLink.Application.Auth;

public interface IAuthService
{
    /// <summary>Xác thực email + mật khẩu; trả token + thông tin phiên, hoặc null nếu sai.</summary>
    Task<LoginResponse?> LoginAsync(LoginRequest request, CancellationToken ct = default);

    /// <summary>Lấy thông tin phiên theo userId (cho GET /api/me).</summary>
    Task<MeDto?> GetMeAsync(Guid userId, CancellationToken ct = default);
}
