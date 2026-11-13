import { PhotoReport } from "@/lib/report";

/**
 * Writes a photos-screen error report to the server log (Vercel's runtime logs).
 * No invite code: photos are read before the consent screen, and the report holds no content.
 */
export async function POST(request: Request) {
  const text = await request.text().catch(() => "");
  if (text.length > 100_000) return new Response(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const report = PhotoReport.safeParse(body);
  if (!report.success) return new Response(null, { status: 400 });
  console.log(`[photo-report] ${JSON.stringify(report.data)}`);
  return new Response(null, { status: 204 });
}
