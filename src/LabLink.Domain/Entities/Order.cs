using LabLink.Domain.Enums;

namespace LabLink.Domain.Entities;

/// <summary>Phiếu chỉ định (README · Screen 3/4). Mã "O-&lt;seq&gt;".</summary>
public class Order
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Mã phiếu hiển thị, vd "O-1042".</summary>
    public string OrderNo { get; set; } = "";

    public OrderSource Source { get; set; }
    public OrderStage Stage { get; set; } = OrderStage.Ordered;

    public Guid PatientId { get; set; }
    public Patient Patient { get; set; } = null!;

    // Denormalize để giữ đúng thông tin tại thời điểm tạo phiếu.
    public string PatientName { get; set; } = "";
    public string PatientMaBN { get; set; } = "";

    public string? ClinicName { get; set; }
    public string? DoctorCode { get; set; }
    public string? Diagnosis { get; set; }
    public string? Note { get; set; }

    /// <summary>Phòng ban đặt phiếu (lấy từ NV của người tạo) — dùng để giới hạn hiển thị & cấu hình bản cứng.</summary>
    public Guid? DepartmentId { get; set; }
    public Department? Department { get; set; }

    /// <summary>Bác sĩ chỉ định (danh mục Nhân viên) — tùy chọn.</summary>
    public Guid? DoctorId { get; set; }
    public Employee? Doctor { get; set; }

    public long Total { get; set; }

    public Guid CreatedById { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // ----- Tiến trình mẫu chi tiết (README · Screen 8 · sp) -----
    public string? CollectPlace { get; set; }
    public string? CollectBy { get; set; }
    public DateTimeOffset? CollectAt { get; set; }

    /// <summary>Hình thức gửi: Direct | Bus | Grab.</summary>
    public string? SendVia { get; set; }
    public string? TrackingNo { get; set; }
    public string? Shipper { get; set; }
    public DateTimeOffset? SendAt { get; set; }

    public string? ReceivePlace { get; set; }
    public string? ReceiveBy { get; set; }
    public DateTimeOffset? ReceiveAt { get; set; }

    public DateTimeOffset? ExpectedResultAt { get; set; }

    /// <summary>Khoảng dự kiến trả KQ (giờ), chụp từ max(TAT) các xét nghiệm lúc tạo/sửa phiếu.</summary>
    public int? EtaMinHours { get; set; }
    public int? EtaMaxHours { get; set; }

    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
    public ICollection<Sample> Samples { get; set; } = new List<Sample>();
    public ICollection<OrderEvent> Events { get; set; } = new List<OrderEvent>();

    public TestResult? Result { get; set; }
}
