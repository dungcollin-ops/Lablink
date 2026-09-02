using LabLink.Application.Orders;
using LabLink.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace LabLink.Infrastructure.Orders;

public class PatientService : IPatientService
{
    private readonly AppDbContext _db;

    public PatientService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<PatientSearchDto>> SearchAsync(string query, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(query)) return Array.Empty<PatientSearchDto>();
        var t = query.Trim();

        return await _db.Patients.AsNoTracking()
            .Where(p => EF.Functions.ILike(p.FullName, $"%{t}%")
                     || EF.Functions.ILike(p.MaBN, $"%{t}%")
                     || (p.NationalId != null && EF.Functions.ILike(p.NationalId, $"%{t}%"))
                     || (p.Phone != null && EF.Functions.ILike(p.Phone, $"%{t}%")))
            .OrderBy(p => p.FullName)
            .Take(20)
            .Select(p => new PatientSearchDto(
                p.Id, p.MaBN, p.FullName, p.Dob, p.Gender, p.Phone, p.Address))
            .ToListAsync(ct);
    }
}
