using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LabLink.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderDepartmentDoctor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "DepartmentId",
                table: "orders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DoctorId",
                table: "orders",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_orders_DepartmentId",
                table: "orders",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_orders_DoctorId",
                table: "orders",
                column: "DoctorId");

            migrationBuilder.AddForeignKey(
                name: "FK_orders_departments_DepartmentId",
                table: "orders",
                column: "DepartmentId",
                principalTable: "departments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_orders_employees_DoctorId",
                table: "orders",
                column: "DoctorId",
                principalTable: "employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_orders_departments_DepartmentId",
                table: "orders");

            migrationBuilder.DropForeignKey(
                name: "FK_orders_employees_DoctorId",
                table: "orders");

            migrationBuilder.DropIndex(
                name: "IX_orders_DepartmentId",
                table: "orders");

            migrationBuilder.DropIndex(
                name: "IX_orders_DoctorId",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "DepartmentId",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "DoctorId",
                table: "orders");
        }
    }
}
