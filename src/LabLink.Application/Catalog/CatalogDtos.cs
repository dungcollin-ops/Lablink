namespace LabLink.Application.Catalog;

public record CatalogItemDto(
    Guid Id,
    string Code,
    string Name,
    string Group,
    string Provider,
    long ListPrice,
    IReadOnlyList<string> Samples);

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
