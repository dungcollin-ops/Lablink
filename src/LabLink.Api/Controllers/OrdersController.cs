using LabLink.Api.Authorization;
using LabLink.Application.Orders;
using LabLink.Domain.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabLink.Api.Controllers;

[ApiController]
[Route("api/orders")]
public class OrdersController : AdminControllerBase
{
    private readonly IOrderService _svc;

    public OrdersController(IOrderService svc) => _svc = svc;

    // Lab (nhận mẫu) thấy mọi phiếu; bác sĩ/khách chỉ thấy phiếu của mình.
    private bool SeeAll => HasPerm(Permissions.SampleReceive);

    /// <summary>Tạo phiếu chỉ định → sinh SID → trả phiếu.</summary>
    [HttpPost]
    [HasPermission(Permissions.OrderCreate)]
    public async Task<IActionResult> Create([FromBody] CreateOrderRequest req, CancellationToken ct)
    {
        var r = await _svc.CreateAsync(ActorId, req, ct);
        return r.Ok ? Ok(r.Order) : BadRequest(new { message = r.Error });
    }

    /// <summary>Danh sách phiếu để theo dõi.</summary>
    [HttpGet]
    [HasPermission(Permissions.OrderRead)]
    public async Task<ActionResult<IReadOnlyList<OrderListItemDto>>> List(
        [FromQuery] string? query, [FromQuery] string? stage, CancellationToken ct)
        => Ok(await _svc.ListAsync(ActorId, SeeAll, query, stage, ct));

    [HttpGet("{id:guid}")]
    [HasPermission(Permissions.OrderRead)]
    public async Task<ActionResult<OrderDto>> Get(Guid id, CancellationToken ct)
    {
        var o = await _svc.GetAsync(id, ActorId, SeeAll, ct);
        return o is null ? NotFound() : Ok(o);
    }

    /// <summary>Phiếu đầy đủ để xem/sửa (kèm chi tiết bệnh nhân + cờ Editable).</summary>
    [HttpGet("{id:guid}/full")]
    [HasPermission(Permissions.OrderRead)]
    public async Task<ActionResult<OrderFullDto>> GetFull(Guid id, CancellationToken ct)
    {
        var o = await _svc.GetFullAsync(id, ActorId, SeeAll, ct);
        return o is null ? NotFound() : Ok(o);
    }

    /// <summary>Sửa phiếu khi chưa gửi PXN (hồ sơ BN + phiếu + xét nghiệm).</summary>
    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.OrderCreate)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateOrderRequest req, CancellationToken ct)
    {
        var r = await _svc.UpdateAsync(id, ActorId, SeeAll, req, ct);
        return r.Ok ? Ok(r.Order) : BadRequest(new { message = r.Error });
    }

    /// <summary>Chuyển trạng thái phiếu — mỗi bước cần đúng quyền của bước đó.</summary>
    [HttpPost("{id:guid}/stage")]
    [Authorize]
    public async Task<IActionResult> SetStage(Guid id, [FromBody] SetStageRequest req, CancellationToken ct)
    {
        // "Có kết quả" đi qua upload (service tự chặn). Các bước khác: cần đúng quyền.
        if (req.Stage != "Resulted")
        {
            var required = RequiredPermForStage(req.Stage);
            if (required is null || !HasPerm(required))
                return StatusCode(403, new { message = "Bạn không có quyền thực hiện bước này." });
        }
        var r = await _svc.SetStageAsync(id, req.Stage, ActorId, req.By, ct);
        return r.Ok ? Ok(r.Order) : BadRequest(new { message = r.Error });
    }

    private static string? RequiredPermForStage(string stage) => stage switch
    {
        "Collected" => Permissions.SampleCollect,
        "Gathered" => Permissions.SampleGather,
        "Received" => Permissions.SampleReceive,
        "HardCopySent" => Permissions.HardcopyDeliver,
        "HardCopyReceived" => Permissions.HardcopyReceive,
        _ => null,
    };

    /// <summary>Lab đánh giá chất lượng 1 mẫu (Đạt/Không đạt).</summary>
    [HttpPost("samples/{sampleId:guid}/quality")]
    [HasPermission(Permissions.SampleQc)]
    public async Task<IActionResult> SetQuality(Guid sampleId, [FromBody] SetQualityRequest req, CancellationToken ct)
    {
        var r = await _svc.SetSampleQualityAsync(sampleId, req.Quality, ActorId, ct);
        return r.Ok ? Ok(r.Order) : BadRequest(new { message = r.Error });
    }

    /// <summary>PXN phân công NV đến lấy mẫu (khách lẻ) → sinh SID + Đã soạn mẫu.</summary>
    [HttpPost("{id:guid}/assign-collect")]
    [HasPermission(Permissions.SampleCollect)]
    public async Task<IActionResult> AssignCollect(Guid id, [FromBody] AssignCollectRequest req, CancellationToken ct)
    {
        var r = await _svc.AssignCollectAsync(id, req, ActorId, ct);
        return r.Ok ? Ok(r.Order) : BadRequest(new { message = r.Error });
    }

    /// <summary>Phòng khám gửi mẫu → Đã gửi (phiếu của mình).</summary>
    [HttpPost("{id:guid}/send")]
    [HasPermission(Permissions.SampleSend)]
    public async Task<IActionResult> SendSample(Guid id, [FromBody] SendSampleRequest req, CancellationToken ct)
    {
        var r = await _svc.SendSampleAsync(id, req, ActorId, SeeAll, ct);
        return r.Ok ? Ok(r.Order) : BadRequest(new { message = r.Error });
    }

    /// <summary>Lab cập nhật tiến trình mẫu chi tiết (lấy/gửi/nhận).</summary>
    [HttpPost("{id:guid}/progress")]
    [HasPermission(Permissions.SampleReceive)]
    public async Task<IActionResult> SetProgress(Guid id, [FromBody] SetProgressRequest req, CancellationToken ct)
    {
        var r = await _svc.SetProgressAsync(id, req, ActorId, ct);
        return r.Ok ? Ok(r.Order) : BadRequest(new { message = r.Error });
    }

    /// <summary>Lab tải file kết quả lên (multipart).</summary>
    [HttpPost("{id:guid}/result")]
    [HasPermission(Permissions.ResultUpload)]
    [RequestSizeLimit(20_000_000)]
    public async Task<IActionResult> UploadResult(Guid id, IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return BadRequest(new { message = "Chưa chọn file." });
        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        var r = await _svc.UploadResultAsync(id, file.FileName, file.ContentType, ms.ToArray(), ActorId, ct);
        return r.Ok ? Ok(r.Order) : BadRequest(new { message = r.Error });
    }

    /// <summary>Tải file kết quả (ghi log tải; theo phạm vi).</summary>
    [HttpGet("{id:guid}/result")]
    [HasPermission(Permissions.ResultRead)]
    public async Task<IActionResult> DownloadResult(Guid id, CancellationToken ct)
    {
        var f = await _svc.DownloadResultAsync(id, ActorId, SeeAll, ct);
        return f is null ? NotFound() : File(f.Content, f.ContentType, f.FileName);
    }
}

[ApiController]
[Route("api/patients")]
public class PatientsController : AdminControllerBase
{
    private readonly IPatientService _svc;

    public PatientsController(IPatientService svc) => _svc = svc;

    [HttpGet("search")]
    [HasPermission(Permissions.OrderCreate)]
    public async Task<ActionResult<IReadOnlyList<PatientSearchDto>>> Search(
        [FromQuery] string q, CancellationToken ct)
        => Ok(await _svc.SearchAsync(q, ct));
}
