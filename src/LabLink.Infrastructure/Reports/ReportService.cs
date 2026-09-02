using LabLink.Application.Reports;
using LabLink.Domain.Enums;
using LabLink.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace LabLink.Infrastructure.Reports;

public class ReportService : IReportService
{
    private readonly AppDbContext _db;

    public ReportService(AppDbContext db) => _db = db;

    private sealed record Row(OrderStage Stage, OrderSource Source, long Total, DateTimeOffset CreatedAt);

    public async Task<ReportSummary> GetSummaryAsync(DateTimeOffset? from, DateTimeOffset? to, CancellationToken ct = default)
    {
        // Npgsql timestamptz chỉ nhận DateTimeOffset UTC (offset 0).
        var toD = (to ?? DateTimeOffset.UtcNow).ToUniversalTime();
        var fromD = (from ?? toD.AddDays(-30)).ToUniversalTime();

        var rows = await _db.Orders.AsNoTracking()
            .Where(o => o.CreatedAt >= fromD && o.CreatedAt <= toD)
            .Select(o => new Row(o.Stage, o.Source, o.Total, o.CreatedAt))
            .ToListAsync(ct);

        var total = rows.Count;
        var revenue = rows.Sum(r => r.Total);

        var byStage = rows.GroupBy(r => r.Stage)
            .Select(g => new StageCount(g.Key.ToString(), g.Count()))
            .OrderBy(s => s.Stage).ToList();

        var bySource = rows.GroupBy(r => r.Source)
            .Select(g => new SourceStat(g.Key.ToString(), g.Count(), g.Sum(x => x.Total)))
            .ToList();

        // Tồn đọng / trễ: phiếu chưa có kết quả, nhóm theo tuổi.
        var now = DateTime.Now;
        int resulted = rows.Count(r => r.Stage == OrderStage.Resulted);
        var pending = rows.Where(r => r.Stage != OrderStage.Resulted).ToList();
        int today = 0, d1to3 = 0, over3 = 0;
        foreach (var r in pending)
        {
            var days = (now - r.CreatedAt.LocalDateTime).TotalDays;
            if (days <= 1) today++;
            else if (days <= 3) d1to3++;
            else over3++;
        }
        var aging = new AgingStat(resulted, today, d1to3, over3);

        var byDay = rows.GroupBy(r => r.CreatedAt.LocalDateTime.Date)
            .Select(g => new DayRevenue(g.Key.ToString("yyyy-MM-dd"), g.Sum(x => x.Total), g.Count()))
            .OrderBy(d => d.Date).ToList();

        return new ReportSummary(total, revenue, byStage, bySource, aging, byDay);
    }
}
