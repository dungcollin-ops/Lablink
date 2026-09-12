using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LabLink.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "order_events",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    Step = table.Column<int>(type: "integer", nullable: false),
                    ActorId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    At = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_events", x => x.Id);
                    table.ForeignKey(
                        name: "FK_order_events_orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_order_events_OrderId_At",
                table: "order_events",
                columns: new[] { "OrderId", "At" });

            // Map trạng thái cũ sang enum mới: Running(4)→Received(3), Resulted(5)→Resulted(4).
            // Sent(2) giữ giá trị 2 (nay là Gathered). Ordered(0)/Collected(1) không đổi.
            migrationBuilder.Sql(
                "UPDATE orders SET \"Stage\" = CASE \"Stage\" WHEN 4 THEN 3 WHEN 5 THEN 4 ELSE \"Stage\" END;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "order_events");
        }
    }
}
