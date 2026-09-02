using LabLink.Api.Authorization;
using LabLink.Application.Admin;
using LabLink.Domain.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabLink.Api.Controllers;

[ApiController]
[Route("api/admin/audit")]
[HasPermission(Permissions.AuditRead)]
public class AuditController : ControllerBase
{
    private readonly IAuditQueryService _svc;

    public AuditController(IAuditQueryService svc) => _svc = svc;

    [HttpGet]
    public async Task<ActionResult<AuditPage>> List(
        [FromQuery] string? action, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
        => Ok(await _svc.ListAsync(action, page, pageSize, ct));
}
