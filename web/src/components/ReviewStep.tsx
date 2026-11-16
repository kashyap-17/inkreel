"use client";

import { useState } from "react";
import {
  cardText,
  orderedPhotos,
  slidesOf,
  targetBounds,
  verdictKey,
  type Card,
  type FlowAction,
  type FlowState,
} from "@/lib/flow/flow";
import { Photo } from "./Photo";
import { StepBar } from "./StepBar";
import { SwapSheet } from "./SwapSheet";
import { useTester } from "./Tester";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function ReviewStep({
  state,
  dispatch,
  checking,
}: {
  state: FlowState;
  dispatch: (a: FlowAction) => void;
  checking: boolean;
}) {
  // Which part's photo is being chosen: `replacing` is the photo to change, or null to add one more.
  const [swapping, setSwapping] = useState<{ cardId: string; replacing: string | null } | null>(null);
  const tester = useTester();
  const match = state.match;
  const byHand = match?.byHand ?? false;
  const { min, max } = targetBounds(state);
  const slides = slidesOf(state);
  // Matching by hand, fewer/more changes how many parts the writing is split into.
  const count = byHand ? state.cards.length : slides.length;
  const swapCard = state.cards.find((c) => c.id === swapping?.cardId);

  return (
    <>
      <StepBar current={2} />
      <h1>Your matches</h1>
      <p className="lede">
        {byHand
          ? "Your writing, split into parts. Pick a photo for each."
          : "Your writing, split into parts, with the photos Inkreel picked for each and why. Change anything."}{" "}
        The photos go in this order, and your words go in the caption.
      </p>
      {match?.notes.map((n) => (
        <p key={n} className="warn">
          {n}
        </p>
      ))}
      {tester && match?.searchesFellBack && (
        <p className="warn small">Tester: the search call failed, so the sentences themselves were searched.</p>
      )}

      <div className="row toolbar">
        <span className="small">{byHand ? plural(count, "part", "parts") : plural(count, "photo", "photos")}</span>
        <button
          type="button"
          className="secondary small-button"
          disabled={count <= min}
          onClick={() => dispatch({ type: "setTarget", target: count - 1 })}
        >
          {byHand ? "Fewer parts" : "Fewer photos"}
        </button>
        <button
          type="button"
          className="secondary small-button"
          disabled={count >= max}
          onClick={() => dispatch({ type: "setTarget", target: count + 1 })}
        >
          {byHand ? "More parts" : "More photos"}
        </button>
        <button
          type="button"
          className="secondary small-button"
          disabled={state.history.length === 0}
          onClick={() => dispatch({ type: "undo" })}
        >
          Undo
        </button>
      </div>
      {checking && (
        <p className="small muted" aria-live="polite">
          Checking the matches and writing reasons…
        </p>
      )}

      <ol className="cards">
        {state.cards.map((card, i) => (
          <MatchCard
            key={card.id}
            state={state}
            card={card}
            index={i}
            last={i === state.cards.length - 1}
            checking={checking}
            tester={tester}
            dispatch={dispatch}
            numberOf={(photoId) => slides.findIndex((x) => x.cardId === card.id && x.photoId === photoId) + 1}
            onChoose={(replacing) => setSwapping({ cardId: card.id, replacing })}
          />
        ))}
      </ol>

      {swapCard && (
        <SwapSheet
          state={state}
          card={swapCard}
          replacing={swapping!.replacing}
          onClose={() => setSwapping(null)}
          onPick={(photoId) => {
            const replacing = swapping!.replacing;
            if (replacing || !swapCard.photoId || swapCard.captionOnly) {
              dispatch({ type: "swap", cardId: swapCard.id, photoId, ...(replacing ? { replacing } : {}) });
            } else dispatch({ type: "addPhoto", cardId: swapCard.id, photoId });
            setSwapping(null);
          }}
        />
      )}

      <div className="row actions">
        <button type="button" className="secondary" onClick={() => dispatch({ type: "goTo", step: "photos" })}>
          Back to photos
        </button>
        <button type="button" disabled={slides.length === 0} onClick={() => dispatch({ type: "goTo", step: "preview" })}>
          Next: preview
        </button>
      </div>
    </>
  );
}

