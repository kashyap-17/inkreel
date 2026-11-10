// Time hints: does a photo's time agree with "that morning" or "day two" in the writing?
import type { PartOfDay } from "@/lib/ai/schemas";
import { displayClock } from "@/lib/photos/format";
import type { PhotoMeta } from "@/lib/photos/types";

/** Added to a photo's score for each time hint it agrees with. Tuned in Milestone 0. */
export const TIME_BONUS = 0.03;

export function partOfDay(photo: PhotoMeta): Exclude<PartOfDay, "none"> {
  const hour = displayClock(photo).getUTCHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

const dayNumber = (photo: PhotoMeta) => Math.floor(displayClock(photo).getTime() / 86_400_000);

/** Day of the trip each photo was taken on (1 = the first photo's day), and how many days in all. */
export function tripDays(photos: PhotoMeta[]): { dayOf: (photo: PhotoMeta) => number; count: number } {
  if (photos.length === 0) return { dayOf: () => 1, count: 1 };
  const days = photos.map(dayNumber);
  const first = Math.min(...days);
  const last = Math.max(...days);
  return { dayOf: (photo) => dayNumber(photo) - first + 1, count: last - first + 1 };
}

/** The bonus for one photo against one sentence's hints. */
export function timeBonus(
  hint: { partOfDay: PartOfDay; day: number },
  photo: PhotoMeta,
  dayOf: (photo: PhotoMeta) => number,
): number {
  let bonus = 0;
  if (hint.partOfDay !== "none" && hint.partOfDay === partOfDay(photo)) bonus += TIME_BONUS;
  if (hint.day > 0 && hint.day === dayOf(photo)) bonus += TIME_BONUS;
  return bonus;
}
