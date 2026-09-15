using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LabLink.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddParallelGatherFlags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "GatherAt",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GatherBy",
                table: "orders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "GatherClaimAt",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GatherClaimBy",
                table: "orders",
                type: "text",
                nullable: true);

            // ---- Remap dữ liệu cũ sang mô hình mới (Collected/Gathered thành cờ song song) ----
            // Phiếu ĐÃ gom (Stage>=2): coi như đã lấy + gom → set cờ GatherAt/CollectAt (giữ nguyên Stage).
            migrationBuilder.Sql(@"
                UPDATE orders SET
                    ""GatherAt"" = COALESCE(""SendAt"", ""UpdatedAt"", ""CreatedAt""),
                    ""GatherBy"" = COALESCE(""Shipper"", 'Hệ thống'),
                    ""CollectAt"" = COALESCE(""CollectAt"", ""CreatedAt"")
                WHERE ""Stage"" >= 2 AND ""GatherAt"" IS NULL;
            ");
            // Phiếu ở Collected (Stage=1, đã lấy nhưng CHƯA gom) → về Ordered(0); CollectAt giữ nguyên.
            migrationBuilder.Sql(@"UPDATE orders SET ""Stage"" = 0 WHERE ""Stage"" = 1;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GatherAt",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "GatherBy",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "GatherClaimAt",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "GatherClaimBy",
                table: "orders");
        }
    }
}
