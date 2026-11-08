const STEPS = ["Words", "Photos", "Matches", "Share"] as const;

/** Where the user is in the flow. Steps not built yet are shown, so the whole path is visible. */
export function StepBar({ current }: { current: number }) {
  return (
    <ol className="stepbar" aria-label="Steps">
      {STEPS.map((label, i) => (
        <li key={label} className={i === current ? "current" : i < current ? "done" : undefined}>
          <span className="num">{i + 1}</span> {label}
        </li>
      ))}
    </ol>
  );
}
