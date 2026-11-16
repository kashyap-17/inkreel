"use client";

import { useEffect, useRef } from "react";
import { cardPhotoIds, slidesOf, stackLookup, verdictKey, type Card, type FlowState } from "@/lib/flow/flow";
import { makeRangeScorer, rankCandidates } from "@/lib/match/chunk";
import { formatTime } from "@/lib/photos/format";
import { AROUND_MINUTES } from "@/lib/photos/stacks";
import { Photo } from "./Photo";

/**
 * Choosing a photo for one part: Inkreel's next picks, the same scene, around then, elsewhere.
 * `replacing` is the photo being changed, or null when adding one more photo to the part.
 */
export function SwapSheet({
  state,
  card,
  replacing,
  onPick,
  onClose,
}: {
  state: FlowState;
  card: Card;
  replacing: string | null;
  onPick: (photoId: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const match = state.match;
  const byId = new Map(state.photos.map((p) => [p.id, p]));
  const current = byId.get(replacing ?? card.photoId ?? "");
  const stack = current ? state.stacks.find((k) => k.photoIds.includes(current.id)) : undefined;
  // The part's own photos aren't offered again.
  const shown = new Set<string>(card.captionOnly ? [] : cardPhotoIds(card));
  const take = (ids: string[]) => ids.filter((id) => byId.has(id) && !shown.has(id) && (shown.add(id), true));

  const suggested = match?.byHand ? [] : take(card.alternatives);
  const sameShot = replacing ? take(stack?.photoIds ?? []) : [];
  // Only offered when changing a photo; when adding one, every other photo is listed below.
  const around = replacing && current
    ? take(
        state.photos
          .filter((p) => Math.abs(p.takenAt - current.takenAt) <= AROUND_MINUTES * 60_000)
          .map((p) => p.id),
      )
    : [];

  let elsewhere: string[];
  if (match && !match.byHand && match.candidates.length) {
    const start = match.sentenceIds.indexOf(card.sentenceIds[0]!);
    const end = match.sentenceIds.indexOf(card.sentenceIds[card.sentenceIds.length - 1]!) + 1;
    const order = start >= 0 && end > start ? rankCandidates(makeRangeScorer(match.scores, match.candidates.length), start, end) : [];
    // Every photo, best fit first; any that weren't matched (not looked at this time) at the end.
    elsewhere = take([...order.map((i) => match.candidates[i]!.photoId), ...state.stacks.map((k) => k.topPick)]);
  } else {
    elsewhere = take(state.photos.map((p) => p.id));
  }

  const reasonFor = (id: string) => match?.verdicts[verdictKey(card.sentenceIds, id)];

  // Photos already in another slide; choosing one makes the two slides trade photos.
  const stackOf = stackLookup(state);
  const slides = slidesOf(state);
  const inSlide = (id: string) => {
    const i = slides.findIndex((slide) => slide.cardId !== card.id && stackOf(slide.photoId) === stackOf(id));
    return i >= 0 ? i + 1 : null;
  };
  // Photos not yet in the post come first.
  elsewhere = [...elsewhere.filter((id) => !inSlide(id)), ...elsewhere.filter((id) => inSlide(id))];
  const whenPicked = replacing ? "the two will trade places" : "it will move here";

  const grid = (title: string, ids: string[], note?: string) =>
    ids.length > 0 && (
      <section>
        <h3>{title}</h3>
        {note && <p className="small muted">{note}</p>}
        <div className="thumbs pick">
          {ids.map((id) => {
            const p = byId.get(id)!;
            return (
              <button key={id} type="button" className="thumb" onClick={() => onPick(id)}>
                <Photo id={id} alt={`Photo taken at ${formatTime(p)}`} />
                <span className="flag time">{inSlide(id) ? `In slide ${inSlide(id)}` : formatTime(p)}</span>
              </button>
            );
          })}
        </div>
      </section>
    );

  return (
    <dialog ref={ref} className="sheet" onClose={onClose} aria-label={replacing ? "Choose another photo" : "Add a photo"}>
      <div className="sheet-head">
        <strong>{replacing ? "Choose another photo" : "Add a photo to this part"}</strong>
        <button type="button" className="link" onClick={onClose}>
          Close
        </button>
      </div>
      {suggested.length > 0 && (
        <section>
          <h3>Inkreel’s next picks</h3>
          {suggested.map((id) => (
            <button key={id} type="button" className="reason-row" onClick={() => onPick(id)}>
              <span className="thumb">
                <Photo id={id} />
              </span>
              <span className="small">
                {reasonFor(id)?.reason ?? `Taken at ${formatTime(byId.get(id)!)}`}
                {inSlide(id) && ` (in slide ${inSlide(id)}; ${whenPicked})`}
              </span>
            </button>
          ))}
        </section>
      )}
      {grid("Other shots of this", sameShot)}
      {grid("Around then", around, current ? `Within ${AROUND_MINUTES} minutes of ${formatTime(current)}` : undefined)}
      {grid(match?.byHand ? "All your photos" : "Elsewhere in your photos", elsewhere)}
    </dialog>
  );
}
