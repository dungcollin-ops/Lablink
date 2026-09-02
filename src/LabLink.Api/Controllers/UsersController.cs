using LabLink.Api.Authorization;
using LabLink.Application.Admin;
using LabLink.Domain.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabLink.Api.Controllers;

[ApiController]
[Route("api/admin/users")]
[HasPermission(Permissions.UserManage)]
public class UsersController : AdminControllerBase
{
    private readonly IUserAdminService _svc;

    public UsersController(IUserAdminService svc) => _svc = svc;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UserListItemDto>>> List(
        [FromQuery] string? query, [FromQuery] string? role, [FromQuery] string? status, CancellationToken ct)
        => Ok(await _svc.ListAsync(query, role, status, ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserListItemDto>> Get(Guid id, CancellationToken ct)
    {
        var u = await _svc.GetAsync(id, ct);
        return u is null ? NotFound() : Ok(u);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest req, CancellationToken ct)
    {
        var (result, id) = await _svc.CreateAsync(req, ActorId, ct);
        return result.Ok ? Ok(new { id }) : BadRequest(new { message = result.Error });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserRequest req, CancellationToken ct)
        => Result(await _svc.UpdateAsync(id, req, ActorId, ct));

    [HttpPut("{id:guid}/roles")]
    public async Task<IActionResult> SetRoles(Guid id, [FromBody] SetRolesRequest req, CancellationToken ct)
        => Result(await _svc.SetRolesAsync(id, req, ActorId, ct));

    [HttpPut("{id:guid}/status")]
    public async Task<IActionResult> SetStatus(Guid id, [FromBody] SetStatusRequest req, CancellationToken ct)
        => Result(await _svc.SetStatusAsync(id, req, ActorId, ct));

    [HttpPost("{id:guid}/reset-password")]
    public async Task<IActionResult> ResetPassword(Guid id, [FromBody] ResetPasswordRequest req, CancellationToken ct)
        => Result(await _svc.ResetPasswordAsync(id, req, ActorId, ct));

    private IActionResult Result(AdminResult r) =>
        r.Ok ? Ok(new { ok = true }) : BadRequest(new { message = r.Error });
}
