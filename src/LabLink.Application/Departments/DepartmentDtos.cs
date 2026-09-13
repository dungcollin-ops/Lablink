namespace LabLink.Application.Departments;

public record DepartmentDto(
    Guid Id, string Name, string Type, string? Address, string? Phone,
    bool HardCopyRequired, bool IsActive);

public record DepartmentInput(
    string Name, string Type, string? Address, string? Phone,
    bool HardCopyRequired, bool IsActive);
