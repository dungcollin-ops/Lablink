using LabLink.Domain.Entities;

namespace LabLink.Application.Auth;

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string hash);
}

public interface IJwtTokenService
{
    (string token, DateTimeOffset expiresAt) CreateToken(
        User user,
        IEnumerable<string> roles,
        IEnumerable<string> permissions);
}
