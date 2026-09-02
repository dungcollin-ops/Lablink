namespace LabLink.Application.Reports;

public record StageCount(string Stage, int Count);
public record SourceStat(string Source, int Count, long Revenue);
public record AgingStat(int Resulted, int PendingToday, int Pending1To3, int PendingOver3);
public record DayRevenue(string Date, long Revenue, int Orders);

public record ReportSummary(
    int TotalOrders,
    long TotalRevenue,
    IReadOnlyList<StageCount> ByStage,
    IReadOnlyList<SourceStat> BySource,
    AgingStat Aging,
    IReadOnlyList<DayRevenue> RevenueByDay);
