namespace LabLink.Domain.Authorization;

/// <summary>Danh mục permission key — nguồn sự thật ở server.
/// Phải khớp với frontend (auth/permissions.ts).</summary>
public static class Permissions
{
    public const string CatalogRead = "catalog.read";
    public const string CatalogPriceEdit = "catalog.price.edit";
    public const string DealCreate = "deal.create";
    public const string DealRead = "deal.read";
    public const string DealApprove = "deal.approve";
    public const string OrderCreate = "order.create";
    public const string OrderRead = "order.read";
    public const string SampleCollect = "sample.collect";
    public const string SampleSend = "sample.send";
    public const string SampleReceive = "sample.receive";
    public const string SampleQc = "sample.qc";
    public const string SidPrint = "sid.print";
    public const string ResultRead = "result.read";
    public const string ResultUpload = "result.upload";
    public const string ResultVerify = "result.verify";
    public const string UserManage = "user.manage";
    public const string RoleManage = "role.manage";
    public const string AuditRead = "audit.read";
    public const string ReportRead = "report.read";

    public static readonly string[] All =
    {
        CatalogRead, CatalogPriceEdit,
        DealCreate, DealRead, DealApprove,
        OrderCreate, OrderRead,
        SampleCollect, SampleSend, SampleReceive, SampleQc,
        SidPrint,
        ResultRead, ResultUpload, ResultVerify,
        UserManage, RoleManage, AuditRead, ReportRead,
    };
}

/// <summary>Nhóm mặc định + tập quyền (README · RBAC · Role mặc định).</summary>
public static class DefaultRoles
{
    public record RoleSeed(string Code, string Name, string[] Permissions);

    public static readonly RoleSeed[] All =
    {
        new("doctor", "Bác sĩ chỉ định", new[]
        {
            Permissions.CatalogRead,
            Permissions.DealCreate, Permissions.DealRead,
            Permissions.OrderCreate, Permissions.OrderRead,
            Permissions.SampleSend,
            Permissions.SidPrint, Permissions.ResultRead,
        }),
        new("retail", "Khách lẻ", new[]
        {
            Permissions.CatalogRead,
            Permissions.OrderCreate, Permissions.OrderRead, Permissions.ResultRead,
        }),
        new("lab", "Trưởng phòng XN", new[]
        {
            Permissions.CatalogRead, Permissions.CatalogPriceEdit,
            Permissions.DealRead, Permissions.DealApprove,
            Permissions.OrderRead, Permissions.SampleCollect, Permissions.SampleReceive, Permissions.SampleQc,
            Permissions.SidPrint, Permissions.ResultRead, Permissions.ResultUpload, Permissions.ResultVerify,
        }),
        new("admin", "Quản trị hệ thống", Permissions.All),
    };
}
