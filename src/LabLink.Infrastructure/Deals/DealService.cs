using LabLink.Application.Deals;
using LabLink.Domain.Entities;
using LabLink.Domain.Enums;
using LabLink.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace LabLink.Infrastructure.Deals;

public class DealService : IDealService
{
    private readonly AppDbContext _db;

    public DealService(AppDbContext db) => _db = db;

    public async Task<(DealResult result, Guid? batchId)> CreateBatchAsync(
        Guid doctorId, CreateDealBatchRequest req, CancellationToken ct = default)
    {
        if (req.Items is null || req.Items.Count == 0)
            return (DealResult.Fail("Cần ít nhất 1 xét nghiệm."), null);
        if (req.Items.Any(i => i.ProposedPrice < 0))
            return (DealResult.Fail("Giá đề nghị không hợp lệ."), null);

        var ids = req.Items.Select(i => i.LabTestId).Distinct().ToList();
        var validIds = await _db.LabTests.Where(t => ids.Contains(t.Id))
            .Select(t => t.Id).ToListAsync(ct);
        var missing = ids.Except(validIds).Any();
        if (missing) return (DealResult.Fail("Có xét nghiệm không tồn tại."), null);

        var batch = new PriceDealBatch
        {
            ProposedById = doctorId,
            Note = string.IsNullOrWhiteSpace(req.Note) ? null : req.Note.Trim(),
        };
        foreach (var i in req.Items)
            batch.Items.Add(new PriceDeal { LabTestId = i.LabTestId, ProposedPrice = i.ProposedPrice });

        _db.PriceDealBatches.Add(batch);
        _db.AuditLogs.Add(new AuditLog
        {
            UserId = doctorId,
            Action = "deal.create",
            ObjectType = "PriceDealBatch",
            ObjectId = batch.Id.ToString(),
            Detail = $"{batch.Items.Count} xét nghiệm",
        });
        await _db.SaveChangesAsync(ct);
        return (DealResult.Success, batch.Id);
    }

    public async Task<IReadOnlyList<DealBatchDto>> GetMineAsync(Guid doctorId, CancellationToken ct = default)
    {
        var batches = await Query()
            .Where(b => b.ProposedById == doctorId)
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync(ct);
        return batches.Select(Map).ToList();
    }

    public async Task<IReadOnlyList<DealBatchDto>> GetPendingAsync(CancellationToken ct = default)
    {
        var batches = await Query()
            .Where(b => b.Items.Any(i => i.Status == DealStatus.Pending))
            .OrderBy(b => b.CreatedAt)
            .ToListAsync(ct);
        return batches.Select(Map).ToList();
    }

    public async Task<DealResult> DecideItemAsync(Guid itemId, bool approve, Guid actorId, CancellationToken ct = default)
    {
        var item = await _db.PriceDeals.FirstOrDefaultAsync(x => x.Id == itemId, ct);
        if (item is null) return DealResult.Fail("Không tìm thấy dòng đề nghị.");
        if (item.Status != DealStatus.Pending) return DealResult.Fail("Dòng này đã được xử lý.");

        Decide(item, approve, actorId);
        _db.AuditLogs.Add(AuditFor(actorId, approve, "PriceDeal", item.Id.ToString()));
        await _db.SaveChangesAsync(ct);
        return DealResult.Success;
    }

    public async Task<DealResult> DecideBatchAsync(Guid batchId, bool approve, Guid actorId, CancellationToken ct = default)
    {
        var items = await _db.PriceDeals
            .Where(x => x.BatchId == batchId && x.Status == DealStatus.Pending)
            .ToListAsync(ct);
        if (items.Count == 0) return DealResult.Fail("Không còn dòng chờ duyệt.");

        foreach (var item in items) Decide(item, approve, actorId);
        _db.AuditLogs.Add(AuditFor(actorId, approve, "PriceDealBatch", batchId.ToString(), items.Count));
        await _db.SaveChangesAsync(ct);
        return DealResult.Success;
    }

    public Task<int> PendingCountAsync(CancellationToken ct = default) =>
        _db.PriceDeals.CountAsync(x => x.Status == DealStatus.Pending, ct);

    // ---- helpers ----
    private IQueryable<PriceDealBatch> Query() =>
        _db.PriceDealBatches.AsNoTracking()
            .Include(b => b.ProposedBy)
            .Include(b => b.Items).ThenInclude(i => i.LabTest);

    private static void Decide(PriceDeal item, bool approve, Guid actorId)
    {
        item.Status = approve ? DealStatus.Approved : DealStatus.Rejected;
        item.DecidedById = actorId;
        item.DecidedAt = DateTimeOffset.UtcNow;
    }

    private static AuditLog AuditFor(Guid actorId, bool approve, string type, string id, int? count = null) =>
        new()
        {
            UserId = actorId,
            Action = approve ? "deal.approve" : "deal.reject",
            ObjectType = type,
            ObjectId = id,
            Detail = count is null ? null : $"{count} dòng",
        };

    private static DealBatchDto Map(PriceDealBatch b) => new(
        b.Id, b.ProposedById, b.ProposedBy?.FullName ?? "—", b.Note, b.CreatedAt,
        b.Items.OrderBy(i => i.LabTest.Name).Select(i => new DealItemDto(
            i.Id, i.LabTestId, i.LabTest.Code, i.LabTest.Name, i.LabTest.Group,
            i.LabTest.ListPrice, i.ProposedPrice, i.Status.ToString(),
            i.LabTest.ListPrice > 0
                ? Math.Round((i.ProposedPrice - i.LabTest.ListPrice) * 100.0 / i.LabTest.ListPrice, 1)
                : 0)).ToList());
}
