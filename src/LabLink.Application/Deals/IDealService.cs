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

    /// <summary>Lịch sử: các gói đã xử lý xong (không còn dòng chờ duyệt) — kèm ai duyệt, lúc nào.</summary>
    Task<IReadOnlyList<DealBatchDto>> GetHistoryAsync(CancellationToken ct = default);

    Task<DealResult> DecideItemAsync(Guid itemId, bool approve, Guid actorId, CancellationToken ct = default);
    Task<DealResult> DecideBatchAsync(Guid batchId, bool approve, Guid actorId, CancellationToken ct = default);

    /// <summary>Huỷ 1 dòng deal ĐÃ CHỐT (Approved → Cancelled). Giá phiếu tạo mới về niêm yết; phiếu cũ giữ nguyên.</summary>
    Task<DealResult> CancelItemAsync(Guid itemId, Guid actorId, CancellationToken ct = default);

    /// <summary>Huỷ tất cả dòng đã chốt trong 1 gói.</summary>
    Task<DealResult> CancelBatchAsync(Guid batchId, Guid actorId, CancellationToken ct = default);

    /// <summary>Số dòng đang chờ duyệt (badge sidebar lab).</summary>
    Task<int> PendingCountAsync(CancellationToken ct = default);

    /// <summary>Giá deal đã chốt (mới nhất) theo phòng khám của user — map labTestId → giá.
    /// Dùng cho giỏ chỉ định hiển thị đúng giá hiệu lực.</summary>
    Task<IReadOnlyDictionary<Guid, long>> GetEffectivePricesAsync(Guid userId, CancellationToken ct = default);
}
