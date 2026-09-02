using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace LabLink.Api.Controllers;

public abstract class AdminControllerBase : ControllerBase
{
    /// <summary>Id người dùng đang thao tác (từ JWT) — để ghi audit.</summary>
    protected Guid ActorId
    {
        get
        {
            var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            return Guid.TryParse(sub, out var id) ? id : Guid.Empty;
        }
    }

    /// <summary>User hiện tại có permission (claim "perm") hay không.</summary>
    protected bool HasPerm(string permission) =>
        User.HasClaim("perm", permission);
}
