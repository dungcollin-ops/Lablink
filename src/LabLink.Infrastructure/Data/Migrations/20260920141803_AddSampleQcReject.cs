using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LabLink.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSampleQcReject : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "QcEvidence",
                table: "samples",
                type: "bytea",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QcEvidenceName",
                table: "samples",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QcEvidenceType",
                table: "samples",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QcReason",
                table: "samples",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "QcRejectedAt",
                table: "samples",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QcRejectedBy",
                table: "samples",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "QcEvidence",
                table: "samples");

            migrationBuilder.DropColumn(
                name: "QcEvidenceName",
                table: "samples");

            migrationBuilder.DropColumn(
                name: "QcEvidenceType",
                table: "samples");

            migrationBuilder.DropColumn(
                name: "QcReason",
                table: "samples");

            migrationBuilder.DropColumn(
                name: "QcRejectedAt",
                table: "samples");

            migrationBuilder.DropColumn(
                name: "QcRejectedBy",
                table: "samples");
        }
    }
}
