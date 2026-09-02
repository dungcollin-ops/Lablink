namespace LabLink.Application.Reports;

public interface IReportService
{
    /// <summary>Tổng hợp báo cáo trong khoảng thời gian (mặc định 30 ngày gần nhất).</summary>
    Task<ReportSummary> GetSummaryAsync(DateTimeOffset? from, DateTimeOffset? to, CancellationToken ct = default);
}
