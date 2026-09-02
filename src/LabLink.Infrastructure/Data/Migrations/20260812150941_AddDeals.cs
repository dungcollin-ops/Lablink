using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LabLink.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDeals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "price_deal_batches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProposedById = table.Column<Guid>(type: "uuid", nullable: false),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_price_deal_batches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_price_deal_batches_users_ProposedById",
                        column: x => x.ProposedById,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "price_deals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BatchId = table.Column<Guid>(type: "uuid", nullable: false),
                    LabTestId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProposedPrice = table.Column<long>(type: "bigint", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    DecidedById = table.Column<Guid>(type: "uuid", nullable: true),
                    DecidedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_price_deals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_price_deals_lab_tests_LabTestId",
                        column: x => x.LabTestId,
                        principalTable: "lab_tests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_price_deals_price_deal_batches_BatchId",
                        column: x => x.BatchId,
                        principalTable: "price_deal_batches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_price_deal_batches_ProposedById",
                table: "price_deal_batches",
                column: "ProposedById");

            migrationBuilder.CreateIndex(
                name: "IX_price_deals_BatchId",
                table: "price_deals",
                column: "BatchId");

            migrationBuilder.CreateIndex(
                name: "IX_price_deals_LabTestId_Status",
                table: "price_deals",
                columns: new[] { "LabTestId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_price_deals_Status",
                table: "price_deals",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "price_deals");

            migrationBuilder.DropTable(
                name: "price_deal_batches");
        }
    }
}
