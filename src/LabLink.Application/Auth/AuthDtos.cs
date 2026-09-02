namespace LabLink.Application.Auth;

public record LoginRequest(string Email, string Password);

public record LoginResponse(string Token, DateTimeOffset ExpiresAt, MeDto User);

/// <summary>Thông tin phiên hiện tại — trả cho GET /api/me.
/// Menu & nút hành động ở client render theo Permissions.</summary>
public record MeDto(
    Guid Id,
    string FullName,
    string Email,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions);
