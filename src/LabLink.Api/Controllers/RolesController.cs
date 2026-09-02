using LabLink.Api.Authorization;
using LabLink.Application.Admin;
using LabLink.Domain.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabLink.Api.Controllers;

[ApiController]
[Route("api/admin")]
[HasPermission(Permissions.RoleManage)]
public class RolesController : AdminControllerBase
{
    private readonly IRoleAdminService _svc;

    public RolesController(IRoleAdminService svc) => _svc = svc;

    [HttpGet("roles")]
    public async Task<ActionResult<IReadOnlyList<RoleDto>>> Roles(CancellationToken ct)
        => Ok(await _svc.ListAsync(ct));

    [HttpGet("permissions")]
    public async Task<ActionResult<IReadOnlyList<string>>> GetPermissions(CancellationToken ct)
        => Ok(await _svc.AllPermissionsAsync(ct));

    [HttpPut("roles/{id:guid}/permissions")]
    public async Task<IActionResult> SetPermissions(
        Guid id, [FromBody] SetRolePermissionsRequest req, CancellationToken ct)
    {
        var r = await _svc.SetPermissionsAsync(id, req, ActorId, ct);
        return r.Ok ? Ok(new { ok = true }) : BadRequest(new { message = r.Error });
    }
}
