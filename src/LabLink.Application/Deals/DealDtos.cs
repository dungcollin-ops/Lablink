namespace LabLink.Application.Deals;

public record DealLineInput(Guid LabTestId, long ProposedPrice);

public record CreateDealBatchRequest(string? Note, IReadOnlyList<DealLineInput> Items);

public record DealItemDto(
    Guid Id,
    Guid LabTestId,
    string Code,
    string Name,
    string Group,
    long ListPrice,
    long ProposedPrice,
    string Status,
    double DiffPercent);

public record DealBatchDto(
    Guid Id,
    Guid ProposedById,
    string ProposedByName,
    string? Note,
    DateTimeOffset CreatedAt,
    IReadOnlyList<DealItemDto> Items);

public record DealResult(bool Ok, string? Error = null)
{
    public static readonly DealResult Success = new(true);
    public static DealResult Fail(string msg) => new(false, msg);
}
