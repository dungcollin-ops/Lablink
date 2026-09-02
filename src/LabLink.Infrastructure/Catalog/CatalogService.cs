using LabLink.Application.Catalog;
using LabLink.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace LabLink.Infrastructure.Catalog;

public class CatalogService : ICatalogService
{
    private readonly AppDbContext _db;

    public CatalogService(AppDbContext db) => _db = db;

    public async Task<CatalogPage> SearchAsync(CatalogQuery q, CancellationToken ct = default)
    {
        var page = q.Page < 1 ? 1 : q.Page;
        var size = q.PageSize is < 1 or > 200 ? 50 : q.PageSize;

        var query = _db.LabTests.AsNoTracking().Where(x => x.IsActive);

        if (!string.IsNullOrWhiteSpace(q.Query))
        {
            var term = q.Query.Trim();
            query = query.Where(x =>
                EF.Functions.ILike(x.Name, $"%{term}%") ||
                EF.Functions.ILike(x.Code, $"%{term}%"));
        }
        if (!string.IsNullOrWhiteSpace(q.Group))
            query = query.Where(x => x.Group == q.Group);
        if (!string.IsNullOrWhiteSpace(q.Provider))
            query = query.Where(x => x.Provider == q.Provider);

        var total = await query.CountAsync(ct);

        var items = await query
            .OrderBy(x => x.Name).ThenBy(x => x.Provider)
            .Skip((page - 1) * size).Take(size)
            .Select(x => new CatalogItemDto(
                x.Id, x.Code, x.Name, x.Group, x.Provider, x.ListPrice, x.Samples))
            .ToListAsync(ct);

        return new CatalogPage(total, page, size, items);
    }

    public async Task<CatalogFacets> GetFacetsAsync(CancellationToken ct = default)
    {
        var groups = await _db.LabTests.Where(x => x.IsActive)
            .Select(x => x.Group).Distinct().OrderBy(g => g).ToListAsync(ct);
        var providers = await _db.LabTests.Where(x => x.IsActive)
            .Select(x => x.Provider).Distinct().OrderBy(p => p).ToListAsync(ct);
        return new CatalogFacets(groups, providers);
    }
}
