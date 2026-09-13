using LabLink.Api.Authorization;
using LabLink.Application.Departments;
using LabLink.Domain.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabLink.Api.Controllers;

[ApiController]
[Route("api/departments")]
public class DepartmentsController : AdminControllerBase
{
    private readonly IDepartmentService _svc;
    public DepartmentsController(IDepartmentService svc) => _svc = svc;

    /// <summary>Danh mục phòng ban. includeInactive=true để lấy cả đã ẩn.</summary>
    [HttpGet]
    [HasPermission(Permissions.DepartmentManage)]
    public async Task<ActionResult<IReadOnlyList<DepartmentDto>>> List(
        [FromQuery] bool includeInactive = false, CancellationToken ct = default)
        => Ok(await _svc.ListAsync(includeInactive, ct));

    [HttpPost]
    [HasPermission(Permissions.DepartmentManage)]
    public async Task<IActionResult> Create([FromBody] DepartmentInput input, CancellationToken ct)
    {
        var d = await _svc.CreateAsync(input, ct);
        return d is null ? BadRequest(new { message = "Thiếu tên phòng ban." }) : Ok(d);
    }

    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.DepartmentManage)]
    public async Task<IActionResult> Update(Guid id, [FromBody] DepartmentInput input, CancellationToken ct)
    {
        var d = await _svc.UpdateAsync(id, input, ct);
        return d is null ? NotFound() : Ok(d);
    }
}
