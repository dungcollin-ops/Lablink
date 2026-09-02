namespace LabLink.Application.Catalog;

public interface ICatalogService
{
    Task<CatalogPage> SearchAsync(CatalogQuery query, CancellationToken ct = default);
    Task<CatalogFacets> GetFacetsAsync(CancellationToken ct = default);
}
