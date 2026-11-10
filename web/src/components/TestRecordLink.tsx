"use client";

import { useState } from "react";
import { APP_NAME } from "@/config/app";
import type { FlowState } from "@/lib/flow/flow";
import { buildTestRecord } from "@/lib/flow/record";
import { savedSearches } from "@/lib/match/run";
import { loadEvents } from "@/lib/store/events";

/** Saves a file with what Inkreel did on this trip and what was changed, to send with feedback. */
export function TestRecordLink({ state }: { state: FlowState }) {
  const [saved, setSaved] = useState(false);

  async function download() {
    const now = new Date();
    const record = buildTestRecord(state, { searches: await savedSearches(state), events: await loadEvents(), now });
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = now.toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
    a.href = url;
    a.download = `${APP_NAME.toLowerCase()}-test-record-${stamp}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setSaved(true);
  }

  return (
    <p className="small muted test-record">
      <button type="button" className="link" onClick={() => void download()}>
        Download test record
      </button>{" "}
      {saved
        ? "Saved. Send the file with your feedback."
        : "Your writing, what Inkreel searched for, the scores and matches, and your changes. Photo names and times, but no photos."}
    </p>
  );
}
