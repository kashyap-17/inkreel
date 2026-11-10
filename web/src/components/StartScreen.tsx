import { APP_NAME, APP_TAGLINE } from "@/config/app";
import type { Mode } from "@/lib/flow/flow";

interface ModeOption {
  mode: Mode;
  title: string;
  body: string;
  ready: boolean;
}

const MODES: ModeOption[] = [
  {
    mode: "own",
    title: "I have writing",
    body: "Paste or type your notes, a poem, anything from the trip. Used exactly as you wrote it.",
    ready: true,
  },
  {
    mode: "help",
    title: "Help me write",
    body: "Answer four quick questions about the trip. Inkreel drafts lines from your answers, marked as AI.",
    ready: false,
  },
  {
    mode: "mix",
    title: "Mix",
    body: "Keep your writing and see a few suggested lines. Accept or reject each one.",
    ready: false,
  },
];

export function StartScreen({ onChoose }: { onChoose: (mode: Mode) => void }) {
  return (
    <>
      <p className="wordmark">{APP_NAME}</p>
      <h1 className="hero">{APP_TAGLINE}</h1>
      <p className="lede">
        Hundreds of trip photos, and a few lines that say how it really felt. Start with your words, and Inkreel finds
        the photos in your album that go with them, so what you post sounds like you.
      </p>

      <ol className="how">
        <li>
          <strong>Write.</strong> Your notes, a poem, or a few lines about the trip.
        </li>
        <li>
          <strong>Add photos.</strong> The whole trip, even hundreds.
        </li>
        <li>
          <strong>Match.</strong> Inkreel splits your writing and picks a photo for each part, with a short reason.
          Swap any you’d pick differently.
        </li>
        <li>
          <strong>Share.</strong> A carousel and caption, ready to post.
        </li>
      </ol>

      <ul className="promises small">
        <li>Your words are never rewritten. Anything AI writes is marked.</li>
        <li>Your photos stay on your phone. Inkreel asks before sending anything.</li>
      </ul>

      <h2>How do you want to tell it?</h2>
      <div className="modes">
        {MODES.map((m) =>
          m.ready ? (
            <button key={m.mode} type="button" className="mode" onClick={() => onChoose(m.mode)}>
              <span className="mode-title">{m.title}</span>
              <span className="mode-body">{m.body}</span>
            </button>
          ) : (
            <div key={m.mode} className="mode disabled" aria-disabled="true">
              <span className="mode-title">
                {m.title} <span className="badge">Coming soon</span>
              </span>
              <span className="mode-body">{m.body}</span>
            </div>
          ),
        )}
      </div>
    </>
  );
}
