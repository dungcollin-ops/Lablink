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
            DepartmentId = await UserDeptAsync(doctorId, ct), // deal chốt dùng chung trong phòng khám
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
        // Theo phòng khám: thấy đề nghị của cả phòng; không có phòng thì chỉ của mình.
        var deptId = await UserDeptAsync(doctorId, ct);
        var q = Query();
        q = deptId != null ? q.Where(b => b.DepartmentId == deptId) : q.Where(b => b.ProposedById == doctorId);
        var batches = await q.OrderByDescending(b => b.CreatedAt).ToListAsync(ct);
        return batches.Select(b => Map(b)).ToList();
    }

    private Task<Guid?> UserDeptAsync(Guid userId, CancellationToken ct) =>
        _db.Users.Where(u => u.Id == userId)
            .Select(u => u.Employee != null ? (Guid?)u.Employee.DepartmentId : null)
            .FirstOrDefaultAsync(ct);

    public async Task<IReadOnlyList<DealBatchDto>> GetPendingAsync(CancellationToken ct = default)
    {
        var batches = await Query()
            .Where(b => b.Items.Any(i => i.Status == DealStatus.Pending))
            .OrderBy(b => b.CreatedAt)
            .ToListAsync(ct);
        return batches.Select(b => Map(b)).ToList();
    }

    public async Task<IReadOnlyList<DealBatchDto>> GetHistoryAsync(CancellationToken ct = default)
    {
        // Gói đã xử lý xong: có dòng và KHÔNG còn dòng nào chờ duyệt.
        var batches = await Query()
            .Where(b => b.Items.Any() && b.Items.All(i => i.Status != DealStatus.Pending))
            .ToListAsync(ct);
        batches = batches
            .OrderByDescending(b => b.Items.Max(i => i.DecidedAt ?? b.CreatedAt))
            .ToList();

        // Tra tên người duyệt (PriceDeal chỉ lưu DecidedById, không có nav).
        var deciderIds = batches.SelectMany(b => b.Items)
            .Where(i => i.DecidedById != null).Select(i => i.DecidedById!.Value).Distinct().ToList();
        var names = deciderIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await _db.Users.Where(u => deciderIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.FullName, ct);

        return batches.Select(b => Map(b, names)).ToList();
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

    public async Task<IReadOnlyDictionary<Guid, long>> GetEffectivePricesAsync(Guid userId, CancellationToken ct = default)
    {
        var deptId = await UserDeptAsync(userId, ct);
        return await EffectivePricesAsync(_db, deptId, userId, null, ct);
    }

    public async Task<DealResult> CancelItemAsync(Guid itemId, Guid actorId, CancellationToken ct = default)
    {
        var item = await _db.PriceDeals.FirstOrDefaultAsync(x => x.Id == itemId, ct);
        if (item is null) return DealResult.Fail("Không tìm thấy dòng deal.");
        if (item.Status != DealStatus.Approved) return DealResult.Fail("Chỉ huỷ được dòng đã chốt.");

        Cancel(item, actorId);
        _db.AuditLogs.Add(new AuditLog { UserId = actorId, Action = "deal.cancel", ObjectType = "PriceDeal", ObjectId = item.Id.ToString() });
        await _db.SaveChangesAsync(ct);
        return DealResult.Success;
    }

    public async Task<DealResult> CancelBatchAsync(Guid batchId, Guid actorId, CancellationToken ct = default)
    {
        var items = await _db.PriceDeals
            .Where(x => x.BatchId == batchId && x.Status == DealStatus.Approved)
            .ToListAsync(ct);
        if (items.Count == 0) return DealResult.Fail("Gói không có dòng đã chốt để huỷ.");

        foreach (var item in items) Cancel(item, actorId);
        _db.AuditLogs.Add(new AuditLog { UserId = actorId, Action = "deal.cancel", ObjectType = "PriceDealBatch", ObjectId = batchId.ToString(), Detail = $"{items.Count} dòng" });
        await _db.SaveChangesAsync(ct);
        return DealResult.Success;
    }

    private static void Cancel(PriceDeal item, Guid actorId)
    {
        item.Status = DealStatus.Cancelled;
        item.DecidedById = actorId;
        item.DecidedAt = DateTimeOffset.UtcNow; // re-stamp: quyết định mới nhất = huỷ
    }

    /// <summary>Giá deal hiệu lực = quyết định MỚI NHẤT cho mỗi (phòng, dịch vụ); chỉ dùng khi quyết định đó là Approved.
    /// Cancelled/Rejected mới nhất → không có deal (về giá niêm yết). Tính trong bộ nhớ để tránh giới hạn GroupBy của EF.</summary>
    public static async Task<Dictionary<Guid, long>> EffectivePricesAsync(
        AppDbContext db, Guid? deptId, Guid userId, IReadOnlyCollection<Guid>? labTestIds, CancellationToken ct)
    {
        var q = db.PriceDeals.AsNoTracking().Where(d => d.Status != DealStatus.Pending && d.DecidedAt != null);
        q = deptId != null ? q.Where(d => d.Batch.DepartmentId == deptId) : q.Where(d => d.Batch.ProposedById == userId);
        if (labTestIds != null) q = q.Where(d => labTestIds.Contains(d.LabTestId));

        var decided = await q
            .Select(d => new { d.LabTestId, d.Status, d.ProposedPrice, d.DecidedAt })
            .ToListAsync(ct);

        return decided
            .GroupBy(d => d.LabTestId)
            .Select(g => g.OrderByDescending(x => x.DecidedAt).First())
            .Where(x => x.Status == DealStatus.Approved)
            .ToDictionary(x => x.LabTestId, x => x.ProposedPrice);
    }

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

    private static DealBatchDto Map(PriceDealBatch b, IReadOnlyDictionary<Guid, string>? deciders = null) => new(
        b.Id, b.ProposedById, b.ProposedBy?.FullName ?? "—", b.Note, b.CreatedAt,
        b.Items.OrderBy(i => i.LabTest.Name).Select(i => new DealItemDto(
            i.Id, i.LabTestId, i.LabTest.Code, i.LabTest.Name, i.LabTest.Group,
            i.LabTest.ListPrice, i.ProposedPrice, i.Status.ToString(),
            i.LabTest.ListPrice > 0
                ? Math.Round((i.ProposedPrice - i.LabTest.ListPrice) * 100.0 / i.LabTest.ListPrice, 1)
                : 0,
            i.DecidedAt,
            i.DecidedById != null && deciders != null && deciders.TryGetValue(i.DecidedById.Value, out var n) ? n : null
            )).ToList());
}
