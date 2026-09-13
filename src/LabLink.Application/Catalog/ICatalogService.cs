namespace LabLink.Application.Catalog;

public interface ICatalogService
{
    Task<CatalogPage> SearchAsync(CatalogQuery query, CancellationToken ct = default);
    Task<CatalogFacets> GetFacetsAsync(CancellationToken ct = default);

    /// <summary>Cập nhật TG Min/Max (giờ) cho 1 xét nghiệm. False nếu không tìm thấy.</summary>
    Task<bool> UpdateTatAsync(Guid id, int? tatMinHours, int? tatMaxHours, CancellationToken ct = default);

    /// <summary>Thêm 1 mục danh mục (admin).</summary>
    Task<CatalogResult> CreateAsync(CatalogItemInput input, CancellationToken ct = default);

    /// <summary>Sửa đầy đủ 1 mục danh mục (admin).</summary>
    Task<CatalogResult> UpdateAsync(Guid id, CatalogItemInput input, CancellationToken ct = default);

    /// <summary>Xóa hẳn 1 mục danh mục — chỉ khi chưa dùng trong phiếu/đề nghị giá.</summary>
    Task<CatalogResult> DeleteAsync(Guid id, CancellationToken ct = default);
}
