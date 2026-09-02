namespace LabLink.Infrastructure.Auth;

public class JwtOptions
{
    public const string Section = "Jwt";

    public string Issuer { get; set; } = "LabLink";
    public string Audience { get; set; } = "LabLink";

    /// <summary>Khoá ký HMAC — đặt qua user-secrets / biến môi trường, KHÔNG commit.</summary>
    public string SigningKey { get; set; } = "";

    public int ExpiryMinutes { get; set; } = 480; // 8 giờ
}
