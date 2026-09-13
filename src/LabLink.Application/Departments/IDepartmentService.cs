namespace LabLink.Application.Departments;

public interface IDepartmentService
{
    Task<IReadOnlyList<DepartmentDto>> ListAsync(bool includeInactive, CancellationToken ct = default);
    Task<DepartmentDto?> CreateAsync(DepartmentInput input, CancellationToken ct = default);
    Task<DepartmentDto?> UpdateAsync(Guid id, DepartmentInput input, CancellationToken ct = default);

    Task<IReadOnlyList<EmployeeDto>> ListEmployeesAsync(Guid? departmentId, bool includeInactive, CancellationToken ct = default);

    /// <summary>Danh sách bác sĩ cho ô "Bác sĩ chỉ định" — theo phòng ban của người tạo (không có phòng → tất cả).</summary>
    Task<IReadOnlyList<EmployeeDto>> ListDoctorsForUserAsync(Guid userId, CancellationToken ct = default);
    Task<EmployeeDto?> CreateEmployeeAsync(EmployeeInput input, CancellationToken ct = default);
    Task<EmployeeDto?> UpdateEmployeeAsync(Guid id, EmployeeInput input, CancellationToken ct = default);
}
