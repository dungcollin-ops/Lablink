using LabLink.Api.Authorization;
using LabLink.Application.Deals;
using LabLink.Domain.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabLink.Api.Controllers;

[ApiController]
[Route("api/deals")]
public class DealsController : AdminControllerBase
{
    private readonly IDealService _svc;

    public DealsController(IDealService svc) => _svc = svc;

    /// <summary>Bác sĩ gửi gói đề nghị giá.</summary>
    [HttpPost]
    [HasPermission(Permissions.DealCreate)]
    public async Task<IActionResult> Create([FromBody] CreateDealBatchRequest req, CancellationToken ct)
    {
        var (result, id) = await _svc.CreateBatchAsync(ActorId, req, ct);
        return result.Ok ? Ok(new { id }) : BadRequest(new { message = result.Error });
    }

    /// <summary>Các gói đề nghị của chính bác sĩ.</summary>
    [HttpGet("mine")]
    [HasPermission(Permissions.DealCreate)]
    public async Task<ActionResult<IReadOnlyList<DealBatchDto>>> Mine(CancellationToken ct)
        => Ok(await _svc.GetMineAsync(ActorId, ct));

    /// <summary>Các gói còn dòng chờ duyệt (lab).</summary>
    [HttpGet("pending")]
    [HasPermission(Permissions.DealApprove)]
    public async Task<ActionResult<IReadOnlyList<DealBatchDto>>> Pending(CancellationToken ct)
        => Ok(await _svc.GetPendingAsync(ct));

    [HttpGet("pending-count")]
    [HasPermission(Permissions.DealApprove)]
    public async Task<ActionResult<int>> PendingCount(CancellationToken ct)
        => Ok(await _svc.PendingCountAsync(ct));

    [HttpPost("items/{id:guid}/approve")]
    [HasPermission(Permissions.DealApprove)]
    public async Task<IActionResult> ApproveItem(Guid id, CancellationToken ct)
        => Result(await _svc.DecideItemAsync(id, true, ActorId, ct));

    [HttpPost("items/{id:guid}/reject")]
    [HasPermission(Permissions.DealApprove)]
    public async Task<IActionResult> RejectItem(Guid id, CancellationToken ct)
        => Result(await _svc.DecideItemAsync(id, false, ActorId, ct));

    [HttpPost("{batchId:guid}/approve-all")]
    [HasPermission(Permissions.DealApprove)]
    public async Task<IActionResult> ApproveBatch(Guid batchId, CancellationToken ct)
        => Result(await _svc.DecideBatchAsync(batchId, true, ActorId, ct));

    [HttpPost("{batchId:guid}/reject-all")]
    [HasPermission(Permissions.DealApprove)]
    public async Task<IActionResult> RejectBatch(Guid batchId, CancellationToken ct)
        => Result(await _svc.DecideBatchAsync(batchId, false, ActorId, ct));

    private IActionResult Result(DealResult r) =>
        r.Ok ? Ok(new { ok = true }) : BadRequest(new { message = r.Error });
}
