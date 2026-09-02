namespace LabLink.Domain.Enums;

public enum OrderSource
{
    Doctor = 0,
    Retail = 1,
}

/// <summary>Tiến trình phiếu (README · stage). ordered → collected → sent → received → running → resulted.</summary>
public enum OrderStage
{
    Ordered = 0,
    Collected = 1,
    Sent = 2,
    Received = 3,
    Running = 4,
    Resulted = 5,
}

public enum SampleQuality
{
    Unset = 0,
    Pass = 1,
    Fail = 2,
}
