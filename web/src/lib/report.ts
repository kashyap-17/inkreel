// Error reports from the photos screen, so problems on a phone can be read in the server log.
// Only the browser, file types, sizes and error messages: never photos or file names.
import { z } from "zod";

export const PhotoReport = z.object({
  userAgent: z.string().max(400),
  picked: z.number().int().min(0).max(100_000),
  added: z.number().int().min(0).max(100_000),
  error: z.string().max(500).optional(),
  failures: z
    .array(
      z.object({
        type: z.string().max(60),
        format: z.string().max(10),
        sizeMB: z.number().min(0).max(10_000),
        reason: z.string().max(1000),
      }),
    )
    .max(60),
});
export type PhotoReport = z.infer<typeof PhotoReport>;

/** Sends a report without waiting; a failed send is ignored. */
export function sendPhotoReport(report: Omit<PhotoReport, "userAgent">): void {
  const body: PhotoReport = {
    ...report,
    userAgent: navigator.userAgent.slice(0, 400),
    failures: report.failures.slice(0, 60),
  };
  void fetch("/api/report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
}
