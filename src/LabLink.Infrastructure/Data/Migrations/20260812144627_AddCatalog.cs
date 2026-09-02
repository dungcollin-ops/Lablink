using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LabLink.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "lab_tests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ExternalId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Provider = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    ListPrice = table.Column<long>(type: "bigint", nullable: false),
                    Group = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Samples = table.Column<List<string>>(type: "text[]", nullable: false),
                    Turnaround = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lab_tests", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lab_tests_Code",
                table: "lab_tests",
                column: "Code");

            migrationBuilder.CreateIndex(
                name: "IX_lab_tests_ExternalId",
                table: "lab_tests",
                column: "ExternalId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lab_tests_Group",
                table: "lab_tests",
                column: "Group");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "lab_tests");
        }
    }
}
