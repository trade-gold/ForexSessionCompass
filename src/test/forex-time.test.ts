import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatOffset,
  formatTime,
  getMarketWeekTransition,
  getOffsetMinutes,
  getSession,
  getSessionStatus,
  isDstActive,
  isForexWeekendClosed,
  isUsUkDstGap,
  isValidCalendarDate,
  isValidZone,
  overlapsOnUtcDate,
  sessionInterval,
  simulatedWeekday,
  zonedTimeToUtc,
} from "@/lib/forex-time";

describe("forex time engine", () => {
  it("IST offset is +5:30 year-round (no DST)", () => {
    expect(getOffsetMinutes(new Date("2026-01-15T00:00:00Z"), "Asia/Kolkata")).toBe(330);
    expect(formatOffset(330)).toBe("UTC+05:30");
    expect(isDstActive(new Date("2026-07-15T00:00:00Z"), "Asia/Kolkata")).toBe(false);
  });

  it("New York switches EST/EDT", () => {
    expect(getOffsetMinutes(new Date("2026-01-15T12:00:00Z"), "America/New_York")).toBe(-300);
    expect(getOffsetMinutes(new Date("2026-07-15T12:00:00Z"), "America/New_York")).toBe(-240);
    expect(isDstActive(new Date("2026-01-15T12:00:00Z"), "America/New_York")).toBe(false);
    expect(isDstActive(new Date("2026-07-15T12:00:00Z"), "America/New_York")).toBe(true);
  });

  it("London 08:00 in summer is 07:00 UTC, winter 08:00 UTC", () => {
    expect(zonedTimeToUtc(2026, 7, 15, 8, 0, "Europe/London").toISOString()).toBe(
      "2026-07-15T07:00:00.000Z",
    );
    expect(zonedTimeToUtc(2026, 1, 15, 8, 0, "Europe/London").toISOString()).toBe(
      "2026-01-15T08:00:00.000Z",
    );
  });

  it("Sydney DST (AEDT +11 in January, AEST +10 in July)", () => {
    expect(zonedTimeToUtc(2026, 1, 15, 7, 0, "Australia/Sydney").toISOString()).toBe(
      "2026-01-14T20:00:00.000Z",
    );
    expect(zonedTimeToUtc(2026, 7, 15, 7, 0, "Australia/Sydney").toISOString()).toBe(
      "2026-07-14T21:00:00.000Z",
    );
    expect(isDstActive(new Date("2026-01-15T00:00:00Z"), "Australia/Sydney")).toBe(true);
    expect(isDstActive(new Date("2026-07-15T00:00:00Z"), "Australia/Sydney")).toBe(false);
  });

  it("London open on Wednesday 10:00 UTC in July", () => {
    expect(getSessionStatus(getSession("london"), new Date("2026-07-15T10:00:00Z")).open).toBe(true);
    expect(getSessionStatus(getSession("tokyo"), new Date("2026-07-15T10:00:00Z")).open).toBe(false);
  });

  it("London/New York overlap in July is 12:00–16:00 UTC (4h / 240m)", () => {
    const o = overlapsOnUtcDate(getSession("london"), getSession("newyork"), 2026, 7, 15);
    expect(o).toHaveLength(1);
    expect(o[0]!.start.toISOString()).toBe("2026-07-15T12:00:00.000Z");
    expect(o[0]!.minutes).toBe(240);
    expect(isUsUkDstGap(new Date("2026-07-15T12:00:00Z"))).toBe(false);
  });

  it("handles different US and UK DST transition dates (5h / 300m overlap during March & October gaps)", () => {
    // March 18, 2026: US already in EDT (UTC-4), UK still in GMT (UTC+0)
    expect(isUsUkDstGap(new Date("2026-03-18T12:00:00Z"))).toBe(true);
    const marchOverlap = overlapsOnUtcDate(getSession("london"), getSession("newyork"), 2026, 3, 18);
    expect(marchOverlap).toHaveLength(1);
    expect(marchOverlap[0]!.start.toISOString()).toBe("2026-03-18T12:00:00.000Z");
    expect(marchOverlap[0]!.end.toISOString()).toBe("2026-03-18T17:00:00.000Z");
    expect(marchOverlap[0]!.minutes).toBe(300);

    // October 28, 2026: UK back in GMT (UTC+0 on Oct 25), US still in EDT (UTC-4 until Nov 1)
    expect(isUsUkDstGap(new Date("2026-10-28T12:00:00Z"))).toBe(true);
    const octOverlap = overlapsOnUtcDate(getSession("london"), getSession("newyork"), 2026, 10, 28);
    expect(octOverlap).toHaveLength(1);
    expect(octOverlap[0]!.start.toISOString()).toBe("2026-10-28T12:00:00.000Z");
    expect(octOverlap[0]!.end.toISOString()).toBe("2026-10-28T17:00:00.000Z");
    expect(octOverlap[0]!.minutes).toBe(300);

    // November 4, 2026: Both US (EST UTC-5) and UK (GMT UTC+0) in standard time -> 13:00-17:00 UTC (240m)
    expect(isUsUkDstGap(new Date("2026-11-04T12:00:00Z"))).toBe(false);
    const novOverlap = overlapsOnUtcDate(getSession("london"), getSession("newyork"), 2026, 11, 4);
    expect(novOverlap).toHaveLength(1);
    expect(novOverlap[0]!.start.toISOString()).toBe("2026-11-04T13:00:00.000Z");
    expect(novOverlap[0]!.end.toISOString()).toBe("2026-11-04T17:00:00.000Z");
    expect(novOverlap[0]!.minutes).toBe(240);
  });

  it("handles midnight crossover in sessionInterval", () => {
    const overnightSession = {
      id: "sydney" as const,
      name: "Overnight Test",
      city: "UTC",
      tz: "UTC",
      openHour: 22,
      closeHour: 6,
    };
    const iv = sessionInterval(overnightSession, 2026, 5, 10);
    expect(iv.start.toISOString()).toBe("2026-05-10T22:00:00.000Z");
    expect(iv.end.toISOString()).toBe("2026-05-11T06:00:00.000Z");
  });

  it("handles exact forex weekend closure boundaries and market reopen transitions", () => {
    // Friday 16:59 EDT (20:59 UTC) -> still open
    const friBeforeClose = new Date("2026-07-17T20:59:00Z");
    expect(isForexWeekendClosed(friBeforeClose)).toBe(false);
    expect(getMarketWeekTransition(friBeforeClose).nextTransition.toISOString()).toBe(
      "2026-07-17T21:00:00.000Z",
    );

    // Friday 17:00 EDT (21:00 UTC) -> closed for weekend
    const friAtClose = new Date("2026-07-17T21:00:00Z");
    expect(isForexWeekendClosed(friAtClose)).toBe(true);

    // Saturday 12:00 UTC -> closed, reopens Sunday 17:00 EDT (21:00 UTC)
    const satMid = new Date("2026-07-18T12:00:00Z");
    expect(isForexWeekendClosed(satMid)).toBe(true);
    expect(getMarketWeekTransition(satMid).nextTransition.toISOString()).toBe(
      "2026-07-19T21:00:00.000Z",
    );

    // Sunday 16:59 EDT (20:59 UTC) -> still closed
    expect(isForexWeekendClosed(new Date("2026-07-19T20:59:00Z"))).toBe(true);

    // Sunday 17:00 EDT (21:00 UTC) -> reopened!
    expect(isForexWeekendClosed(new Date("2026-07-19T21:00:00Z"))).toBe(false);
    expect(isForexWeekendClosed(new Date("2026-07-15T12:00:00Z"))).toBe(false);
  });

  it("handles invalid timezone inputs gracefully without throwing", () => {
    expect(isValidZone("Asia/Kolkata")).toBe(true);
    expect(isValidZone("Not/A_Real_Zone")).toBe(false);
    expect(isValidZone("")).toBe(false);
    expect(isValidZone(null)).toBe(false);
    const d = new Date("2026-07-15T14:30:00Z");
    expect(formatTime(d, "Not/A_Real_Zone", false, "24")).toBe("14:30");
  });

  it("formats durations, 12H/24H clocks, and simulated weekday overlap", () => {
    expect(formatDuration(3661000)).toBe("1h 01m 01s");
    expect(formatDuration(-5000)).toBe("0h 00m 00s");
    const sim = simulatedWeekday(new Date("2026-10-31T18:00:00Z"));
    expect(getSessionStatus(getSession("london"), sim).open).toBe(true);
    expect(getSessionStatus(getSession("newyork"), sim).open).toBe(true);
  });

  it("validates calendar dates strictly and rejects impossible rollover dates like Feb 30", () => {
    expect(isValidCalendarDate(2026, 2, 28)).toBe(true);
    expect(isValidCalendarDate(2024, 2, 29)).toBe(true);
    expect(isValidCalendarDate(2026, 2, 29)).toBe(false);
    expect(isValidCalendarDate(2026, 2, 31)).toBe(false);
    expect(isValidCalendarDate(2026, 13, 1)).toBe(false);
    expect(isValidCalendarDate(2026, 0, 10)).toBe(false);
    expect(overlapsOnUtcDate(getSession("london"), getSession("london"), 2026, 7, 15)).toHaveLength(0);
    expect(overlapsOnUtcDate(getSession("london"), getSession("newyork"), 2026, 2, 31)).toHaveLength(0);
  });

  it("verifies Tokyo non-DST year-round and Sydney April DST transition", () => {
    for (const m of [1, 3, 7, 10]) {
      expect(zonedTimeToUtc(2026, m, 15, 9, 0, "Asia/Tokyo").toISOString()).toBe(
        `2026-${String(m).padStart(2, "0")}-15T00:00:00.000Z`,
      );
    }
    expect(zonedTimeToUtc(2026, 4, 3, 7, 0, "Australia/Sydney").toISOString()).toBe(
      "2026-04-02T20:00:00.000Z",
    );
    expect(zonedTimeToUtc(2026, 4, 7, 7, 0, "Australia/Sydney").toISOString()).toBe(
      "2026-04-06T21:00:00.000Z",
    );
    expect(formatDuration(NaN)).toBe("0h 00m 00s");
  });
});
