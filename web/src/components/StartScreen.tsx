"use client";

import { useState } from "react";
import { APP_NAME, APP_TAGLINE } from "@/config/app";
import { AiError, hasInvite, saveInvite, verifyInvite } from "@/lib/ai/client";
import type { Mode } from "@/lib/flow/flow";

const MODES: { mode: Mode; title: string; body: string }[] = [
  {
    mode: "own",
    title: "I have writing",
    body: "Paste or type your notes, a poem, anything you want to say. Used exactly as you wrote it.",
  },
  {
    mode: "help",
    title: "Write with Inkreel",
    body: "Answer a few short questions and Inkreel drafts lines from your answers. You can change every line.",
  },
];

/**
 * What Inkreel is, the invite code (asked once per device), and the two ways to start.
 * `message`: why the code is asked for again, e.g. the server turned the saved one down.
 */
export function StartScreen({ onChoose, message }: { onChoose: (mode: Mode) => void; message?: string | null }) {
  // Read on the client only: this screen isn't shown before the saved draft has loaded.
  const [needsCode] = useState(() => !hasInvite());
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(message ?? null);

  async function choose(mode: Mode) {
    if (!needsCode) return onChoose(mode);
    setBusy(true);
    setError(null);
    try {
      if (!(await verifyInvite(code.trim()))) {
        setError(code.trim() ? "That invite code isn’t right." : "Enter your invite code first.");
        return;
      }
      saveInvite(code.trim());
      onChoose(mode);
    } catch (e) {
      setError(e instanceof AiError ? e.message : "Couldn’t reach Inkreel’s server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="wordmark">{APP_NAME}</p>
      <h1 className="hero">{APP_TAGLINE}</h1>
      <p className="lede">
        Add as many photos as you like and a few lines about how it felt. Inkreel picks the photos that fit your words,
        puts them in order with a reason for each, and gives you a carousel and caption ready to post.
      </p>

      {needsCode && (
        <div className="invite">
          <label htmlFor="invite" className="small">
            Invite code
          </label>
          <input
            id="invite"
            className="text-input"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="From whoever shared Inkreel with you"
          />
        </div>
      )}
      {error && <p className="warn">{error}</p>}

      <h2>How do you want to tell it?</h2>
      <div className="modes">
        {MODES.map((m) => (
          <button key={m.mode} type="button" className="mode" disabled={busy} onClick={() => void choose(m.mode)}>
            <span className="mode-title">{m.title}</span>
            <span className="mode-body">{m.body}</span>
          </button>
        ))}
      </div>

      <ul className="promises small">
        <li>Your words are never rewritten, and anything AI writes is marked.</li>
        <li>Your photos stay on your phone until you say so.</li>
      </ul>
    </>
  );
}
