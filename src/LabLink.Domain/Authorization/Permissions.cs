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
    public const string SampleCollect = "sample.collect";   // B2 · Lấy mẫu
    public const string SampleSend = "sample.send";
    public const string SampleGather = "sample.gather";     // B3 · Gom mẫu
    public const string SampleReceive = "sample.receive";   // B4 · Nhận mẫu
    public const string SampleQc = "sample.qc";
    public const string HardcopyDeliver = "hardcopy.deliver";   // B6 · Giao bản cứng
    public const string HardcopyReceive = "hardcopy.receive";   // B7 · Nhận bản cứng
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
        SampleCollect, SampleSend, SampleGather, SampleReceive, SampleQc,
        HardcopyDeliver, HardcopyReceive,
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
            Permissions.SampleCollect,      // B2 · BS tự lấy mẫu (PK ít người)
            Permissions.HardcopyReceive,    // B7 · nhận bản cứng
            Permissions.SidPrint, Permissions.ResultRead,
        }),
        new("nurse", "Điều dưỡng", new[]
        {
            Permissions.OrderRead, Permissions.ResultRead,
            Permissions.SampleCollect,      // B2 · điều dưỡng lấy mẫu thay BS
            Permissions.HardcopyReceive,
            Permissions.SidPrint,
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
            Permissions.OrderRead,
            Permissions.SampleCollect, Permissions.SampleGather, Permissions.SampleReceive, Permissions.SampleQc,
            Permissions.HardcopyDeliver,
            Permissions.SidPrint, Permissions.ResultRead, Permissions.ResultUpload, Permissions.ResultVerify,
        }),
        new("admin", "Quản trị hệ thống", Permissions.All),
    };
}
