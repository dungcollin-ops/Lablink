using LabLink.Api.Authorization;
using LabLink.Application.Reports;
using LabLink.Domain.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabLink.Api.Controllers;

[ApiController]
[Route("api/reports")]
public class ReportsController : ControllerBase
{
    private readonly IReportService _svc;

    public ReportsController(IReportService svc) => _svc = svc;

    [HttpGet("summary")]
    [HasPermission(Permissions.ReportRead)]
    public async Task<ActionResult<ReportSummary>> Summary(
        [FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to, CancellationToken ct)
        => Ok(await _svc.GetSummaryAsync(from, to, ct));
}
