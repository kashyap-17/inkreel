import type { PhotoMeta } from "./types";

const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

/**
 * The clock time to show for a photo: the time where it was taken when EXIF has it,
 * otherwise the file date in the viewer's time zone. Returned as a Date whose UTC fields
 * hold that clock time, so formatting never shifts it.
 */
export function displayClock(photo: PhotoMeta): Date {
  if (photo.localTime) return new Date(`${photo.localTime}Z`);
  const d = new Date(photo.takenAt);
  return new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()),
  );
}

export const formatDay = (photo: PhotoMeta) => DAY.format(displayClock(photo));
export const formatTime = (photo: PhotoMeta) => TIME.format(displayClock(photo));
