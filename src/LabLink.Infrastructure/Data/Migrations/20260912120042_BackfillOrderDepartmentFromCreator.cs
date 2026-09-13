using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LabLink.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class BackfillOrderDepartmentFromCreator : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Gán phòng ban cho phiếu cũ (DepartmentId NULL) theo phòng của NGƯỜI TẠO
            // (User → Employee → Department). Chỉ áp cho user có gắn nhân viên; khách lẻ/admin bỏ qua.
            migrationBuilder.Sql(@"
                UPDATE orders o
                SET ""DepartmentId"" = e.""DepartmentId""
                FROM users u
                JOIN employees e ON e.""Id"" = u.""EmployeeId""
                WHERE o.""CreatedById"" = u.""Id"" AND o.""DepartmentId"" IS NULL;
            ");

            // Bác sĩ chỉ định cho phiếu cũ: nếu người tạo là chức danh 'Bác sĩ' thì gán DoctorId = NV đó.
            migrationBuilder.Sql(@"
                UPDATE orders o
                SET ""DoctorId"" = e.""Id""
                FROM users u
                JOIN employees e ON e.""Id"" = u.""EmployeeId""
                WHERE o.""CreatedById"" = u.""Id"" AND o.""DoctorId"" IS NULL AND e.""Position"" = 'Bác sĩ';
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
