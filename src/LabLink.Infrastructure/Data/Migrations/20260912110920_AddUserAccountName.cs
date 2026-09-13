using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LabLink.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddUserAccountName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_users_Email",
                table: "users");

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "users",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(256)",
                oldMaxLength: 256);

            migrationBuilder.AddColumn<string>(
                name: "AccountName",
                table: "users",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "");

            // Backfill: tài khoản cũ lấy AccountName = phần trước @ của Email (đảm bảo unique);
            // nếu vẫn trùng thì thêm 8 ký tự đầu của Id.
            migrationBuilder.Sql(@"
                UPDATE users SET ""AccountName"" = split_part(""Email"", '@', 1)
                WHERE ""AccountName"" = '' AND ""Email"" IS NOT NULL;
                UPDATE users SET ""AccountName"" = 'user_' || left(""Id""::text, 8)
                WHERE ""AccountName"" = '';
                UPDATE users u SET ""AccountName"" = u.""AccountName"" || '_' || left(u.""Id""::text, 8)
                WHERE EXISTS (
                    SELECT 1 FROM users d
                    WHERE d.""AccountName"" = u.""AccountName"" AND d.""Id"" <> u.""Id"");
            ");

            migrationBuilder.CreateIndex(
                name: "IX_users_AccountName",
                table: "users",
                column: "AccountName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_Email",
                table: "users",
                column: "Email",
                unique: true,
                filter: "\"Email\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_users_AccountName",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_users_Email",
                table: "users");

            migrationBuilder.DropColumn(
                name: "AccountName",
                table: "users");

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "users",
                type: "character varying(256)",
                maxLength: 256,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(256)",
                oldMaxLength: 256,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_Email",
                table: "users",
                column: "Email",
                unique: true);
        }
    }
}
