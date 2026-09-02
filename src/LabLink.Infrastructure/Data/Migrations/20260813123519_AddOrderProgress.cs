using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LabLink.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderProgress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CollectAt",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CollectBy",
                table: "orders",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CollectPlace",
                table: "orders",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ExpectedResultAt",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ReceiveAt",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReceiveBy",
                table: "orders",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReceivePlace",
                table: "orders",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "SendAt",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SendVia",
                table: "orders",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Shipper",
                table: "orders",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TrackingNo",
                table: "orders",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CollectAt",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "CollectBy",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "CollectPlace",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "ExpectedResultAt",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "ReceiveAt",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "ReceiveBy",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "ReceivePlace",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "SendAt",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "SendVia",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Shipper",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "TrackingNo",
                table: "orders");
        }
    }
}
