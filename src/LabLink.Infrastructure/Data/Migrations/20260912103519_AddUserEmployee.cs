using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LabLink.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddUserEmployee : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "EmployeeId",
                table: "users",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_EmployeeId",
                table: "users",
                column: "EmployeeId");

            migrationBuilder.AddForeignKey(
                name: "FK_users_employees_EmployeeId",
                table: "users",
                column: "EmployeeId",
                principalTable: "employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_users_employees_EmployeeId",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_users_EmployeeId",
                table: "users");

            migrationBuilder.DropColumn(
                name: "EmployeeId",
                table: "users");
        }
    }
}
