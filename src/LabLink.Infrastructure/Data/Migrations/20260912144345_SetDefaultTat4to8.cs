using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LabLink.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class SetDefaultTat4to8 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Đặt TG dự kiến trả KQ mặc định = 4–8 giờ cho TẤT CẢ xét nghiệm (dùng tính ETA).
            migrationBuilder.Sql(@"UPDATE lab_tests SET ""TatMinHours"" = 4, ""TatMaxHours"" = 8;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
