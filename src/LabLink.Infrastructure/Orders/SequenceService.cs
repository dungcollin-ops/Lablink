using LabLink.Application.Orders;
using LabLink.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace LabLink.Infrastructure.Orders;

/// <summary>Tăng bộ đếm atomic bằng một câu lệnh Postgres duy nhất
/// (UPSERT + RETURNING) — an toàn khi nhiều tiến trình/máy chạy song song.</summary>
public class SequenceService : ISequenceService
{
    private readonly AppDbContext _db;

    public SequenceService(AppDbContext db) => _db = db;

    public async Task<long> NextRangeAsync(string key, int count, CancellationToken ct = default)
    {
        if (count < 1) count = 1;

        // INSERT...RETURNING là non-composable → dùng ToListAsync (chạy nguyên câu),
        // KHÔNG dùng SingleAsync (sẽ bị EF compose thêm subquery → lỗi).
        var rows = await _db.Database
            .SqlQueryRaw<long>(
                @"INSERT INTO sequences (""Key"", ""NextSeq"") VALUES ({0}, {1})
                  ON CONFLICT (""Key"") DO UPDATE SET ""NextSeq"" = sequences.""NextSeq"" + {1}
                  RETURNING ""NextSeq"" AS ""Value""",
                key, (long)count)
            .ToListAsync(ct);

        return rows[0];
    }
}
