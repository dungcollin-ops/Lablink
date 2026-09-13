using LabLink.Api.Authorization;
using LabLink.Application.Departments;
using LabLink.Domain.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabLink.Api.Controllers;

[ApiController]
[Route("api/employees")]
public class EmployeesController : AdminControllerBase
{
    private readonly IDepartmentService _svc;
    public EmployeesController(IDepartmentService svc) => _svc = svc;

    /// <summary>Danh mục nhân viên (lọc theo phòng ban tuỳ chọn).</summary>
    [HttpGet]
    [HasPermission(Permissions.DepartmentManage)]
    public async Task<ActionResult<IReadOnlyList<EmployeeDto>>> List(
        [FromQuery] Guid? departmentId, [FromQuery] bool includeInactive = false, CancellationToken ct = default)
        => Ok(await _svc.ListEmployeesAsync(departmentId, includeInactive, ct));

    /// <summary>Danh sách bác sĩ cho ô "Bác sĩ chỉ định" (theo phòng của người tạo) — dùng khi tạo phiếu.</summary>
    [HttpGet("doctors")]
    [HasPermission(Permissions.OrderCreate)]
    public async Task<ActionResult<IReadOnlyList<EmployeeDto>>> Doctors(CancellationToken ct)
        => Ok(await _svc.ListDoctorsForUserAsync(ActorId, ct));

    [HttpPost]
    [HasPermission(Permissions.DepartmentManage)]
    public async Task<IActionResult> Create([FromBody] EmployeeInput input, CancellationToken ct)
    {
        var e = await _svc.CreateEmployeeAsync(input, ct);
        return e is null ? BadRequest(new { message = "Thiếu tên nhân viên hoặc phòng ban không hợp lệ." }) : Ok(e);
    }

    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.DepartmentManage)]
    public async Task<IActionResult> Update(Guid id, [FromBody] EmployeeInput input, CancellationToken ct)
    {
        var e = await _svc.UpdateEmployeeAsync(id, input, ct);
        return e is null ? NotFound() : Ok(e);
    }
}