function MatchCard({
  state,
  card,
  index,
  last,
  checking,
  tester,
  dispatch,
  numberOf,
  onChoose,
}: {
  state: FlowState;
  card: Card;
  index: number;
  last: boolean;
  checking: boolean;
  tester: boolean;
  dispatch: (a: FlowAction) => void;
  /** The slide number of one of this part's photos. */
  numberOf: (photoId: string) => number;
  /** Opens the photo chooser: to change `replacing`, or to add a photo when null. */
  onChoose: (replacing: string | null) => void;
}) {
  const match = state.match;
  const photos = card.captionOnly ? [] : orderedPhotos(state, card);
  const lookedFor = card.sentenceIds.map((id) => match?.lookedFor[id]).filter(Boolean) as string[];
  const lines = card.sentenceIds.length;

  return (
    <li className="card match">
      <p className="words">{cardText(state, card)}</p>
      {card.textChanged && <span className="label weak">Words changed: check the photos</span>}

      {card.captionOnly ? (
        <p className="small muted">No photo for this part. Its words stay in the caption.</p>
      ) : photos.length === 0 ? (
        <div className="match-row">
          <div className="match-photo">
            <button type="button" className="placeholder" onClick={() => onChoose(null)}>
              Choose a photo
            </button>
          </div>
        </div>
      ) : (
        photos.map(({ photoId, status }) => {
          const verdict = match?.verdicts[verdictKey(card.sentenceIds, photoId)];
          const weak =
            status === "suggested" && (verdict ? !verdict.fits : photoId === card.photoId && card.strength === "weak");
          return (
            <div key={photoId} className="match-row">
              <div className="match-photo">
                <button
                  type="button"
                  className="photo-button"
                  onClick={() => onChoose(photoId)}
                  aria-label={`Change photo ${numberOf(photoId)}`}
                >
                  <Photo id={photoId} size="full" />
                </button>
                <span className="slide-num">{numberOf(photoId)}</span>
              </div>
              <div className="why small">
                <span className={`label ${status === "swapped" ? "you" : "ai"}`}>
                  {status === "swapped" ? "Chosen by you" : "Matched by Inkreel"}
                </span>
                {weak && <span className="label weak">No strong match</span>}
                {verdict ? (
                  <p>{verdict.reason}</p>
                ) : status === "suggested" && checking ? (
                  <p className="muted">Checking…</p>
                ) : null}
                <div className="row card-actions">
                  <button type="button" className="secondary small-button" onClick={() => onChoose(photoId)}>
                    Change photo
                  </button>
                  {photos.length > 1 && (
                    <button
                      type="button"
                      className="link small"
                      onClick={() => dispatch({ type: "removePhoto", cardId: card.id, photoId })}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      {tester && lookedFor.length > 0 && (
        <details className="small">
          <summary>What Inkreel looked for</summary>
          <p className="muted">{lookedFor.join("; ")}</p>
        </details>
      )}

      <div className="row card-actions">
        {photos.length > 0 && (
          <button type="button" className="secondary small-button" onClick={() => onChoose(null)}>
            Add a photo
          </button>
        )}
        <button
          type="button"
          className="secondary small-button"
          onClick={() => dispatch({ type: "toggleCaptionOnly", cardId: card.id })}
        >
          {card.captionOnly ? "Use a photo" : photos.length > 1 ? "No photos for this part" : "No photo for this part"}
        </button>
        {index > 0 && (
          <button
            type="button"
            className="link small"
            onClick={() => dispatch({ type: "moveSentence", cardId: card.id, to: "previous" })}
          >
            {lines === 1 ? "Join with the part above" : "Move first line up"}
          </button>
        )}
        {!last && (
          <button
            type="button"
            className="link small"
            onClick={() => dispatch({ type: "moveSentence", cardId: card.id, to: "next" })}
          >
            {lines === 1 ? "Join with the part below" : "Move last line down"}
          </button>
        )}
      </div>
    </li>
  );
}
