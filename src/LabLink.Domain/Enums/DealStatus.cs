namespace LabLink.Domain.Enums;

/// <summary>Trạng thái đề nghị giá (README · Screen 2/7).</summary>
public enum DealStatus
{
    Pending = 0,   // Chờ duyệt
    Approved = 1,  // Đã chốt
    Rejected = 2,  // Từ chối (từ chối lúc duyệt)
    Cancelled = 3, // Đã huỷ (huỷ deal đã chốt trước đó)
}
