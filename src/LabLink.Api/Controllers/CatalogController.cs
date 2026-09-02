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
        CancellationToken ct = default)
        => Ok(await _catalog.SearchAsync(new CatalogQuery(query, group, provider, page, pageSize), ct));

    /// <summary>Danh sách nhóm + nhà cung cấp để dựng bộ lọc.</summary>
    [HttpGet("facets")]
    [HasPermission(Permissions.CatalogRead)]
    public async Task<ActionResult<CatalogFacets>> Facets(CancellationToken ct)
        => Ok(await _catalog.GetFacetsAsync(ct));
}
