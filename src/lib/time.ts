import moment from "moment-timezone";

/**
 * Calculates the exact UTC Date object for the user's *next*
 * birthday at 9:00 AM in their local timezone.
 *
 * @param birthday string The user's birthday in 'YYYY-MM-DD' format
 * @param timezone string The user's IANA timezone (e.g., 'America/New_York')
 * @returns A Date object representing the next 9am in UTC
 */
export function getNextBirthday9AmUtc(
  birthday: string,
  timezone: string
): Date {
  const nowInUserTz = moment.tz(timezone);

  const birthdayThisYear = nowInUserTz
    .clone()
    .month(moment(birthday).month())
    .date(moment(birthday).date())
    .hour(9)
    .minute(0)
    .second(0)
    .millisecond(0);

  if (birthdayThisYear.isBefore(nowInUserTz)) {
    birthdayThisYear.add(1, "year");
  }

  return birthdayThisYear.toDate();
}
