// The action log for the test record, saved with the draft and deleted by "Start over".
import type { RecordEvent } from "@/lib/flow/record";
import { kvGet, kvSet } from "./db";

const EVENTS_KEY = "events";
const LIMIT = 2000;

let queue: Promise<void> = Promise.resolve();

/** Appends one entry. Writes are queued so quick taps don't overwrite each other. */
export function logEvent(event: RecordEvent): void {
  queue = queue
    .then(async () => {
      const events = (await kvGet<RecordEvent[]>(EVENTS_KEY)) ?? [];
      // Typing sends one action per keystroke; keep only the latest of a run.
      if (event.action === "setText" && events[events.length - 1]?.action === "setText") events.pop();
      events.push(event);
      await kvSet(EVENTS_KEY, events.slice(-LIMIT));
    })
    .catch(() => {});
}

export async function loadEvents(): Promise<RecordEvent[]> {
  await queue;
  return (await kvGet<RecordEvent[]>(EVENTS_KEY).catch(() => undefined)) ?? [];
}
