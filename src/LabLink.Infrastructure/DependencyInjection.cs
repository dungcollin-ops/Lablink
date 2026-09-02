using LabLink.Application.Auth;
using LabLink.Infrastructure.Auth;
using LabLink.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace LabLink.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration config)
    {
        var conn = config.GetConnectionString("Default");
        if (string.IsNullOrWhiteSpace(conn))
            throw new InvalidOperationException(
                "Thiếu ConnectionStrings:Default. Đặt qua user-secrets: " +
                "dotnet user-secrets set \"ConnectionStrings:Default\" \"Host=...;...\"");

        services.AddDbContext<AppDbContext>(o => o.UseNpgsql(conn, npg =>
            // Supabase/cloud có thể đóng connection khi idle → retry lỗi tạm thời (vd socket 10054).
            npg.EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: TimeSpan.FromSeconds(3), errorCodesToAdd: null)));

        services.Configure<JwtOptions>(config.GetSection(JwtOptions.Section));

        services.AddScoped<IPasswordHasher, BcryptPasswordHasher>();
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<Application.Catalog.ICatalogService, Catalog.CatalogService>();
        services.AddScoped<Application.Admin.IUserAdminService, Admin.UserAdminService>();
        services.AddScoped<Application.Admin.IRoleAdminService, Admin.RoleAdminService>();
        services.AddScoped<Application.Admin.IAuditQueryService, Admin.AuditQueryService>();
        services.AddScoped<Application.Deals.IDealService, Deals.DealService>();
        services.AddScoped<Application.Orders.ISequenceService, Orders.SequenceService>();
        services.AddScoped<Application.Orders.IPatientService, Orders.PatientService>();
        services.AddScoped<Application.Orders.IOrderService, Orders.OrderService>();
        services.AddScoped<Application.Reports.IReportService, Reports.ReportService>();

        return services;
    }
}
