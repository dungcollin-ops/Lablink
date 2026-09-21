using System.Text.RegularExpressions;
using LabLink.Application.Orders;
using LabLink.Application.Storage;
using LabLink.Domain.Entities;
using LabLink.Infrastructure.Deals;
using LabLink.Domain.Enums;
using LabLink.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace LabLink.Infrastructure.Orders;

public partial class OrderService : IOrderService
{
    private readonly AppDbContext _db;
    private readonly ISequenceService _seq;
    private readonly IFileStorage _files;

    public OrderService(AppDbContext db, ISequenceService seq, IFileStorage files)
    {
        _db = db;
        _seq = seq;
        _files = files;
    }

    [GeneratedRegex(@"^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$")]
    private static partial Regex EmailRegex();

    [GeneratedRegex(@"^(\d{4})(-(\d{2})(-(\d{2}))?)?$")]
    private static partial Regex DobRegex();

    /// <summary>Chuẩn hoá ngày sinh partial: chấp nhận "yyyy" | "yyyy-MM" | "yyyy-MM-dd".
    /// Năm bắt buộc (1900..nay); ngày/tháng nếu có phải hợp lệ. Trả null nếu trống/không hợp lệ.</summary>
    private static string? NormalizeDob(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var s = raw.Trim();
        var m = DobRegex().Match(s);
        if (!m.Success) return null;
        var year = int.Parse(m.Groups[1].Value);
        if (year < 1900 || year > DateTime.Now.Year) return null;
        if (m.Groups[3].Success)
        {
            var mo = int.Parse(m.Groups[3].Value);
            if (mo is < 1 or > 12) return null;
            if (m.Groups[5].Success)
            {
                var d = int.Parse(m.Groups[5].Value);
                if (d is < 1 or > 31) return null;
            }
        }
        return s;
    }

    public async Task<OrderResult> CreateAsync(Guid userId, CreateOrderRequest req, CancellationToken ct = default)
    {
        var source = req.Source?.Trim().ToLowerInvariant() == "retail"
            ? OrderSource.Retail : OrderSource.Doctor;

        // ---- Validate ----
        if (req.Patient is null || string.IsNullOrWhiteSpace(req.Patient.FullName))
            return OrderResult.Fail("Thiếu họ tên bệnh nhân.");
        if (NormalizeDob(req.Patient.Dob) is null)
            return OrderResult.Fail("Cần nhập năm sinh (gõ đủ dd/mm/yyyy, hoặc chỉ năm yyyy).");
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

        // ---- Phòng ban đặt phiếu (lấy từ NV của người tạo) + bác sĩ chỉ định ----
        var creator = await _db.Users.Where(u => u.Id == userId)
            .Select(u => new { u.EmployeeId, DeptId = u.Employee != null ? (Guid?)u.Employee.DepartmentId : null })
            .FirstOrDefaultAsync(ct);
        var departmentId = creator?.DeptId;
        Guid? doctorId = req.DoctorId;
        if (doctorId is Guid did)
        {
            var emp = await _db.Employees.FirstOrDefaultAsync(e => e.Id == did, ct);
            if (emp is null) return OrderResult.Fail("Bác sĩ chỉ định không hợp lệ.");
            departmentId ??= emp.DepartmentId; // người tạo chưa gắn phòng → theo phòng của bác sĩ
        }
        else if (source == OrderSource.Doctor && creator?.EmployeeId is Guid ceid)
        {
            doctorId = ceid; // bác sĩ tự chỉ định
        }

        // ---- Giá chốt (deal) — theo PHÒNG KHÁM của phiếu; "quyết định mới nhất thắng" (huỷ → về niêm yết) ----
        var dealPrices = source == OrderSource.Doctor
            ? await DealService.EffectivePricesAsync(_db, departmentId, userId, ids, ct)
            : new Dictionary<Guid, long>();

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
            DepartmentId = departmentId,
            DoctorId = doctorId,
            Total = total,
            EtaMinHours = ids.Select(id => tests[id]).Max(t => t.TatMinHours),
            EtaMaxHours = ids.Select(id => tests[id]).Max(t => t.TatMaxHours),
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
        if (!seeAll)
        {
            // Có phòng ban → thấy phiếu của phòng + phiếu mình tạo (gồm phiếu cũ chưa có phòng);
            // không có phòng (khách lẻ) → chỉ phiếu mình tạo.
            var deptId = await UserDeptAsync(userId, ct);
            q = deptId != null
                ? q.Where(o => o.DepartmentId == deptId || o.CreatedById == userId)
                : q.Where(o => o.CreatedById == userId);
        }

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

        var rows = await q.OrderByDescending(o => o.CreatedAt)
            .Select(o => new
            {
                o.Id, o.OrderNo, o.Source, o.Stage, o.PatientName, o.PatientMaBN,
                ItemCount = o.Items.Count, o.Total, o.CreatedAt,
                HasResult = o.Result != null,
                ResultAt = o.Result != null ? (DateTimeOffset?)o.Result.UploadedAt : null,
                DeptName = o.Department != null ? o.Department.Name : null,
                o.ReceiveAt, o.EtaMinHours, o.EtaMaxHours,
                o.CollectAt, o.GatherAt,
            })
            .ToListAsync(ct);

        return rows.Select(o =>
        {
            // Mốc bắt đầu tính ETA: khi đã nhận mẫu thì từ ReceiveAt (chính xác); chưa thì tạm tính từ lúc chỉ định.
            var anchor = o.ReceiveAt ?? o.CreatedAt;
            DateTimeOffset? minAt = o.EtaMinHours is int mn ? AddWorkingHours(anchor, mn) : null;
            DateTimeOffset? maxAt = o.EtaMaxHours is int mx ? AddWorkingHours(anchor, mx) : null;
            return new OrderListItemDto(
                o.Id, o.OrderNo, o.Source.ToString(), o.Stage.ToString(),
                o.PatientName, o.PatientMaBN, o.ItemCount, o.Total, o.CreatedAt,
                o.HasResult, o.DeptName, minAt, maxAt, o.ResultAt,
                o.CollectAt, o.GatherAt);
        }).ToList();
    }

