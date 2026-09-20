using System.Security.Claims;
using LabLink.Application.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabLink.Api.Controllers;

[ApiController]
[Route("api")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;

    public AuthController(IAuthService auth) => _auth = auth;

    /// <summary>Đăng nhập bằng email + mật khẩu → JWT + thông tin phiên.</summary>
    [HttpPost("auth/login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login(
        [FromBody] LoginRequest request, CancellationToken ct)
    {
        var result = await _auth.LoginAsync(request, ct);
        if (result.Response is null)
            return Unauthorized(new { message = result.Error ?? "Đăng nhập không thành công." });
        return Ok(result.Response);
    }

    /// <summary>Thông tin phiên hiện tại (user + roles + permissions).</summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<MeDto>> Me(CancellationToken ct)
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(sub, out var userId)) return Unauthorized();

        var me = await _auth.GetMeAsync(userId, ct);
        return me is null ? Unauthorized() : Ok(me);
    }
}
