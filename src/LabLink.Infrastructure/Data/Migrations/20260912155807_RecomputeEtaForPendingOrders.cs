using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LabLink.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class RecomputeEtaForPendingOrders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Tính lại ETA (EtaMin/Max = max TG các xét nghiệm trong phiếu, theo danh mục HIỆN TẠI)
            // cho các phiếu CHƯA trả kết quả (Stage < Resulted = 4). Phiếu đã có KQ giữ nguyên.
            migrationBuilder.Sql(@"
                UPDATE orders o SET
                    ""EtaMinHours"" = sub.min_tat,
                    ""EtaMaxHours"" = sub.max_tat
                FROM (
                    SELECT oi.""OrderId"" AS oid,
                           MAX(lt.""TatMinHours"") AS min_tat,
                           MAX(lt.""TatMaxHours"") AS max_tat
                    FROM order_items oi
                    JOIN lab_tests lt ON lt.""Id"" = oi.""LabTestId""
                    GROUP BY oi.""OrderId""
                ) sub
                WHERE o.""Id"" = sub.oid AND o.""Stage"" < 4;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
