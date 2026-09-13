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
                x.Id, x.Code, x.Name, x.Group, x.Provider, x.ListPrice, x.Samples,
                x.TatMinHours, x.TatMaxHours))
            .ToListAsync(ct);

        return new CatalogPage(total, page, size, items);
    }

    public async Task<bool> UpdateTatAsync(Guid id, int? tatMinHours, int? tatMaxHours, CancellationToken ct = default)
    {
        var t = await _db.LabTests.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (t is null) return false;
        t.TatMinHours = tatMinHours is >= 0 ? tatMinHours : null;
        t.TatMaxHours = tatMaxHours is >= 0 ? tatMaxHours : null;
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<CatalogResult> CreateAsync(CatalogItemInput i, CancellationToken ct = default)
    {
        var err = Validate(i);
        if (err is not null) return CatalogResult.Fail(err);

        var t = new Domain.Entities.LabTest
        {
            ExternalId = $"manual-{Guid.NewGuid():N}", // unique, phân biệt với mã seed
            Code = i.Code.Trim(),
            Name = i.Name.Trim(),
            Group = string.IsNullOrWhiteSpace(i.Group) ? "Khác" : i.Group.Trim(),
            Provider = i.Provider.Trim(),
            ListPrice = i.ListPrice < 0 ? 0 : i.ListPrice,
            Samples = (i.Samples ?? new List<string>()).Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim()).ToList(),
            TatMinHours = i.TatMinHours is >= 0 ? i.TatMinHours : null,
            TatMaxHours = i.TatMaxHours is >= 0 ? i.TatMaxHours : null,
            IsActive = true,
        };
        _db.LabTests.Add(t);
        await _db.SaveChangesAsync(ct);
        return CatalogResult.Success(ToDto(t));
    }

    public async Task<CatalogResult> UpdateAsync(Guid id, CatalogItemInput i, CancellationToken ct = default)
    {
        var err = Validate(i);
        if (err is not null) return CatalogResult.Fail(err);
        var t = await _db.LabTests.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (t is null) return CatalogResult.Fail("Không tìm thấy xét nghiệm.");

        t.Code = i.Code.Trim();
        t.Name = i.Name.Trim();
        t.Group = string.IsNullOrWhiteSpace(i.Group) ? "Khác" : i.Group.Trim();
        t.Provider = i.Provider.Trim();
        t.ListPrice = i.ListPrice < 0 ? 0 : i.ListPrice;
        t.Samples = (i.Samples ?? new List<string>()).Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim()).ToList();
        t.TatMinHours = i.TatMinHours is >= 0 ? i.TatMinHours : null;
        t.TatMaxHours = i.TatMaxHours is >= 0 ? i.TatMaxHours : null;
        await _db.SaveChangesAsync(ct);
        return CatalogResult.Success(ToDto(t));
    }

    public async Task<CatalogResult> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var t = await _db.LabTests.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (t is null) return CatalogResult.Fail("Không tìm thấy xét nghiệm.");

        // Chỉ xóa cứng khi CHƯA phát sinh dữ liệu tham chiếu.
        if (await _db.OrderItems.AnyAsync(x => x.LabTestId == id, ct))
            return CatalogResult.Fail("Đã dùng trong phiếu — không xóa được (có thể ẩn thay vì xóa).");
        if (await _db.PriceDeals.AnyAsync(x => x.LabTestId == id, ct))
            return CatalogResult.Fail("Đã dùng trong đề nghị giá — không xóa được.");

        _db.LabTests.Remove(t);
        await _db.SaveChangesAsync(ct);
        return CatalogResult.Success();
    }

    private static string? Validate(CatalogItemInput i)
    {
        if (string.IsNullOrWhiteSpace(i.Name)) return "Thiếu tên xét nghiệm.";
        if (string.IsNullOrWhiteSpace(i.Code)) return "Thiếu mã xét nghiệm.";
        if (string.IsNullOrWhiteSpace(i.Provider)) return "Thiếu nhà cung cấp.";
        if (i.TatMinHours is int mn && i.TatMaxHours is int mx && mn > mx)
            return "TG Min không được lớn hơn TG Max.";
        return null;
    }

    private static CatalogItemDto ToDto(Domain.Entities.LabTest x) => new(
        x.Id, x.Code, x.Name, x.Group, x.Provider, x.ListPrice, x.Samples, x.TatMinHours, x.TatMaxHours);

    public async Task<CatalogFacets> GetFacetsAsync(CancellationToken ct = default)
    {
        var groups = await _db.LabTests.Where(x => x.IsActive)
            .Select(x => x.Group).Distinct().OrderBy(g => g).ToListAsync(ct);
        var providers = await _db.LabTests.Where(x => x.IsActive)
            .Select(x => x.Provider).Distinct().OrderBy(p => p).ToListAsync(ct);
        return new CatalogFacets(groups, providers);
    }
}
