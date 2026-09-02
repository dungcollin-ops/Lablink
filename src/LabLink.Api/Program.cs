using System.Text;
using LabLink.Api.Authorization;
using LabLink.Application.Auth;
using LabLink.Infrastructure;
using LabLink.Infrastructure.Auth;
using LabLink.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Cho phép chạy như Windows Service (no-op khi chạy console/dev).
builder.Host.UseWindowsService();

const string SpaCors = "spa";
var spaOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
    ?? new[] { "http://localhost:5173", "http://127.0.0.1:5173" };

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// EF Core + Npgsql + auth services (connection string từ config/env/user-secrets).
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddCors(o => o.AddPolicy(SpaCors, p =>
    p.WithOrigins(spaOrigins).AllowAnyHeader().AllowAnyMethod()));

// JWT bearer
var jwt = builder.Configuration.GetSection(JwtOptions.Section).Get<JwtOptions>() ?? new JwtOptions();
if (!builder.Environment.IsDevelopment() && string.IsNullOrWhiteSpace(jwt.SigningKey))
    throw new InvalidOperationException(
        "Thiếu Jwt:SigningKey ở môi trường production. Đặt biến môi trường Jwt__SigningKey (chuỗi ngẫu nhiên ≥ 32 ký tự).");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
            ClockSkew = TimeSpan.FromMinutes(1),
        };
    });

// Authorization theo permission (policy "perm:<key>")
builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddAuthorization();

var app = builder.Build();

// Tự apply migration + seed dữ liệu nền (mọi môi trường; idempotent).
// Seed:DemoUsers = false để KHÔNG tạo 4 tài khoản demo ở production thật.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
    var seedDemo = builder.Configuration.GetValue("Seed:DemoUsers", true);
    await db.Database.MigrateAsync();
    await DbSeeder.SeedAsync(db, hasher, seedDemo);
    await CatalogSeeder.SeedAsync(db);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Phục vụ SPA (React build đặt trong wwwroot) + fallback về index.html.
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseCors(SpaCors);
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapFallbackToFile("index.html");

app.Run();
