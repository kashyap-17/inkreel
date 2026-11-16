"use client";

import { useEffect, useState } from "react";

/** Shown while a draft is on its way: what's happening, and after a while, why it's taking longer. */
export function DraftingNote() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 8_000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <p className="small muted drafting" role="status">
      <span className="spinner" aria-hidden="true" />{" "}
      {slow
        ? "The AI is slow right now. Still trying, for up to half a minute."
        : "Drafting your lines from your answers…"}
    </p>
  );
}
