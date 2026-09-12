using System.Text.RegularExpressions;
using LabLink.Application.Orders;
using LabLink.Domain.Entities;
using LabLink.Domain.Enums;
using LabLink.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace LabLink.Infrastructure.Orders;

public partial class OrderService : IOrderService
{
    private readonly AppDbContext _db;
    private readonly ISequenceService _seq;

    public OrderService(AppDbContext db, ISequenceService seq)
    {
        _db = db;
        _seq = seq;
    }

    [GeneratedRegex(@"^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$")]
    private static partial Regex EmailRegex();

    public async Task<OrderResult> CreateAsync(Guid userId, CreateOrderRequest req, CancellationToken ct = default)
    {
        var source = req.Source?.Trim().ToLowerInvariant() == "retail"
            ? OrderSource.Retail : OrderSource.Doctor;

        // ---- Validate ----
        if (req.Patient is null || string.IsNullOrWhiteSpace(req.Patient.FullName))
            return OrderResult.Fail("Thiếu họ tên bệnh nhân.");
        if (req.Items is null || req.Items.Count == 0)
            return OrderResult.Fail("Cần ít nhất 1 xét nghiệm.");
        if (req.Items.Any(i => i.Qty < 1))
            return OrderResult.Fail("Số lượng phải ≥ 1.");

        var email = req.Patient.Email?.Replace(" ", "").ToLowerInvariant();
        if (!string.IsNullOrEmpty(email) && !EmailRegex().IsMatch(email))
            return OrderResult.Fail("Email không hợp lệ — ví dụ: ten@benhvien.vn");

        var ids = req.Items.Select(i => i.LabTestId).Distinct().ToList();
        var tests = await _db.LabTests.Where(t => ids.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t, ct);
        if (ids.Any(id => !tests.ContainsKey(id)))
            return OrderResult.Fail("Có xét nghiệm không tồn tại.");

        // ---- Giá chốt (deal) cho bác sĩ ----
        var dealPrices = new Dictionary<Guid, long>();
        if (source == OrderSource.Doctor)
        {
            dealPrices = await _db.PriceDeals.AsNoTracking()
                .Where(d => d.Status == DealStatus.Approved
                         && d.Batch.ProposedById == userId
                         && ids.Contains(d.LabTestId))
                .OrderByDescending(d => d.DecidedAt)
                .GroupBy(d => d.LabTestId)
                .Select(g => new { g.Key, Price = g.First().ProposedPrice })
                .ToDictionaryAsync(x => x.Key, x => x.Price, ct);
        }

        // ---- Bệnh nhân ----
        var patient = await ResolvePatientAsync(req.Patient, email, ct);

        // ---- Dòng chỉ định ----
        var items = new List<OrderItem>();
        long total = 0;
        foreach (var i in req.Items)
        {
            var test = tests[i.LabTestId];
            var price = source == OrderSource.Doctor && dealPrices.TryGetValue(test.Id, out var dp)
                ? dp : test.ListPrice;
            var sampleType = !string.IsNullOrWhiteSpace(i.SampleType)
                ? i.SampleType!.Trim()
                : (test.Samples.FirstOrDefault() ?? "—");
            total += price * i.Qty;
            items.Add(new OrderItem
            {
                LabTestId = test.Id,
                TestCode = test.Code,
                TestName = test.Name,
                SampleType = sampleType,
                Qty = i.Qty,
                UnitPrice = price,
            });
        }

        // ---- Gom mẫu + sinh SID atomic (1 loại mẫu = 1 SID). Sinh ngay khi tạo phiếu. ----
        var samples = await BuildSamplesWithSidAsync(items.Select(x => x.SampleType), ct);

        // ---- Mã phiếu ----
        var orderSeq = await _seq.NextRangeAsync("ORDER", 1, ct);
        var order = new Order
        {
            OrderNo = $"O-{orderSeq}",
            Source = source,
            Stage = OrderStage.Ordered,
            PatientId = patient.Id,
            PatientName = patient.FullName,
            PatientMaBN = patient.MaBN,
            ClinicName = req.ClinicName,
            DoctorCode = req.DoctorCode,
            Diagnosis = req.Diagnosis,
            Note = req.Note,
            Total = total,
            CreatedById = userId,
            Items = items,
            Samples = samples,
        };

        order.Events.Add(new OrderEvent
        {
            Step = OrderStage.Ordered, ActorId = userId,
            ActorName = await ActorNameAsync(userId, ct), At = DateTimeOffset.UtcNow,
        });

        _db.Orders.Add(order);
        _db.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = "order.create",
            ObjectType = "Order",
            ObjectId = order.Id.ToString(),
            Detail = $"{order.OrderNo} · {items.Count} XN · {samples.Count} SID",
        });
        await _db.SaveChangesAsync(ct);

        return OrderResult.Success(Map(order, null));
    }

    public async Task<IReadOnlyList<OrderListItemDto>> ListAsync(
        Guid userId, bool seeAll, string? query, string? stage, CancellationToken ct = default)
    {
        var q = _db.Orders.AsNoTracking().AsQueryable();
        if (!seeAll) q = q.Where(o => o.CreatedById == userId);

        if (!string.IsNullOrWhiteSpace(query))
        {
            var t = query.Trim();
            q = q.Where(o => EF.Functions.ILike(o.OrderNo, $"%{t}%")
                          || EF.Functions.ILike(o.PatientName, $"%{t}%")
                          || EF.Functions.ILike(o.PatientMaBN, $"%{t}%")
                          || o.Samples.Any(s => EF.Functions.ILike(s.Sid, $"%{t}%"))
                          || o.Items.Any(it => EF.Functions.ILike(it.TestName, $"%{t}%")));
        }
        if (!string.IsNullOrWhiteSpace(stage) && Enum.TryParse<OrderStage>(stage, true, out var st))
            q = q.Where(o => o.Stage == st);

        return await q.OrderByDescending(o => o.CreatedAt)
            .Select(o => new OrderListItemDto(
                o.Id, o.OrderNo, o.Source.ToString(), o.Stage.ToString(),
                o.PatientName, o.PatientMaBN, o.Items.Count, o.Total, o.CreatedAt,
                o.Result != null))
            .ToListAsync(ct);
    }

    public async Task<OrderDto?> GetAsync(Guid id, Guid userId, bool seeAll, CancellationToken ct = default)
    {
        var o = await _db.Orders.AsNoTracking()
            .Include(x => x.Items)
            .Include(x => x.Samples)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o is null) return null;
        if (!seeAll && o.CreatedById != userId) return null;
        return Map(o, await ResultFileNameAsync(o.Id, ct));
    }

    public async Task<OrderFullDto?> GetFullAsync(Guid id, Guid userId, bool seeAll, CancellationToken ct = default)
    {
        var o = await _db.Orders.AsNoTracking()
            .Include(x => x.Items)
            .Include(x => x.Samples)
            .Include(x => x.Patient)
            .Include(x => x.Events)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o is null) return null;
        if (!seeAll && o.CreatedById != userId) return null;
        return MapFull(o, await ResultFileNameAsync(o.Id, ct));
    }

    public async Task<OrderResult> UpdateAsync(Guid id, Guid userId, bool seeAll, UpdateOrderRequest req, CancellationToken ct = default)
    {
        var order = await _db.Orders
            .Include(o => o.Items)
            .Include(o => o.Samples)
            .Include(o => o.Patient)
            .FirstOrDefaultAsync(o => o.Id == id, ct);
        if (order is null) return OrderResult.Fail("Không tìm thấy phiếu.");
        if (!seeAll && order.CreatedById != userId) return OrderResult.Fail("Không có quyền trên phiếu này.");
        if ((int)order.Stage >= (int)OrderStage.Gathered)
            return OrderResult.Fail("Phiếu đã chuyển cho phòng xét nghiệm — không sửa được nữa.");

        // ---- Validate ----
        if (req.Patient is null || string.IsNullOrWhiteSpace(req.Patient.FullName))
            return OrderResult.Fail("Thiếu họ tên bệnh nhân.");
        if (req.Items is null || req.Items.Count == 0)
            return OrderResult.Fail("Cần ít nhất 1 xét nghiệm.");
        if (req.Items.Any(i => i.Qty < 1))
            return OrderResult.Fail("Số lượng phải ≥ 1.");

        var email = req.Patient.Email?.Replace(" ", "").ToLowerInvariant();
        if (!string.IsNullOrEmpty(email) && !EmailRegex().IsMatch(email))
            return OrderResult.Fail("Email không hợp lệ — ví dụ: ten@benhvien.vn");

        var ids = req.Items.Select(i => i.LabTestId).Distinct().ToList();
        var tests = await _db.LabTests.Where(t => ids.Contains(t.Id)).ToDictionaryAsync(t => t.Id, t => t, ct);
        if (ids.Any(x => !tests.ContainsKey(x)))
            return OrderResult.Fail("Có xét nghiệm không tồn tại.");

        // ---- Giá chốt (deal) cho bác sĩ ----
        var dealPrices = new Dictionary<Guid, long>();
        if (order.Source == OrderSource.Doctor)
        {
            dealPrices = await _db.PriceDeals.AsNoTracking()
                .Where(d => d.Status == DealStatus.Approved
                         && d.Batch.ProposedById == order.CreatedById
                         && ids.Contains(d.LabTestId))
                .OrderByDescending(d => d.DecidedAt)
                .GroupBy(d => d.LabTestId)
                .Select(g => new { g.Key, Price = g.First().ProposedPrice })
                .ToDictionaryAsync(x => x.Key, x => x.Price, ct);
        }

        // ---- Cập nhật hồ sơ bệnh nhân (DANH MỤC BN) + snapshot trên phiếu ----
        var p = order.Patient;
        p.FullName = req.Patient.FullName.Trim();
        p.Dob = req.Patient.Dob;
        p.Gender = req.Patient.Gender;
        p.Phone = req.Patient.Phone;
        p.Email = email;
        p.NationalId = req.Patient.NationalId;
        p.Bhyt = req.Patient.Bhyt;
        p.Address = req.Patient.Address;
        p.Note = req.Patient.Note;
        order.PatientName = p.FullName;
        order.PatientMaBN = p.MaBN;

        // ---- Field THEO PHIẾU ----
        order.ClinicName = req.ClinicName;
        order.DoctorCode = req.DoctorCode;
        order.Diagnosis = req.Diagnosis;
        order.Note = req.Note;

        // ---- Dựng lại dòng chỉ định + tổng ----
        var hadSamples = order.Samples.Count > 0;
        _db.RemoveRange(order.Items.ToList());
        long total = 0;
        var newItems = new List<OrderItem>();
        foreach (var i in req.Items)
        {
            var test = tests[i.LabTestId];
            var price = order.Source == OrderSource.Doctor && dealPrices.TryGetValue(test.Id, out var dp)
                ? dp : test.ListPrice;
            var sampleType = !string.IsNullOrWhiteSpace(i.SampleType)
                ? i.SampleType!.Trim()
                : (test.Samples.FirstOrDefault() ?? "—");
            total += price * i.Qty;
            newItems.Add(new OrderItem
            {
                OrderId = order.Id,
                LabTestId = test.Id, TestCode = test.Code, TestName = test.Name,
                SampleType = sampleType, Qty = i.Qty, UnitPrice = price,
            });
        }
        _db.AddRange(newItems);
        order.Total = total;

        // ---- Đồng bộ SID/mẫu (1 loại mẫu = 1 SID). Chỉ áp cho phiếu ĐÃ có SID sẵn. ----
        var neededTypes = newItems.Select(x => x.SampleType).Where(s => !string.IsNullOrEmpty(s)).Distinct().ToList();
        if (neededTypes.Count == 0) neededTypes.Add("—");
        var existingTypes = order.Samples.Select(s => s.SampleType).ToHashSet();
        var removeSamples = order.Samples.Where(s => !neededTypes.Contains(s.SampleType)).ToList();
        if (removeSamples.Count > 0) _db.RemoveRange(removeSamples);
        if (hadSamples)
        {
            var missingTypes = neededTypes.Where(t => !existingTypes.Contains(t)).ToList();
            if (missingTypes.Count > 0)
            {
                var added = await BuildSamplesWithSidAsync(missingTypes, ct);
                foreach (var sm in added) { sm.OrderId = order.Id; _db.Samples.Add(sm); }
            }
        }
        order.UpdatedAt = DateTimeOffset.UtcNow;

        _db.AuditLogs.Add(new AuditLog
        {
            UserId = userId, Action = "order.update",
            ObjectType = "Order", ObjectId = order.Id.ToString(),
            Detail = $"{order.OrderNo} · sửa · {newItems.Count} XN",
        });
        await _db.SaveChangesAsync(ct);
        return OrderResult.Success(await GetTracked(order.Id, ct));
    }

    public async Task<OrderResult> SetStageAsync(Guid orderId, string stage, Guid actorId, string? by = null, CancellationToken ct = default)
    {
        if (!Enum.TryParse<OrderStage>(stage, true, out var st))
            return OrderResult.Fail("Trạng thái không hợp lệ.");
        // "Có kết quả" chỉ đạt được khi tải file kết quả lên (UploadResultAsync) — không cho set tay.
        if (st == OrderStage.Resulted)
            return OrderResult.Fail("Chỉ chuyển sang \"Có kết quả\" bằng cách tải file kết quả lên.");
        var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null) return OrderResult.Fail("Không tìm thấy phiếu.");

        var who = string.IsNullOrWhiteSpace(by) ? null : by.Trim();
        if (st == OrderStage.Collected && who != null) { order.CollectBy = who; order.CollectAt = DateTimeOffset.UtcNow; }
        if (st == OrderStage.Received && who != null) { order.ReceiveBy = who; order.ReceiveAt = DateTimeOffset.UtcNow; }

        order.Stage = st;
        order.UpdatedAt = DateTimeOffset.UtcNow;
        _db.OrderEvents.Add(new OrderEvent { OrderId = order.Id, Step = st, ActorId = actorId, ActorName = await ActorNameAsync(actorId, ct), At = DateTimeOffset.UtcNow, Note = who != null ? $"Người thực hiện: {who}" : null });
        _db.AuditLogs.Add(new AuditLog
        {
            UserId = actorId, Action = "order.stage",
            ObjectType = "Order", ObjectId = order.Id.ToString(), Detail = $"{order.OrderNo} → {st}",
        });
        await _db.SaveChangesAsync(ct);
        return OrderResult.Success(await GetTracked(order.Id, ct));
    }

    public async Task<OrderResult> SetSampleQualityAsync(Guid sampleId, string quality, Guid actorId, CancellationToken ct = default)
    {
        if (!Enum.TryParse<SampleQuality>(quality, true, out var q))
            return OrderResult.Fail("Chất lượng mẫu không hợp lệ.");
        var sample = await _db.Samples.FirstOrDefaultAsync(s => s.Id == sampleId, ct);
        if (sample is null) return OrderResult.Fail("Không tìm thấy mẫu.");

        sample.Quality = q;
        _db.AuditLogs.Add(new AuditLog
        {
            UserId = actorId, Action = "sample.qc",
            ObjectType = "Sample", ObjectId = sample.Id.ToString(), Detail = $"{sample.Sid} · {q}",
        });
        await _db.SaveChangesAsync(ct);
        return OrderResult.Success(await GetTracked(sample.OrderId, ct));
    }

    public async Task<OrderResult> UploadResultAsync(
        Guid orderId, string fileName, string contentType, byte[] content, Guid actorId, CancellationToken ct = default)
    {
        if (content is null || content.Length == 0) return OrderResult.Fail("File rỗng.");
        var order = await _db.Orders.Include(o => o.Result).FirstOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null) return OrderResult.Fail("Không tìm thấy phiếu.");

        if (order.Result is null)
        {
            order.Result = new TestResult { OrderId = order.Id };
            _db.TestResults.Add(order.Result);
        }
        order.Result.FileName = fileName;
        order.Result.ContentType = string.IsNullOrWhiteSpace(contentType) ? "application/pdf" : contentType;
        order.Result.Content = content;
        order.Result.Size = content.Length;
        order.Result.UploadedById = actorId;
        order.Result.UploadedAt = DateTimeOffset.UtcNow;

        order.Stage = OrderStage.Resulted;
        order.UpdatedAt = DateTimeOffset.UtcNow;
        _db.OrderEvents.Add(new OrderEvent { OrderId = order.Id, Step = OrderStage.Resulted, ActorId = actorId, ActorName = await ActorNameAsync(actorId, ct), At = DateTimeOffset.UtcNow });

        _db.AuditLogs.Add(new AuditLog
        {
            UserId = actorId, Action = "result.upload",
            ObjectType = "Order", ObjectId = order.Id.ToString(), Detail = $"{order.OrderNo} · {fileName}",
        });
        await _db.SaveChangesAsync(ct);
        return OrderResult.Success(await GetTracked(order.Id, ct));
    }

    public async Task<ResultFile?> DownloadResultAsync(Guid orderId, Guid userId, bool seeAll, CancellationToken ct = default)
    {
        var order = await _db.Orders.AsNoTracking()
            .Include(o => o.Result)
            .FirstOrDefaultAsync(o => o.Id == orderId, ct);
        if (order?.Result is null) return null;
        if (!seeAll && order.CreatedById != userId) return null;

        _db.AuditLogs.Add(new AuditLog
        {
            UserId = userId, Action = "result.download",
            ObjectType = "Order", ObjectId = order.Id.ToString(), Detail = order.Result.FileName,
        });
        await _db.SaveChangesAsync(ct);

        return new ResultFile(order.Result.FileName, order.Result.ContentType, order.Result.Content);
    }

    public async Task<OrderResult> SetProgressAsync(Guid orderId, SetProgressRequest r, Guid actorId, CancellationToken ct = default)
    {
        var o = await _db.Orders.FirstOrDefaultAsync(x => x.Id == orderId, ct);
        if (o is null) return OrderResult.Fail("Không tìm thấy phiếu.");

        o.CollectPlace = r.CollectPlace; o.CollectBy = r.CollectBy; o.CollectAt = r.CollectAt?.ToUniversalTime();
        o.SendVia = r.SendVia; o.TrackingNo = r.TrackingNo; o.Shipper = r.Shipper; o.SendAt = r.SendAt?.ToUniversalTime();
        o.ReceivePlace = r.ReceivePlace; o.ReceiveBy = r.ReceiveBy; o.ReceiveAt = r.ReceiveAt?.ToUniversalTime();
        o.ExpectedResultAt = r.ExpectedResultAt?.ToUniversalTime();
        o.UpdatedAt = DateTimeOffset.UtcNow;

        _db.AuditLogs.Add(new AuditLog
        {
            UserId = actorId, Action = "order.progress",
            ObjectType = "Order", ObjectId = o.Id.ToString(), Detail = o.OrderNo,
        });
        await _db.SaveChangesAsync(ct);
        return OrderResult.Success(await GetTracked(o.Id, ct));
    }

    public async Task<OrderResult> AssignCollectAsync(Guid orderId, AssignCollectRequest r, Guid actorId, CancellationToken ct = default)
    {
        var order = await _db.Orders.Include(o => o.Items).Include(o => o.Samples)
            .FirstOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null) return OrderResult.Fail("Không tìm thấy phiếu.");
        if (order.Source != OrderSource.Retail) return OrderResult.Fail("Chỉ áp dụng cho phiếu khách lẻ.");
        if (order.Stage != OrderStage.Ordered) return OrderResult.Fail("Phiếu không ở trạng thái Chờ lấy mẫu.");
        if (string.IsNullOrWhiteSpace(r.Collector)) return OrderResult.Fail("Cần nhập NV lấy mẫu.");

        // Sinh SID lúc phân công lấy mẫu (theo quy trình khách lẻ).
        if (order.Samples.Count == 0)
        {
            var samples = await BuildSamplesWithSidAsync(order.Items.Select(i => i.SampleType), ct);
            foreach (var s in samples) { s.OrderId = order.Id; _db.Samples.Add(s); }
        }

        order.CollectBy = r.Collector.Trim();
        order.CollectAt = r.AppointmentAt?.ToUniversalTime();
        order.CollectPlace = r.Place;
        order.Stage = OrderStage.Collected;
        order.UpdatedAt = DateTimeOffset.UtcNow;
        _db.OrderEvents.Add(new OrderEvent { OrderId = order.Id, Step = OrderStage.Collected, ActorId = actorId, ActorName = await ActorNameAsync(actorId, ct), At = DateTimeOffset.UtcNow });

        _db.AuditLogs.Add(new AuditLog
        {
            UserId = actorId, Action = "order.assign_collect",
            ObjectType = "Order", ObjectId = order.Id.ToString(), Detail = $"{order.OrderNo} · NV {r.Collector}",
        });
        await _db.SaveChangesAsync(ct);
        return OrderResult.Success(await GetTracked(order.Id, ct));
    }

    public async Task<OrderResult> SendSampleAsync(Guid orderId, SendSampleRequest r, Guid actorId, bool seeAll, CancellationToken ct = default)
    {
        var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null) return OrderResult.Fail("Không tìm thấy phiếu.");
        if (!seeAll && order.CreatedById != actorId) return OrderResult.Fail("Không có quyền trên phiếu này.");
        if (order.Stage != OrderStage.Collected) return OrderResult.Fail("Phiếu không ở trạng thái Đã soạn mẫu.");
        if (string.IsNullOrWhiteSpace(r.SendVia)) return OrderResult.Fail("Cần chọn hình thức gửi.");

        order.SendVia = r.SendVia;
        order.TrackingNo = r.TrackingNo;
        order.Shipper = r.Shipper;
        order.SendAt = (r.SendAt ?? DateTimeOffset.UtcNow).ToUniversalTime();
        order.Stage = OrderStage.Gathered;
        order.UpdatedAt = DateTimeOffset.UtcNow;
        _db.OrderEvents.Add(new OrderEvent { OrderId = order.Id, Step = OrderStage.Gathered, ActorId = actorId, ActorName = await ActorNameAsync(actorId, ct), At = DateTimeOffset.UtcNow });

        _db.AuditLogs.Add(new AuditLog
        {
            UserId = actorId, Action = "order.send",
            ObjectType = "Order", ObjectId = order.Id.ToString(), Detail = $"{order.OrderNo} · {r.SendVia}",
        });
        await _db.SaveChangesAsync(ct);
        return OrderResult.Success(await GetTracked(order.Id, ct));
    }

    // ---- helpers ----
    private async Task<List<Sample>> BuildSamplesWithSidAsync(IEnumerable<string> rawTypes, CancellationToken ct)
    {
        var sampleTypes = rawTypes.Where(s => !string.IsNullOrEmpty(s)).Distinct().ToList();
        if (sampleTypes.Count == 0) sampleTypes.Add("—");
        var now = DateTime.Now;
        var endSid = await _seq.NextRangeAsync($"SID:{now:ddMMyy}", sampleTypes.Count, ct);
        var startSid = endSid - sampleTypes.Count + 1;
        var samples = new List<Sample>();
        for (int k = 0; k < sampleTypes.Count; k++)
            samples.Add(new Sample { Sid = $"{now:ddMMyy}-{(startSid + k):D4}", SampleType = sampleTypes[k] });
        return samples;
    }

    private Task<string?> ResultFileNameAsync(Guid orderId, CancellationToken ct) =>
        _db.TestResults.Where(r => r.OrderId == orderId).Select(r => (string?)r.FileName).FirstOrDefaultAsync(ct);

    private async Task<OrderDto> GetTracked(Guid orderId, CancellationToken ct)
    {
        var o = await _db.Orders.AsNoTracking()
            .Include(x => x.Items).Include(x => x.Samples)
            .FirstAsync(x => x.Id == orderId, ct);
        return Map(o, await ResultFileNameAsync(orderId, ct));
    }

    private async Task<Patient> ResolvePatientAsync(PatientInput p, string? email, CancellationToken ct)
    {
        var maBN = p.MaBN?.Trim();
        if (!string.IsNullOrEmpty(maBN))
        {
            var existing = await _db.Patients.FirstOrDefaultAsync(x => x.MaBN == maBN, ct);
            if (existing is not null) return existing;
        }
        else
        {
            var now = DateTime.Now;
            var seq = await _seq.NextRangeAsync($"MABN:{now:MMyy}", 1, ct);
            maBN = $"{now:MMyy}{seq:D4}";
        }

        var patient = new Patient
        {
            MaBN = maBN!,
            FullName = p.FullName.Trim(),
            Dob = p.Dob,
            Gender = p.Gender,
            Phone = p.Phone,
            Email = email,
            NationalId = p.NationalId,
            Bhyt = p.Bhyt,
            Address = p.Address,
            Note = p.Note,
        };
        _db.Patients.Add(patient);
        return patient;
    }

    private static OrderDto Map(Order o, string? resultFileName) => new(
        o.Id, o.OrderNo, o.Source.ToString(), o.Stage.ToString(),
        o.PatientName, o.PatientMaBN, o.Diagnosis, o.Note, o.Total, o.CreatedAt,
        o.Items.Select(i => new OrderItemDto(
            i.Id, i.LabTestId, i.TestCode, i.TestName, i.SampleType, i.Qty, i.UnitPrice)).ToList(),
        o.Samples.OrderBy(s => s.Sid).Select(s => new SampleDto(
            s.Id, s.Sid, s.SampleType, s.TubeType, s.Quality.ToString())).ToList(),
        resultFileName != null, resultFileName,
        new ProgressDto(
            o.CollectPlace, o.CollectBy, o.CollectAt,
            o.SendVia, o.TrackingNo, o.Shipper, o.SendAt,
            o.ReceivePlace, o.ReceiveBy, o.ReceiveAt, o.ExpectedResultAt));

    private static OrderFullDto MapFull(Order o, string? resultFileName) => new(
        o.Id, o.OrderNo, o.Source.ToString(), o.Stage.ToString(), (int)o.Stage < (int)OrderStage.Gathered,
        o.ClinicName, o.DoctorCode, o.Diagnosis, o.Note, o.Total, o.CreatedAt,
        new PatientDetailDto(
            o.Patient.Id, o.Patient.MaBN, o.Patient.FullName, o.Patient.Dob,
            o.Patient.Gender, o.Patient.Phone, o.Patient.Email, o.Patient.NationalId,
            o.Patient.Bhyt, o.Patient.Address, o.Patient.Note),
        o.Items.Select(i => new OrderItemDto(
            i.Id, i.LabTestId, i.TestCode, i.TestName, i.SampleType, i.Qty, i.UnitPrice)).ToList(),
        o.Samples.OrderBy(s => s.Sid).Select(s => new SampleDto(
            s.Id, s.Sid, s.SampleType, s.TubeType, s.Quality.ToString())).ToList(),
        o.Events.OrderBy(ev => ev.At).Select(ev => new OrderEventDto(
            ev.Step.ToString(), ev.ActorName, ev.At, ev.Note)).ToList(),
        resultFileName != null, resultFileName,
        new ProgressDto(
            o.CollectPlace, o.CollectBy, o.CollectAt,
            o.SendVia, o.TrackingNo, o.Shipper, o.SendAt,
            o.ReceivePlace, o.ReceiveBy, o.ReceiveAt, o.ExpectedResultAt));

    private async Task<string> ActorNameAsync(Guid userId, CancellationToken ct)
        => (await _db.Users.Where(u => u.Id == userId).Select(u => u.FullName).FirstOrDefaultAsync(ct)) ?? "";
}
