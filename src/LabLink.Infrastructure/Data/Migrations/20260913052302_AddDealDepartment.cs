using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LabLink.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDealDepartment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "DepartmentId",
                table: "price_deal_batches",
                type: "uuid",
                nullable: true);

            // Backfill: gán phòng khám cho các gói deal cũ theo NV của người gửi.
            migrationBuilder.Sql(@"
                UPDATE price_deal_batches b
                SET ""DepartmentId"" = e.""DepartmentId""
                FROM users u
                JOIN employees e ON e.""Id"" = u.""EmployeeId""
                WHERE b.""ProposedById"" = u.""Id"" AND b.""DepartmentId"" IS NULL;
            ");

            migrationBuilder.CreateIndex(
                name: "IX_price_deal_batches_DepartmentId",
                table: "price_deal_batches",
                column: "DepartmentId");

            migrationBuilder.AddForeignKey(
                name: "FK_price_deal_batches_departments_DepartmentId",
                table: "price_deal_batches",
                column: "DepartmentId",
                principalTable: "departments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_price_deal_batches_departments_DepartmentId",
                table: "price_deal_batches");

            migrationBuilder.DropIndex(
                name: "IX_price_deal_batches_DepartmentId",
                table: "price_deal_batches");

            migrationBuilder.DropColumn(
                name: "DepartmentId",
                table: "price_deal_batches");
        }
    }
}
