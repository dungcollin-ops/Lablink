using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LabLink.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class ChangePatientDobToText : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // date -> varchar(10) cần USING; dữ liệu cũ (date đầy đủ) thành "YYYY-MM-DD".
            migrationBuilder.Sql(
                @"ALTER TABLE patients ALTER COLUMN ""Dob"" TYPE character varying(10) USING to_char(""Dob"", 'YYYY-MM-DD');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Rollback: chỉ những giá trị đủ YYYY-MM-DD mới cast lại được date, còn lại NULL.
            migrationBuilder.Sql(
                @"ALTER TABLE patients ALTER COLUMN ""Dob"" TYPE date USING (CASE WHEN ""Dob"" ~ '^\d{4}-\d{2}-\d{2}$' THEN ""Dob""::date ELSE NULL END);");
        }
    }
}
