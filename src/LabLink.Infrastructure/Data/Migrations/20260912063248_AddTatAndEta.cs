using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LabLink.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTatAndEta : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "EtaMaxHours",
                table: "orders",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "EtaMinHours",
                table: "orders",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TatMaxHours",
                table: "lab_tests",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TatMinHours",
                table: "lab_tests",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EtaMaxHours",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "EtaMinHours",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "TatMaxHours",
                table: "lab_tests");

            migrationBuilder.DropColumn(
                name: "TatMinHours",
                table: "lab_tests");
        }
    }
}
