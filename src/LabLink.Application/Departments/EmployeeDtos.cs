namespace LabLink.Application.Departments;

public record EmployeeDto(
    Guid Id, Guid DepartmentId, string DepartmentName,
    string FullName, string? Code, string Position, string? Phone, bool IsActive);

public record EmployeeInput(
    Guid DepartmentId, string FullName, string? Code, string Position, string? Phone, bool IsActive);
