namespace LabLink.Application.Deals;

public interface IDealService
{
    /// <summary>Bác sĩ gửi gói đề nghị giá.</summary>
    Task<(DealResult result, Guid? batchId)> CreateBatchAsync(
        Guid doctorId, CreateDealBatchRequest req, CancellationToken ct = default);

    /// <summary>Các gói đề nghị của chính bác sĩ (kèm trạng thái từng dòng).</summary>
    Task<IReadOnlyList<DealBatchDto>> GetMineAsync(Guid doctorId, CancellationToken ct = default);

    /// <summary>Các gói còn dòng chờ duyệt (cho lab).</summary>
    Task<IReadOnlyList<DealBatchDto>> GetPendingAsync(CancellationToken ct = default);

    Task<DealResult> DecideItemAsync(Guid itemId, bool approve, Guid actorId, CancellationToken ct = default);
    Task<DealResult> DecideBatchAsync(Guid batchId, bool approve, Guid actorId, CancellationToken ct = default);

    /// <summary>Số dòng đang chờ duyệt (badge sidebar lab).</summary>
    Task<int> PendingCountAsync(CancellationToken ct = default);
}
