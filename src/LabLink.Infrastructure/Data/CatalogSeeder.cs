using System.Reflection;
using System.Text.Json;
using LabLink.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LabLink.Infrastructure.Data;

/// <summary>Seed danh mục xét nghiệm từ file nhúng Data/Seed/catalog.json
/// (~1184 mục, dữ liệu thật). Idempotent theo ExternalId.</summary>
public static class CatalogSeeder
{
    private sealed record Item(
        string id, string code, string name, string provider,
        long listPrice, string group, string[]? samples, string? turnaround);

    public static async Task SeedAsync(AppDbContext db, CancellationToken ct = default)
    {
        var asm = typeof(CatalogSeeder).Assembly;
        var resName = asm.GetManifestResourceNames().Single(n => n.EndsWith("catalog.json"));
        await using var stream = asm.GetManifestResourceStream(resName)!;

        var items = await JsonSerializer.DeserializeAsync<List<Item>>(
            stream, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }, ct) ?? new();

        var existing = (await db.LabTests.Select(x => x.ExternalId).ToListAsync(ct))
            .ToHashSet();

        var toAdd = items
            .Where(i => !existing.Contains(i.id))
            .Select(i => new LabTest
            {
                ExternalId = i.id,
                Code = i.code,
                Name = i.name,
                Provider = i.provider,
                ListPrice = i.listPrice,
                Group = i.group,
                Samples = (i.samples ?? Array.Empty<string>()).ToList(),
                Turnaround = string.IsNullOrWhiteSpace(i.turnaround) ? null : i.turnaround,
            })
            .ToList();

        if (toAdd.Count > 0)
        {
            db.LabTests.AddRange(toAdd);
            await db.SaveChangesAsync(ct);
        }
    }
}
