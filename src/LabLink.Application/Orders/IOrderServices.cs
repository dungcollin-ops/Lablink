namespace LabLink.Application.Orders;

public interface IOrderService
{
    Task<OrderResult> CreateAsync(Guid userId, CreateOrderRequest req, CancellationToken ct = default);

    /// <summary>Danh sách phiếu để theo dõi. seeAll=true (lab) xem tất cả;
    /// ngược lại chỉ phiếu do userId tạo.</summary>
    Task<IReadOnlyList<OrderListItemDto>> ListAsync(
        Guid userId, bool seeAll, string? query, string? stage, CancellationToken ct = default);

    Task<OrderDto?> GetAsync(Guid id, Guid userId, bool seeAll, CancellationToken ct = default);

    /// <summary>Phiếu đầy đủ để xem/sửa (kèm chi tiết bệnh nhân). Null nếu không thấy/không có quyền.</summary>
    Task<OrderFullDto?> GetFullAsync(Guid id, Guid userId, bool seeAll, CancellationToken ct = default);

    /// <summary>Sửa phiếu khi CHƯA gửi PXN (Đã soạn mẫu trở về trước): cập nhật hồ sơ BN (danh mục) + phiếu + XN/SID.</summary>
    Task<OrderResult> UpdateAsync(Guid id, Guid userId, bool seeAll, UpdateOrderRequest req, CancellationToken ct = default);

    /// <summary>Lab cập nhật trạng thái phiếu (tiến trình mẫu).</summary>
    Task<OrderResult> SetStageAsync(Guid orderId, string stage, Guid actorId, string? by = null, CancellationToken ct = default);

    /// <summary>Lab đánh giá chất lượng 1 mẫu (Pass/Fail).</summary>
    Task<OrderResult> SetSampleQualityAsync(Guid sampleId, string quality, Guid actorId, CancellationToken ct = default);

    /// <summary>Lab tải file kết quả lên → phiếu chuyển "Có kết quả".</summary>
    Task<OrderResult> UploadResultAsync(Guid orderId, string fileName, string contentType, byte[] content, Guid actorId, CancellationToken ct = default);

    /// <summary>Tải file kết quả (kiểm tra phạm vi + ghi log tải). Null nếu không có/không được phép.</summary>
    Task<ResultFile?> DownloadResultAsync(Guid orderId, Guid userId, bool seeAll, CancellationToken ct = default);

    /// <summary>Cập nhật tiến trình mẫu chi tiết (lấy/gửi/nhận).</summary>
    Task<OrderResult> SetProgressAsync(Guid orderId, SetProgressRequest req, Guid actorId, CancellationToken ct = default);

    /// <summary>PXN phân công NV đến lấy mẫu (khách lẻ) → sinh SID + chuyển Đã soạn mẫu.</summary>
    Task<OrderResult> AssignCollectAsync(Guid orderId, AssignCollectRequest req, Guid actorId, CancellationToken ct = default);

    /// <summary>Phòng khám gửi mẫu → chuyển Đã gửi (chỉ phiếu của mình, đang Đã soạn mẫu).</summary>
    Task<OrderResult> SendSampleAsync(Guid orderId, SendSampleRequest req, Guid actorId, bool seeAll, CancellationToken ct = default);
}

public interface IPatientService
{
    Task<IReadOnlyList<PatientSearchDto>> SearchAsync(string query, CancellationToken ct = default);
}

/// <summary>Sinh số tuần tự atomic (SID/MaBN/mã phiếu).</summary>
public interface ISequenceService
{
    /// <summary>Cấp <paramref name="count"/> số liên tiếp cho <paramref name="key"/>;
    /// trả về giá trị CUỐI của dải (dải = end-count+1 .. end).</summary>
    Task<long> NextRangeAsync(string key, int count, CancellationToken ct = default);
}
