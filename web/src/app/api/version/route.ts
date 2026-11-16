import { BUILD_ID } from "@/config/build";

/** Which build the server runs, so an open page with older code can reload itself. */
export async function GET() {
  return Response.json({ build: BUILD_ID }, { headers: { "cache-control": "no-store" } });
}
