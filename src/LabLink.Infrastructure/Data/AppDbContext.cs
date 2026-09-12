using LabLink.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LabLink.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<LabTest> LabTests => Set<LabTest>();
    public DbSet<PriceDealBatch> PriceDealBatches => Set<PriceDealBatch>();
    public DbSet<PriceDeal> PriceDeals => Set<PriceDeal>();
    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<Sample> Samples => Set<Sample>();
    public DbSet<TestResult> TestResults => Set<TestResult>();
    public DbSet<OrderEvent> OrderEvents => Set<OrderEvent>();
    public DbSet<SequenceCounter> Sequences => Set<SequenceCounter>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>(e =>
        {
            e.ToTable("users");
            e.HasKey(x => x.Id);
            e.Property(x => x.FullName).HasMaxLength(200).IsRequired();
            e.Property(x => x.Email).HasMaxLength(256).IsRequired();
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.EmployeeCode).HasMaxLength(50);
            e.HasIndex(x => x.EmployeeCode).IsUnique().HasFilter(null);
            e.Property(x => x.Phone).HasMaxLength(30);
            e.Property(x => x.Department).HasMaxLength(120);
            e.Property(x => x.Status).HasConversion<int>();
        });

        b.Entity<Role>(e =>
        {
            e.ToTable("roles");
            e.HasKey(x => x.Id);
            e.Property(x => x.Code).HasMaxLength(50).IsRequired();
            e.HasIndex(x => x.Code).IsUnique();
            e.Property(x => x.Name).HasMaxLength(120).IsRequired();
        });

        b.Entity<Permission>(e =>
        {
            e.ToTable("permissions");
            e.HasKey(x => x.Id);
            e.Property(x => x.Key).HasMaxLength(100).IsRequired();
            e.HasIndex(x => x.Key).IsUnique();
        });

        b.Entity<UserRole>(e =>
        {
            e.ToTable("user_roles");
            e.HasKey(x => new { x.UserId, x.RoleId });
            e.HasOne(x => x.User).WithMany(u => u.UserRoles).HasForeignKey(x => x.UserId);
            e.HasOne(x => x.Role).WithMany(r => r.UserRoles).HasForeignKey(x => x.RoleId);
        });

        b.Entity<RolePermission>(e =>
        {
            e.ToTable("role_permissions");
            e.HasKey(x => new { x.RoleId, x.PermissionId });
            e.HasOne(x => x.Role).WithMany(r => r.RolePermissions).HasForeignKey(x => x.RoleId);
            e.HasOne(x => x.Permission).WithMany(p => p.RolePermissions).HasForeignKey(x => x.PermissionId);
        });

        b.Entity<AuditLog>(e =>
        {
            e.ToTable("audit_logs");
            e.HasKey(x => x.Id);
            e.Property(x => x.Action).HasMaxLength(100).IsRequired();
            e.Property(x => x.ObjectType).HasMaxLength(100);
            e.Property(x => x.ObjectId).HasMaxLength(100);
            e.HasIndex(x => new { x.UserId, x.At });
        });

        b.Entity<LabTest>(e =>
        {
            e.ToTable("lab_tests");
            e.HasKey(x => x.Id);
            e.Property(x => x.ExternalId).HasMaxLength(50).IsRequired();
            e.HasIndex(x => x.ExternalId).IsUnique();
            e.Property(x => x.Code).HasMaxLength(50).IsRequired();
            e.HasIndex(x => x.Code);
            e.Property(x => x.Name).HasMaxLength(400).IsRequired();
            e.Property(x => x.Provider).HasMaxLength(120).IsRequired();
            e.Property(x => x.Group).HasMaxLength(120).IsRequired();
            e.HasIndex(x => x.Group);
            e.Property(x => x.Samples).HasColumnType("text[]"); // Npgsql map List<string>
            e.Property(x => x.Turnaround).HasMaxLength(120);
        });

        b.Entity<PriceDealBatch>(e =>
        {
            e.ToTable("price_deal_batches");
            e.HasKey(x => x.Id);
            e.Property(x => x.Note).HasMaxLength(1000);
            e.HasOne(x => x.ProposedBy).WithMany().HasForeignKey(x => x.ProposedById)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.ProposedById);
        });

        b.Entity<PriceDeal>(e =>
        {
            e.ToTable("price_deals");
            e.HasKey(x => x.Id);
            e.Property(x => x.Status).HasConversion<int>();
            e.HasOne(x => x.Batch).WithMany(x => x.Items).HasForeignKey(x => x.BatchId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.LabTest).WithMany().HasForeignKey(x => x.LabTestId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => new { x.LabTestId, x.Status });
        });

        b.Entity<Patient>(e =>
        {
            e.ToTable("patients");
            e.HasKey(x => x.Id);
            e.Property(x => x.MaBN).HasMaxLength(30);
            e.HasIndex(x => x.MaBN);
            e.Property(x => x.FullName).HasMaxLength(200).IsRequired();
            e.Property(x => x.Gender).HasMaxLength(10);
            e.Property(x => x.Phone).HasMaxLength(30);
            e.Property(x => x.Email).HasMaxLength(256);
            e.Property(x => x.NationalId).HasMaxLength(20);
            e.Property(x => x.Bhyt).HasMaxLength(30);
            e.Property(x => x.Address).HasMaxLength(400);
            e.Property(x => x.Note).HasMaxLength(1000);
            e.HasIndex(x => x.FullName);
        });

        b.Entity<Order>(e =>
        {
            e.ToTable("orders");
            e.HasKey(x => x.Id);
            e.Property(x => x.OrderNo).HasMaxLength(30).IsRequired();
            e.HasIndex(x => x.OrderNo).IsUnique();
            e.Property(x => x.Source).HasConversion<int>();
            e.Property(x => x.Stage).HasConversion<int>();
            e.Property(x => x.PatientName).HasMaxLength(200);
            e.Property(x => x.PatientMaBN).HasMaxLength(30);
            e.Property(x => x.ClinicName).HasMaxLength(200);
            e.Property(x => x.DoctorCode).HasMaxLength(50);
            e.Property(x => x.Diagnosis).HasMaxLength(500);
            e.Property(x => x.Note).HasMaxLength(1000);
            e.Property(x => x.CollectPlace).HasMaxLength(200);
            e.Property(x => x.CollectBy).HasMaxLength(120);
            e.Property(x => x.SendVia).HasMaxLength(20);
            e.Property(x => x.TrackingNo).HasMaxLength(100);
            e.Property(x => x.Shipper).HasMaxLength(120);
            e.Property(x => x.ReceivePlace).HasMaxLength(200);
            e.Property(x => x.ReceiveBy).HasMaxLength(120);
            e.HasOne(x => x.Patient).WithMany().HasForeignKey(x => x.PatientId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.Stage, x.CreatedAt });
            e.HasIndex(x => x.CreatedById);
        });

        b.Entity<OrderItem>(e =>
        {
            e.ToTable("order_items");
            e.HasKey(x => x.Id);
            e.Property(x => x.TestCode).HasMaxLength(50);
            e.Property(x => x.TestName).HasMaxLength(400);
            e.Property(x => x.SampleType).HasMaxLength(120);
            e.HasOne(x => x.Order).WithMany(o => o.Items).HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Sample>(e =>
        {
            e.ToTable("samples");
            e.HasKey(x => x.Id);
            e.Property(x => x.Sid).HasMaxLength(30).IsRequired();
            e.HasIndex(x => x.Sid);
            e.Property(x => x.SampleType).HasMaxLength(120);
            e.Property(x => x.TubeType).HasMaxLength(60);
            e.Property(x => x.Quality).HasConversion<int>();
            e.Property(x => x.CollectedBy).HasMaxLength(120);
            e.Property(x => x.ReceivedBy).HasMaxLength(120);
            e.HasOne(x => x.Order).WithMany(o => o.Samples).HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<TestResult>(e =>
        {
            e.ToTable("test_results");
            e.HasKey(x => x.Id);
            e.Property(x => x.FileName).HasMaxLength(260).IsRequired();
            e.Property(x => x.ContentType).HasMaxLength(120);
            e.HasOne(x => x.Order).WithOne(o => o.Result).HasForeignKey<TestResult>(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.OrderId).IsUnique();
        });

        b.Entity<OrderEvent>(e =>
        {
            e.ToTable("order_events");
            e.HasKey(x => x.Id);
            e.Property(x => x.Step).HasConversion<int>();
            e.Property(x => x.ActorName).HasMaxLength(200);
            e.Property(x => x.Note).HasMaxLength(1000);
            e.HasOne(x => x.Order).WithMany(o => o.Events).HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.OrderId, x.At });
        });

        b.Entity<SequenceCounter>(e =>
        {
            e.ToTable("sequences");
            e.HasKey(x => x.Key);
            e.Property(x => x.Key).HasMaxLength(50);
        });
    }
}
