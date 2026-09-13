namespace LabLink.Application.Catalog;

public record CatalogItemDto(
    Guid Id,
    string Code,
    string Name,
    string Group,
    string Provider,
    long ListPrice,
    IReadOnlyList<string> Samples,
    int? TatMinHours,
    int? TatMaxHours);

/// <summary>Cập nhật thời gian dự kiến trả KQ (giờ) cho 1 xét nghiệm.</summary>
public record UpdateTatRequest(int? TatMinHours, int? TatMaxHours);

/// <summary>Thêm/sửa một mục danh mục (admin). ExternalId tự sinh khi tạo.</summary>
public record CatalogItemInput(
    string Code,
    string Name,
    string Group,
    string Provider,
    long ListPrice,
    IReadOnlyList<string>? Samples,
    int? TatMinHours,
    int? TatMaxHours);

/// <summary>Kết quả thao tác danh mục — thất bại kèm thông điệp.</summary>
public record CatalogResult(bool Ok, string? Error = null, CatalogItemDto? Item = null)
{
    public static CatalogResult Fail(string msg) => new(false, msg);
    public static CatalogResult Success(CatalogItemDto? item = null) => new(true, null, item);
}

public record CatalogQuery(
    string? Query,
    string? Group,
    string? Provider,
    int Page = 1,
    int PageSize = 50);

public record CatalogPage(
    int Total,
    int Page,
    int PageSize,
    IReadOnlyList<CatalogItemDto> Items);

public record CatalogFacets(
    IReadOnlyList<string> Groups,
    IReadOnlyList<string> Providers);
