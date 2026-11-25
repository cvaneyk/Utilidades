import {
  validateCron,
  getNextExecutions,
  decomposeFieldForBuilder,
  buildFieldToken,
  CRON_EXAMPLES_5,
  CRON_EXAMPLES_6,
} from "./cronUtils";

describe("cronUtils - validateCron", () => {
  test("validates all built-in 5-field examples", () => {
    for (const ex of CRON_EXAMPLES_5) {
      const res = validateCron(ex.expression, false);
      expect(res.valid).toBe(true);
      expect(res.description.length).toBeGreaterThan(0);
    }
  });

  test("validates all built-in 6-field examples", () => {
    for (const ex of CRON_EXAMPLES_6) {
      const res = validateCron(ex.expression, true);
      expect(res.valid).toBe(true);
      expect(res.description.length).toBeGreaterThan(0);
    }
  });

  test("supports named months, named days of week, and Sunday=7", () => {
    const res1 = validateCron("0 9 * JAN-MAR MON-FRI", false);
    expect(res1.valid).toBe(true);
    expect(res1.fieldsMap.month.values).toEqual([1, 2, 3]);
    expect(res1.fieldsMap.dayOfWeek.values).toEqual([1, 2, 3, 4, 5]);

    const res2 = validateCron("0 12 * * 5-7", false);
    expect(res2.valid).toBe(true);
    expect(res2.fieldsMap.dayOfWeek.values).toEqual([0, 5, 6]);

    const res3 = validateCron("0 12 * * FRI-SUN", false);
    expect(res3.valid).toBe(true);
    expect(res3.fieldsMap.dayOfWeek.values).toEqual([0, 5, 6]);
  });

  test("supports @aliases including @reboot", () => {
    expect(validateCron("@daily", false).valid).toBe(true);
    expect(validateCron("@hourly", false).valid).toBe(true);
    expect(validateCron("@weekly", false).valid).toBe(true);
    expect(validateCron("@monthly", false).valid).toBe(true);
    expect(validateCron("@yearly", false).valid).toBe(true);
    const reboot = validateCron("@reboot", false);
    expect(reboot.valid).toBe(true);
    expect(reboot.isReboot).toBe(true);
    expect(getNextExecutions(reboot, 5)).toEqual([]);
  });

  test("rejects invalid expressions with clear errors and mode hints", () => {
    expect(validateCron("", false).valid).toBe(false);
    expect(validateCron("* * *", false).valid).toBe(false);
    expect(validateCron("60 * * * *", false).valid).toBe(false);
    expect(validateCron("* 24 * * *", false).valid).toBe(false);
    expect(validateCron("* * 0 * *", false).valid).toBe(false);
    expect(validateCron("* * 32 * *", false).valid).toBe(false);
    expect(validateCron("* * * 13 *", false).valid).toBe(false);
    expect(validateCron("* * * * 8", false).valid).toBe(false);
    expect(validateCron("*/0 * * * *", false).valid).toBe(false);
    expect(validateCron("10-5 * * * *", false).valid).toBe(false);
    expect(validateCron("1,,2 * * * *", false).valid).toBe(false);
    expect(validateCron("@unknown", false).valid).toBe(false);

    const sixInFive = validateCron("*/10 * * * * *", false);
    expect(sixInFive.valid).toBe(false);
    expect(sixInFive.suggestedMode).toBe("six");

    const fiveInSix = validateCron("*/5 * * * *", true);
    expect(fiveInSix.valid).toBe(false);
    expect(fiveInSix.suggestedMode).toBe("five");
  });
});

describe("cronUtils - getNextExecutions", () => {
  test("computes next runs for every 15 minutes", () => {
    const parsed = validateCron("*/15 * * * *", false);
    const base = new Date(2026, 0, 1, 10, 7, 30);
    const runs = getNextExecutions(parsed, 4, base);
    expect(runs).toHaveLength(4);
    expect(runs.map((d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`)).toEqual([
      "10:15",
      "10:30",
      "10:45",
      "11:00",
    ]);
  });

  test("handles leap year Feb 29 without stalling", () => {
    const parsed = validateCron("0 0 29 2 *", false);
    const base = new Date(2025, 0, 1, 0, 0, 0);
    const runs = getNextExecutions(parsed, 2, base);
    expect(runs).toHaveLength(2);
    expect(runs[0].getFullYear()).toBe(2028);
    expect(runs[0].getMonth()).toBe(1);
    expect(runs[0].getDate()).toBe(29);
    expect(runs[1].getFullYear()).toBe(2032);
  });

  test("returns empty list for impossible calendar date Feb 31", () => {
    const parsed = validateCron("0 0 31 2 *", false);
    expect(parsed.valid).toBe(true);
    const runs = getNextExecutions(parsed, 5, new Date(2026, 0, 1));
    expect(runs).toEqual([]);
  });

  test("uses OR semantics when both day-of-month and day-of-week are restricted", () => {
    // 15th of month OR Monday at 09:00
    const parsed = validateCron("0 9 15 * 1", false);
    expect(parsed.bothDayFieldsRestricted).toBe(true);
    // Jan 12, 2026 is a Monday; Jan 15, 2026 is a Thursday
    const runs = getNextExecutions(parsed, 2, new Date(2026, 0, 11, 12, 0, 0));
    expect(runs[0].getDate()).toBe(12); // Monday
    expect(runs[1].getDate()).toBe(15); // 15th
  });

  test("computes 6-field executions with seconds", () => {
    const parsed = validateCron("*/20 * * * * *", true);
    const base = new Date(2026, 0, 1, 10, 0, 5);
    const runs = getNextExecutions(parsed, 3, base);
    expect(runs.map((d) => `${d.getMinutes()}:${String(d.getSeconds()).padStart(2, "0")}`)).toEqual([
      "0:20",
      "0:40",
      "1:00",
    ]);
  });
});

describe("cronUtils - builder helpers", () => {
  test("decomposes and rebuilds field tokens", () => {
    expect(buildFieldToken(decomposeFieldForBuilder("*", "minute"), "minute")).toBe("*");
    expect(buildFieldToken(decomposeFieldForBuilder("*/15", "minute"), "minute")).toBe("*/15");
    expect(buildFieldToken(decomposeFieldForBuilder("5/15", "minute"), "minute")).toBe("5/15");
    expect(buildFieldToken(decomposeFieldForBuilder("1-5", "dayOfWeek"), "dayOfWeek")).toBe("1-5");
    expect(buildFieldToken(decomposeFieldForBuilder("0,15,30,45", "minute"), "minute")).toBe("0,15,30,45");
  });
});
