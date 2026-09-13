using LabLink.Application.Departments;
using LabLink.Domain.Entities;
using LabLink.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace LabLink.Infrastructure.Departments;

public class DepartmentService : IDepartmentService
{
    private readonly AppDbContext _db;
    public DepartmentService(AppDbContext db) => _db = db;

    private static DepartmentDto Map(Department d) =>
        new(d.Id, d.Name, d.Type, d.Address, d.Phone, d.HardCopyRequired, d.IsActive);

    public async Task<IReadOnlyList<DepartmentDto>> ListAsync(bool includeInactive, CancellationToken ct = default)
    {
        var q = _db.Departments.AsNoTracking().AsQueryable();
        if (!includeInactive) q = q.Where(x => x.IsActive);
        return await q.OrderBy(x => x.Name)
            .Select(x => new DepartmentDto(x.Id, x.Name, x.Type, x.Address, x.Phone, x.HardCopyRequired, x.IsActive))
            .ToListAsync(ct);
    }

    public async Task<DepartmentDto?> CreateAsync(DepartmentInput i, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(i.Name)) return null;
        var d = new Department
        {
            Name = i.Name.Trim(),
            Type = string.IsNullOrWhiteSpace(i.Type) ? "Phòng khám" : i.Type.Trim(),
            Address = i.Address, Phone = i.Phone,
            HardCopyRequired = i.HardCopyRequired, IsActive = i.IsActive,
        };
        _db.Departments.Add(d);
        await _db.SaveChangesAsync(ct);
        return Map(d);
    }

    public async Task<DepartmentDto?> UpdateAsync(Guid id, DepartmentInput i, CancellationToken ct = default)
    {
        var d = await _db.Departments.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (d is null) return null;
        if (!string.IsNullOrWhiteSpace(i.Name)) d.Name = i.Name.Trim();
        if (!string.IsNullOrWhiteSpace(i.Type)) d.Type = i.Type.Trim();
        d.Address = i.Address;
        d.Phone = i.Phone;
        d.HardCopyRequired = i.HardCopyRequired;
        d.IsActive = i.IsActive;
        await _db.SaveChangesAsync(ct);
        return Map(d);
    }

    // ---- Nhân viên ----
    public async Task<IReadOnlyList<EmployeeDto>> ListEmployeesAsync(Guid? departmentId, bool includeInactive, CancellationToken ct = default)
    {
        var q = _db.Employees.AsNoTracking().Include(x => x.Department).AsQueryable();
        if (departmentId is Guid did) q = q.Where(x => x.DepartmentId == did);
        if (!includeInactive) q = q.Where(x => x.IsActive);
        return await q.OrderBy(x => x.Department.Name).ThenBy(x => x.FullName)
            .Select(x => new EmployeeDto(x.Id, x.DepartmentId, x.Department.Name,
                x.FullName, x.Code, x.Position, x.Phone, x.IsActive))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<EmployeeDto>> ListDoctorsForUserAsync(Guid userId, CancellationToken ct = default)
    {
        var deptId = await _db.Users.Where(u => u.Id == userId)
            .Select(u => u.Employee != null ? (Guid?)u.Employee.DepartmentId : null)
            .FirstOrDefaultAsync(ct);
        var q = _db.Employees.AsNoTracking().Include(x => x.Department)
            .Where(x => x.IsActive && x.Position == "Bác sĩ");
        if (deptId is Guid did) q = q.Where(x => x.DepartmentId == did);
        return await q.OrderBy(x => x.FullName)
            .Select(x => new EmployeeDto(x.Id, x.DepartmentId, x.Department.Name,
                x.FullName, x.Code, x.Position, x.Phone, x.IsActive))
            .ToListAsync(ct);
    }

    public async Task<EmployeeDto?> CreateEmployeeAsync(EmployeeInput i, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(i.FullName)) return null;
        var dept = await _db.Departments.FirstOrDefaultAsync(x => x.Id == i.DepartmentId, ct);
        if (dept is null) return null;
        var e = new Employee
        {
            DepartmentId = i.DepartmentId,
            FullName = i.FullName.Trim(),
            Code = i.Code, Position = (i.Position ?? "").Trim(), Phone = i.Phone,
            IsActive = i.IsActive,
        };
        _db.Employees.Add(e);
        await _db.SaveChangesAsync(ct);
        return new EmployeeDto(e.Id, dept.Id, dept.Name, e.FullName, e.Code, e.Position, e.Phone, e.IsActive);
    }

    public async Task<EmployeeDto?> UpdateEmployeeAsync(Guid id, EmployeeInput i, CancellationToken ct = default)
    {
        var e = await _db.Employees.Include(x => x.Department).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        if (i.DepartmentId != Guid.Empty && i.DepartmentId != e.DepartmentId)
        {
            var dept = await _db.Departments.FirstOrDefaultAsync(x => x.Id == i.DepartmentId, ct);
            if (dept is not null) { e.DepartmentId = dept.Id; e.Department = dept; }
        }
        if (!string.IsNullOrWhiteSpace(i.FullName)) e.FullName = i.FullName.Trim();
        e.Code = i.Code;
        e.Position = (i.Position ?? "").Trim();
        e.Phone = i.Phone;
        e.IsActive = i.IsActive;
        await _db.SaveChangesAsync(ct);
        return new EmployeeDto(e.Id, e.DepartmentId, e.Department.Name, e.FullName, e.Code, e.Position, e.Phone, e.IsActive);
    }
}