    public async Task<OrderDto?> GetAsync(Guid id, Guid userId, bool seeAll, CancellationToken ct = default)
    {
        var o = await _db.Orders.AsNoTracking()
            .Include(x => x.Items)
            .Include(x => x.Samples)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o is null) return null;
        if (!await InScopeAsync(userId, seeAll, o.CreatedById, o.DepartmentId, ct)) return null;
        return Map(o, await ResultFileNameAsync(o.Id, ct));
    }

    public async Task<OrderFullDto?> GetFullAsync(Guid id, Guid userId, bool seeAll, CancellationToken ct = default)
    {
        var o = await _db.Orders.AsNoTracking()
            .Include(x => x.Items)
            .Include(x => x.Samples)
            .Include(x => x.Patient)
            .Include(x => x.Events)
            .Include(x => x.Department)
            .Include(x => x.Doctor)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o is null) return null;
        if (!await InScopeAsync(userId, seeAll, o.CreatedById, o.DepartmentId, ct)) return null;
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
        if (!await InScopeAsync(userId, seeAll, order.CreatedById, order.DepartmentId, ct))
            return OrderResult.Fail("Không có quyền trên phiếu này.");
        if ((int)order.Stage >= (int)OrderStage.Gathered)
            return OrderResult.Fail("Phiếu đã chuyển cho phòng xét nghiệm — không sửa được nữa.");

        // ---- Validate ----
        if (req.Patient is null || string.IsNullOrWhiteSpace(req.Patient.FullName))
            return OrderResult.Fail("Thiếu họ tên bệnh nhân.");
        if (NormalizeDob(req.Patient.Dob) is null)
            return OrderResult.Fail("Cần nhập năm sinh (gõ đủ dd/mm/yyyy, hoặc chỉ năm yyyy).");
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
        var dealPrices = order.Source == OrderSource.Doctor
            ? await DealService.EffectivePricesAsync(_db, order.DepartmentId, order.CreatedById, ids, ct)
            : new Dictionary<Guid, long>();

        // ---- Cập nhật hồ sơ bệnh nhân (DANH MỤC BN) + snapshot trên phiếu ----
        var p = order.Patient;
        p.FullName = req.Patient.FullName.Trim();
        p.Dob = NormalizeDob(req.Patient.Dob);
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
        if (req.DoctorId is Guid did2)
        {
            if (!await _db.Employees.AnyAsync(e => e.Id == did2, ct))
                return OrderResult.Fail("Bác sĩ chỉ định không hợp lệ.");
            order.DoctorId = did2;
        }
        else order.DoctorId = null;

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
        order.EtaMinHours = ids.Select(id => tests[id]).Max(t => t.TatMinHours);
        order.EtaMaxHours = ids.Select(id => tests[id]).Max(t => t.TatMaxHours);

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
        var order = await _db.Orders.Include(o => o.Department).Include(o => o.Samples).FirstOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null) return OrderResult.Fail("Không tìm thấy phiếu.");

        var who = string.IsNullOrWhiteSpace(by) ? null : by.Trim();
        var actorName = await ActorNameAsync(actorId, ct);
        var now = DateTimeOffset.UtcNow;

        async Task Finish(OrderStage eventStep, string? note, string detail)
        {
            order.UpdatedAt = now;
            _db.OrderEvents.Add(new OrderEvent { OrderId = order.Id, Step = eventStep, ActorId = actorId, ActorName = actorName, At = now, Note = note });
            _db.AuditLogs.Add(new AuditLog { UserId = actorId, Action = "order.stage", ObjectType = "Order", ObjectId = order.Id.ToString(), Detail = detail });
            await _db.SaveChangesAsync(ct);
        }

        switch (stage)
        {
            // ---- Giai đoạn đầu (Ordered): 3 xác nhận, Nhận-đi-gom & Đã-lấy chạy song song ----
            case "GatherClaim": // NV gom: "Nhận đi gom mẫu" (báo đang xử lý; không cần lấy mẫu trước)
                if (order.Stage != OrderStage.Ordered) return OrderResult.Fail("Chỉ nhận đi gom ở giai đoạn đầu.");
                if (order.GatherClaimAt != null) return OrderResult.Fail("Đã có người nhận đi gom mẫu.");
                order.GatherClaimBy = who ?? actorName; order.GatherClaimAt = now;
                await Finish(OrderStage.Ordered, $"Nhận đi gom mẫu: {order.GatherClaimBy}", $"{order.OrderNo} · nhận đi gom");
                break;

            case "Collected": // Điều dưỡng: "Đã lấy mẫu"
                if (order.Stage != OrderStage.Ordered) return OrderResult.Fail("Phiếu đã qua giai đoạn lấy mẫu.");
                if (order.CollectAt != null) return OrderResult.Fail("Đã lấy mẫu rồi.");
                order.CollectBy = who ?? actorName; order.CollectAt = now;
                await Finish(OrderStage.Collected, who != null ? $"Người lấy: {who}" : null, $"{order.OrderNo} · đã lấy mẫu");
                break;

            case "Gathered": // NV gom: "Đã gom mẫu" (nhận mẫu từ điều dưỡng) — CẦN đã lấy mẫu
                // Bác sĩ: từ Ordered (đã có cờ lấy mẫu). Khách lẻ: từ Collected (AssignCollect đã set).
                if (order.Stage != OrderStage.Ordered && order.Stage != OrderStage.Collected)
                    return OrderResult.Fail("Phiếu không ở giai đoạn gom mẫu.");
                if (order.CollectAt == null) return OrderResult.Fail("Chưa lấy mẫu — chưa gom được (điều dưỡng cần bấm \"Đã lấy mẫu\" trước).");
                order.GatherBy = who ?? actorName; order.GatherAt = now;
                order.Stage = OrderStage.Gathered; // đã lấy + gom → sẵn sàng nhận
                await Finish(OrderStage.Gathered, who != null ? $"Người gom: {who}" : null, $"{order.OrderNo} → Đã gom mẫu");
                break;

            case "Received": // KTV FastLab: "Nhận mẫu"
                if (order.Stage != OrderStage.Gathered) return OrderResult.Fail("Phiếu chưa gom xong — chưa nhận được.");
                order.ReceiveAt = now;
                if (who != null) order.ReceiveBy = who;
                // ETA "trả KQ" tính từ lúc nhận mẫu, theo giờ làm việc (bỏ khung nghỉ 21:30–06:30).
                if (order.EtaMaxHours is int mx && mx > 0) order.ExpectedResultAt = AddWorkingHours(now, mx);
                order.Stage = OrderStage.Received;
                // Nhận mẫu ⇒ mẫu Đạt luôn (mẫu chưa đánh giá). Mẫu không đạt đã bị từ chối trước đó.
                foreach (var sm in order.Samples.Where(s => s.Quality == SampleQuality.Unset))
                    sm.Quality = SampleQuality.Pass;
                await Finish(OrderStage.Received, who != null ? $"Người nhận: {who}" : null, $"{order.OrderNo} → Nhận mẫu");
                break;

            case "HardCopySent":
            case "HardCopyReceived":
                if (!(order.Department?.HardCopyRequired ?? false))
                    return OrderResult.Fail("Phòng khám không nhận bản cứng — phiếu hoàn tất ở bước Trả kết quả.");
                var hc = stage == "HardCopySent" ? OrderStage.HardCopySent : OrderStage.HardCopyReceived;
                order.Stage = hc;
                await Finish(hc, who != null ? $"Người thực hiện: {who}" : null, $"{order.OrderNo} → {hc}");
                break;

            case "Resulted":
                return OrderResult.Fail("Chỉ chuyển sang \"Có kết quả\" bằng cách tải file kết quả lên.");

            default:
                return OrderResult.Fail("Trạng thái không hợp lệ.");
        }

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

        // Đánh giá chất lượng ⇒ mẫu đã về tay KTV → tự động "Nhận mẫu" nếu phiếu mới ở bước Đã gom.
        var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == sample.OrderId, ct);
        if (order is not null && order.Stage == OrderStage.Gathered)
        {
            var now = DateTimeOffset.UtcNow;
            var actorName = await ActorNameAsync(actorId, ct);
            order.ReceiveAt = now;
            order.ReceiveBy ??= actorName;
            if (order.EtaMaxHours is int mx && mx > 0) order.ExpectedResultAt = AddWorkingHours(now, mx);
            order.Stage = OrderStage.Received;
            order.UpdatedAt = now;
            _db.OrderEvents.Add(new OrderEvent
            {
                OrderId = order.Id, Step = OrderStage.Received, ActorId = actorId, ActorName = actorName,
                At = now, Note = "Tự nhận mẫu khi đánh giá chất lượng",
            });
            _db.AuditLogs.Add(new AuditLog
            {
                UserId = actorId, Action = "order.receive",
                ObjectType = "Order", ObjectId = order.Id.ToString(), Detail = $"{order.OrderNo} → Nhận mẫu (qua QC)",
            });
        }

        await _db.SaveChangesAsync(ct);
        return OrderResult.Success(await GetTracked(sample.OrderId, ct));
    }

    public async Task<OrderResult> RejectSampleAsync(
        Guid sampleId, string reason, string? fileName, string? contentType, byte[]? content, Guid actorId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(reason)) return OrderResult.Fail("Cần nhập lý do không đạt.");
        var sample = await _db.Samples.FirstOrDefaultAsync(s => s.Id == sampleId, ct);
        if (sample is null) return OrderResult.Fail("Không tìm thấy mẫu.");
        var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == sample.OrderId, ct);
        if (order is null) return OrderResult.Fail("Không tìm thấy phiếu.");

        var now = DateTimeOffset.UtcNow;
        var actorName = await ActorNameAsync(actorId, ct);

        sample.Quality = SampleQuality.Fail;
        sample.QcReason = reason.Trim();
        sample.QcRejectedBy = actorName;
        sample.QcRejectedAt = now;
        if (content is { Length: > 0 })
        {
            if (sample.QcEvidenceKey is { } oldKey) _files.Delete(oldKey);
            sample.QcEvidenceKey = await _files.SaveAsync("qc", sample.Sid, fileName ?? "bangchung", content, ct);
            sample.QcEvidence = null;
            sample.QcEvidenceType = contentType;
            sample.QcEvidenceName = fileName;
        }

        // Quay lại "chờ lấy mẫu": reset 3 xác nhận (nhận-đi-gom / đã-lấy / đã-gom) + mốc nhận.
        order.GatherClaimBy = null; order.GatherClaimAt = null;
        order.CollectBy = null; order.CollectAt = null;
        order.GatherBy = null; order.GatherAt = null;
        order.ReceiveBy = null; order.ReceiveAt = null;
        order.ExpectedResultAt = null;
        sample.CollectedBy = null; sample.CollectedAt = null;
        sample.ReceivedBy = null; sample.ReceivedAt = null;
        order.Stage = OrderStage.Ordered;
        order.UpdatedAt = now;

        _db.OrderEvents.Add(new OrderEvent
        {
            OrderId = order.Id, Step = OrderStage.Ordered, ActorId = actorId, ActorName = actorName,
            At = now, Note = $"Mẫu KHÔNG đạt — lấy lại. Lý do: {reason.Trim()}",
        });
        _db.AuditLogs.Add(new AuditLog
        {
            UserId = actorId, Action = "sample.reject",
            ObjectType = "Sample", ObjectId = sample.Id.ToString(), Detail = $"{sample.Sid} · {reason.Trim()}",
        });

        await _db.SaveChangesAsync(ct);
        return OrderResult.Success(await GetTracked(order.Id, ct));
    }

    public async Task<ResultFile?> GetQcEvidenceAsync(Guid sampleId, CancellationToken ct = default)
    {
        var s = await _db.Samples.FirstOrDefaultAsync(x => x.Id == sampleId, ct);
        if (s is null) return null;
        var bytes = s.QcEvidenceKey is { } key ? await _files.ReadAsync(key, ct) : s.QcEvidence;
        if (bytes is null || bytes.Length == 0) return null;
        return new ResultFile(s.QcEvidenceName ?? "bangchung", s.QcEvidenceType ?? "application/octet-stream", bytes);
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
        // Lưu file ra đĩa VPS; xoá file cũ nếu cập nhật; không giữ bytea nữa.
        if (order.Result.StorageKey is { } oldKey) _files.Delete(oldKey);
        order.Result.StorageKey = await _files.SaveAsync("results", order.OrderNo, fileName, content, ct);
        order.Result.Content = null;
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
        if (!await InScopeAsync(userId, seeAll, order.CreatedById, order.DepartmentId, ct)) return null;

        _db.AuditLogs.Add(new AuditLog
        {
            UserId = userId, Action = "result.download",
            ObjectType = "Order", ObjectId = order.Id.ToString(), Detail = order.Result.FileName,
        });
        await _db.SaveChangesAsync(ct);

        var bytes = order.Result.StorageKey is { } key
            ? await _files.ReadAsync(key, ct)
            : order.Result.Content;   // fallback dữ liệu cũ (bytea)
        if (bytes is null) return null;
        return new ResultFile(order.Result.FileName, order.Result.ContentType, bytes);
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
            Dob = NormalizeDob(p.Dob),
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
        o.EtaMinHours, o.EtaMaxHours,
        o.Items.Select(i => new OrderItemDto(
            i.Id, i.LabTestId, i.TestCode, i.TestName, i.SampleType, i.Qty, i.UnitPrice)).ToList(),
        o.Samples.OrderBy(s => s.Sid).Select(s => new SampleDto(
            s.Id, s.Sid, s.SampleType, s.TubeType, s.Quality.ToString(),
            s.QcReason, s.QcRejectedAt, s.QcEvidence != null || s.QcEvidenceKey != null)).ToList(),
        resultFileName != null, resultFileName,
        new ProgressDto(
            o.CollectPlace, o.CollectBy, o.CollectAt,
            o.SendVia, o.TrackingNo, o.Shipper, o.SendAt,
            o.ReceivePlace, o.ReceiveBy, o.ReceiveAt, o.ExpectedResultAt,
            o.GatherClaimBy, o.GatherClaimAt, o.GatherBy, o.GatherAt));

    private static OrderFullDto MapFull(Order o, string? resultFileName) => new(
        o.Id, o.OrderNo, o.Source.ToString(), o.Stage.ToString(), (int)o.Stage < (int)OrderStage.Gathered,
        o.ClinicName, o.DoctorCode, o.Diagnosis, o.Note, o.Total, o.CreatedAt,
        o.EtaMinHours, o.EtaMaxHours,
        new PatientDetailDto(
            o.Patient.Id, o.Patient.MaBN, o.Patient.FullName, o.Patient.Dob,
            o.Patient.Gender, o.Patient.Phone, o.Patient.Email, o.Patient.NationalId,
            o.Patient.Bhyt, o.Patient.Address, o.Patient.Note),
        o.Items.Select(i => new OrderItemDto(
            i.Id, i.LabTestId, i.TestCode, i.TestName, i.SampleType, i.Qty, i.UnitPrice)).ToList(),
        o.Samples.OrderBy(s => s.Sid).Select(s => new SampleDto(
            s.Id, s.Sid, s.SampleType, s.TubeType, s.Quality.ToString(),
            s.QcReason, s.QcRejectedAt, s.QcEvidence != null || s.QcEvidenceKey != null)).ToList(),
        o.Events.OrderBy(ev => ev.At).Select(ev => new OrderEventDto(
            ev.Step.ToString(), ev.ActorName, ev.At, ev.Note)).ToList(),
        resultFileName != null, resultFileName,
        new ProgressDto(
            o.CollectPlace, o.CollectBy, o.CollectAt,
            o.SendVia, o.TrackingNo, o.Shipper, o.SendAt,
            o.ReceivePlace, o.ReceiveBy, o.ReceiveAt, o.ExpectedResultAt,
            o.GatherClaimBy, o.GatherClaimAt, o.GatherBy, o.GatherAt),
        o.DepartmentId, o.Department?.Name,
        o.DoctorId, o.Doctor?.FullName,
        o.Department?.HardCopyRequired ?? false);

    private async Task<string> ActorNameAsync(Guid userId, CancellationToken ct)
        => (await _db.Users.Where(u => u.Id == userId).Select(u => u.FullName).FirstOrDefaultAsync(ct)) ?? "";

    /// <summary>Phòng ban của user (qua NV gắn kèm); null nếu chưa gắn (vd khách lẻ).</summary>
    private Task<Guid?> UserDeptAsync(Guid userId, CancellationToken ct) =>
        _db.Users.Where(u => u.Id == userId)
            .Select(u => u.Employee != null ? (Guid?)u.Employee.DepartmentId : null)
            .FirstOrDefaultAsync(ct);

    /// <summary>Phiếu có nằm trong phạm vi user không: seeAll → mọi phiếu;
    /// có phòng ban → phiếu cùng phòng; không có → chỉ phiếu mình tạo.</summary>
    private async Task<bool> InScopeAsync(Guid userId, bool seeAll, Guid createdById, Guid? orderDeptId, CancellationToken ct)
    {
        if (seeAll) return true;
        var dept = await UserDeptAsync(userId, ct);
        // Phòng khám: phiếu cùng phòng HOẶC phiếu mình tạo (gồm phiếu cũ chưa có phòng).
        return dept != null ? (orderDeptId == dept || createdById == userId) : createdById == userId;
    }

    // Giờ làm việc PXN theo giờ VN; khung nghỉ 21:30–06:30 hôm sau KHÔNG tính vào ETA.
    private static readonly TimeSpan WorkOpen = new(6, 30, 0);
    private static readonly TimeSpan WorkClose = new(21, 30, 0);
    private static readonly TimeSpan VnOffset = TimeSpan.FromHours(7);

    /// <summary>Cộng <paramref name="hours"/> GIỜ LÀM VIỆC vào mốc bắt đầu, bỏ qua khung nghỉ.</summary>
    private static DateTimeOffset AddWorkingHours(DateTimeOffset fromUtc, int hours)
    {
        var cur = fromUtc.ToOffset(VnOffset);
        var remaining = TimeSpan.FromHours(hours);
        var guard = 0;
        while (remaining > TimeSpan.Zero && guard++ < 500)
        {
            var day = cur.Date; // Kind = Unspecified → hợp lệ cho DateTimeOffset(offset)
            var open = new DateTimeOffset(day + WorkOpen, VnOffset);
            var close = new DateTimeOffset(day + WorkClose, VnOffset);
            if (cur < open) { cur = open; }
            else if (cur >= close) { cur = new DateTimeOffset(day.AddDays(1) + WorkOpen, VnOffset); continue; }
            var avail = close - cur;
            if (remaining <= avail) { cur = cur.Add(remaining); break; }
            remaining -= avail;
            cur = new DateTimeOffset(day.AddDays(1) + WorkOpen, VnOffset);
        }
        return cur.ToUniversalTime();
    }
}
