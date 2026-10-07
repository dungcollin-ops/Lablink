using LabLink.Api.Authorization;
using LabLink.Application.Catalog;
using LabLink.Domain.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabLink.Api.Controllers;

[ApiController]
[Route("api/catalog")]
public class CatalogController : ControllerBase
{
    private readonly ICatalogService _catalog;

    public CatalogController(ICatalogService catalog) => _catalog = catalog;

    /// <summary>Tra cứu danh mục (tìm/lọc theo nhóm, nhà cung cấp, phân trang).</summary>
    [HttpGet]
    [HasPermission(Permissions.CatalogRead)]
    public async Task<ActionResult<CatalogPage>> Search(
        [FromQuery] string? query,
        [FromQuery] string? group,
        [FromQuery] string? provider,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] bool includeInactive = false,
        CancellationToken ct = default)
    {
        // Mục đã ngưng sử dụng chỉ hiện cho admin danh mục (để dùng lại); các màn chọn XN
        // (phiếu, combo, đề nghị giá) luôn chỉ thấy mục đang dùng.
        includeInactive = includeInactive && User.HasClaim("perm", Permissions.CatalogManage);
        return Ok(await _catalog.SearchAsync(
            new CatalogQuery(query, group, provider, page, pageSize, includeInactive), ct));
    }

    /// <summary>Danh sách nhóm + nhà cung cấp để dựng bộ lọc.</summary>
    [HttpGet("facets")]
    [HasPermission(Permissions.CatalogRead)]
    public async Task<ActionResult<CatalogFacets>> Facets(CancellationToken ct)
        => Ok(await _catalog.GetFacetsAsync(ct));

    /// <summary>Sửa TG Min/Max (giờ) của 1 xét nghiệm.</summary>
    [HttpPut("{id:guid}/tat")]
    [HasPermission(Permissions.CatalogPriceEdit)]
    public async Task<IActionResult> UpdateTat(Guid id, [FromBody] UpdateTatRequest req, CancellationToken ct)
        => await _catalog.UpdateTatAsync(id, req.TatMinHours, req.TatMaxHours, ct) ? NoContent() : NotFound();

    /// <summary>Thêm 1 xét nghiệm vào danh mục (admin).</summary>
    [HttpPost]
    [HasPermission(Permissions.CatalogManage)]
    public async Task<IActionResult> Create([FromBody] CatalogItemInput input, CancellationToken ct)
    {
        var r = await _catalog.CreateAsync(input, ct);
        return r.Ok ? Ok(r.Item) : BadRequest(new { message = r.Error });
    }

    /// <summary>Sửa đầy đủ 1 xét nghiệm (admin).</summary>
    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.CatalogManage)]
    public async Task<IActionResult> Update(Guid id, [FromBody] CatalogItemInput input, CancellationToken ct)
    {
        var r = await _catalog.UpdateAsync(id, input, ct);
        return r.Ok ? Ok(r.Item) : BadRequest(new { message = r.Error });
    }

    /// <summary>Ngưng sử dụng 1 xét nghiệm (admin) — xóa mềm, dòng vẫn giữ trong DB.</summary>
    [HttpDelete("{id:guid}")]
    [HasPermission(Permissions.CatalogManage)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var r = await _catalog.DeleteAsync(id, ct);
        return r.Ok ? Ok(new { ok = true }) : BadRequest(new { message = r.Error });
    }

    /// <summary>Dùng lại 1 xét nghiệm đã ngưng sử dụng (admin).</summary>
    [HttpPost("{id:guid}/restore")]
    [HasPermission(Permissions.CatalogManage)]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct)
    {
        var r = await _catalog.RestoreAsync(id, ct);
        return r.Ok ? Ok(r.Item) : BadRequest(new { message = r.Error });
    }
}
