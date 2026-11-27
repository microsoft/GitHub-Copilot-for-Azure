# Timer Trigger — Go

```go
func onTick(ctx context.Context, t bindings.TimerInfo) error {
    // t.IsPastDue, t.ScheduleStatus.Last, t.ScheduleStatus.Next
    return nil
}

app.Timer("scheduledTask", onTick,
    sdk.WithSchedule("0 */5 * * * *"),
)
```
