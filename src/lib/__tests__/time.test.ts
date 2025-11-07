import { getNextBirthday9AmUtc } from "../time";
import moment from "moment-timezone";

describe("getNextBirthday9AmUtc", () => {
  beforeEach(() => {
    // Mock current date to 2025-03-15 12:00:00 UTC for consistent testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-03-15T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should return next birthday at 9:00 AM in user's timezone when birthday hasn't occurred this year", () => {
    const birthday = "1990-06-15"; // June 15
    const timezone = "America/New_York";

    const result = getNextBirthday9AmUtc(birthday, timezone);

    // Expected: June 15, 2025 at 9:00 AM EST/EDT
    const expected = moment.tz("2025-06-15 09:00:00", timezone).toDate();

    expect(result).toEqual(expected);
  });

  it("should return next year's birthday when birthday has already passed this year", () => {
    const birthday = "1990-01-15"; // January 15 (already passed)
    const timezone = "America/New_York";

    const result = getNextBirthday9AmUtc(birthday, timezone);

    // Expected: January 15, 2026 at 9:00 AM EST
    const expected = moment.tz("2026-01-15 09:00:00", timezone).toDate();

    expect(result).toEqual(expected);
  });

  it("should handle different timezones correctly", () => {
    const birthday = "1990-06-15";
    const timezone = "Asia/Tokyo";

    const result = getNextBirthday9AmUtc(birthday, timezone);

    // Expected: June 15, 2025 at 9:00 AM JST
    const expected = moment.tz("2025-06-15 09:00:00", timezone).toDate();

    expect(result).toEqual(expected);
  });

  it("should handle leap year birthdays correctly", () => {
    const birthday = "1992-02-29"; // Leap year birthday
    const timezone = "America/Los_Angeles";

    const result = getNextBirthday9AmUtc(birthday, timezone);

    // In non-leap years, Feb 29 becomes Feb 28 or Mar 1 depending on moment's handling
    const expected = moment
      .tz(timezone)
      .month(1) // February (0-indexed)
      .date(29)
      .hour(9)
      .minute(0)
      .second(0)
      .millisecond(0);

    if (expected.isBefore(moment.tz(timezone))) {
      expected.add(1, "year");
    }

    expect(result).toEqual(expected.toDate());
  });

  it("should handle UTC timezone", () => {
    const birthday = "1990-12-25";
    const timezone = "UTC";

    const result = getNextBirthday9AmUtc(birthday, timezone);

    const expected = moment.tz("2025-12-25 09:00:00", "UTC").toDate();

    expect(result).toEqual(expected);
  });

  it("should handle timezones with DST transitions", () => {
    // Set time to before DST transition
    jest.setSystemTime(new Date("2025-02-15T12:00:00.000Z"));

    const birthday = "1990-07-04"; // During DST in US
    const timezone = "America/New_York";

    const result = getNextBirthday9AmUtc(birthday, timezone);

    // July 4, 2025 will be during DST (EDT), so 9:00 AM EDT = 13:00 UTC
    const expected = moment.tz("2025-07-04 09:00:00", timezone).toDate();

    expect(result).toEqual(expected);
    expect(result.getUTCHours()).toBe(13); // 9 AM EDT = 1 PM UTC
  });
});
