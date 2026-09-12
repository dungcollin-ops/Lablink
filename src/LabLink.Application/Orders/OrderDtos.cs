namespace LabLink.Application.Orders;

public record PatientInput(
    string? MaBN,
    string FullName,
    DateOnly? Dob,
    string? Gender,
    string? Phone,
    string? Email,
    string? NationalId,
    string? Bhyt,
    string? Address,
    string? Note);

public record OrderItemInput(Guid LabTestId, string? SampleType, int Qty);

public record CreateOrderRequest(
    string Source, // "doctor" | "retail"
    PatientInput Patient,
    string? ClinicName,
    string? DoctorCode,
    string? Diagnosis,
    string? Note,
    IReadOnlyList<OrderItemInput> Items);

public record OrderItemDto(
    Guid Id, Guid LabTestId, string TestCode, string TestName, string SampleType, int Qty, long UnitPrice);

public record SampleDto(Guid Id, string Sid, string SampleType, string? TubeType, string Quality);

public record OrderDto(
    Guid Id,
    string OrderNo,
    string Source,
    string Stage,
    string PatientName,
    string PatientMaBN,
    string? Diagnosis,
    string? Note,
    long Total,
    DateTimeOffset CreatedAt,
    IReadOnlyList<OrderItemDto> Items,
    IReadOnlyList<SampleDto> Samples,
    bool HasResult,
    string? ResultFileName,
    ProgressDto Progress);

public record PatientDetailDto(
    Guid Id, string MaBN, string FullName, DateOnly? Dob,
    string? Gender, string? Phone, string? Email, string? NationalId,
    string? Bhyt, string? Address, string? Note);

/// <summary>Một mốc trong timeline phiếu (ai xác nhận bước nào, lúc nào).</summary>
public record OrderEventDto(string Step, string ActorName, DateTimeOffset At, string? Note);

/// <summary>Phiếu đầy đủ (xem/sửa): kèm chi tiết bệnh nhân + phòng khám/bác sĩ + cờ Editable.</summary>
public record OrderFullDto(
    Guid Id, string OrderNo, string Source, string Stage, bool Editable,
    string? ClinicName, string? DoctorCode, string? Diagnosis, string? Note,
    long Total, DateTimeOffset CreatedAt,
    PatientDetailDto Patient,
    IReadOnlyList<OrderItemDto> Items,
    IReadOnlyList<SampleDto> Samples,
    IReadOnlyList<OrderEventDto> Events,
    bool HasResult, string? ResultFileName, ProgressDto Progress);

public record UpdateOrderRequest(
    PatientInput Patient, string? ClinicName, string? DoctorCode,
    string? Diagnosis, string? Note, IReadOnlyList<OrderItemInput> Items);

public record ProgressDto(
    string? CollectPlace, string? CollectBy, DateTimeOffset? CollectAt,
    string? SendVia, string? TrackingNo, string? Shipper, DateTimeOffset? SendAt,
    string? ReceivePlace, string? ReceiveBy, DateTimeOffset? ReceiveAt,
    DateTimeOffset? ExpectedResultAt);

public record SetProgressRequest(
    string? CollectPlace, string? CollectBy, DateTimeOffset? CollectAt,
    string? SendVia, string? TrackingNo, string? Shipper, DateTimeOffset? SendAt,
    string? ReceivePlace, string? ReceiveBy, DateTimeOffset? ReceiveAt,
    DateTimeOffset? ExpectedResultAt);

public record OrderListItemDto(
    Guid Id,
    string OrderNo,
    string Source,
    string Stage,
    string PatientName,
    string PatientMaBN,
    int ItemCount,
    long Total,
    DateTimeOffset CreatedAt,
    bool HasResult);

/// <summary>File kết quả để tải về.</summary>
public record ResultFile(string FileName, string ContentType, byte[] Content);

public record PatientSearchDto(
    Guid Id, string MaBN, string FullName, DateOnly? Dob,
    string? Gender, string? Phone, string? Address);

public record SetStageRequest(string Stage, string? By = null);
public record SetQualityRequest(string Quality);
public record AssignCollectRequest(string Collector, DateTimeOffset? AppointmentAt, string? Place);
public record SendSampleRequest(string SendVia, string? TrackingNo, string? Shipper, DateTimeOffset? SendAt);

public record OrderResult(bool Ok, string? Error = null, OrderDto? Order = null)
{
    public static OrderResult Fail(string msg) => new(false, msg);
    public static OrderResult Success(OrderDto o) => new(true, null, o);
}
