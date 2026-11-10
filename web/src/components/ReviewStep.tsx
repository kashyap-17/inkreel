"use client";

import { useState } from "react";
import { cardText, targetBounds, verdictKey, type Card, type FlowAction, type FlowState } from "@/lib/flow/flow";
import { Photo } from "./Photo";
import { StepBar } from "./StepBar";
import { SwapSheet } from "./SwapSheet";

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
  const [swapping, setSwapping] = useState<string | null>(null);
  const match = state.match;
  const byHand = match?.byHand ?? false;
  const { min, max } = targetBounds(state);
  const count = state.cards.length;
  const withPhoto = state.cards.filter((c) => c.photoId && !c.captionOnly).length;
  const swapCard = state.cards.find((c) => c.id === swapping);

  return (
    <>
      <StepBar current={2} />
      <h1>Your matches</h1>
      <p className="lede">
        {byHand
          ? "Your writing, split into parts. Pick a photo for each."
          : "Your writing, split into parts, each with the photo Inkreel picked and why. Change anything."}
      </p>
      {match?.notes.map((n) => (
        <p key={n} className="warn">
          {n}
        </p>
      ))}

      <div className="row toolbar">
        <span className="small">{plural(count, "part", "parts")}</span>
        <button
          type="button"
          className="secondary small-button"
          disabled={count <= min}
          onClick={() => dispatch({ type: "setTarget", target: count - 1 })}
        >
          Fewer photos
        </button>
        <button
          type="button"
          className="secondary small-button"
          disabled={count >= max}
          onClick={() => dispatch({ type: "setTarget", target: count + 1 })}
        >
          More photos
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
            dispatch={dispatch}
            onSwap={() => setSwapping(card.id)}
          />
        ))}
      </ol>

      {swapCard && (
        <SwapSheet
          state={state}
          card={swapCard}
          onClose={() => setSwapping(null)}
          onPick={(photoId) => {
            dispatch({ type: "swap", cardId: swapCard.id, photoId });
            setSwapping(null);
          }}
        />
      )}

      <div className="row actions">
        <button type="button" className="secondary" onClick={() => dispatch({ type: "goTo", step: "photos" })}>
          Back to photos
        </button>
        <button type="button" disabled={withPhoto === 0} onClick={() => dispatch({ type: "goTo", step: "preview" })}>
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
  dispatch,
  onSwap,
}: {
  state: FlowState;
  card: Card;
  index: number;
  last: boolean;
  checking: boolean;
  dispatch: (a: FlowAction) => void;
  onSwap: () => void;
}) {
  const match = state.match;
  const verdict = card.photoId ? match?.verdicts[verdictKey(card.sentenceIds, card.photoId)] : undefined;
  const lookedFor = card.sentenceIds.map((id) => match?.lookedFor[id]).filter(Boolean) as string[];
  const lines = card.sentenceIds.length;

  return (
    <li className="card match">
      <div className="match-photo">
        {card.captionOnly ? (
          <div className="placeholder">Caption only</div>
        ) : card.photoId ? (
          <button type="button" className="photo-button" onClick={onSwap} aria-label="Change photo">
            <Photo id={card.photoId} size="full" />
          </button>
        ) : (
          <button type="button" className="placeholder" onClick={onSwap}>
            Choose a photo
          </button>
        )}
        <span className="slide-num">{index + 1}</span>
      </div>

      <div className="match-body">
        <p className="words">
          {cardText(state, card)}
        </p>

        {!card.captionOnly && card.photoId && (
          <div className="why small">
            <span className={`label ${card.status === "swapped" ? "you" : "ai"}`}>
              {card.status === "swapped" ? "Chosen by you" : "Matched by Inkreel"}
            </span>
            {card.status === "suggested" && card.strength === "weak" && <span className="label weak">No strong match</span>}
            {card.textChanged && <span className="label weak">Words changed: check this photo</span>}
            {verdict ? (
              <p>{verdict.reason}</p>
            ) : card.status === "suggested" && lookedFor.length > 0 ? (
              <p className="muted">{checking ? "Checking…" : `Looked for: ${lookedFor.join("; ")}`}</p>
            ) : null}
            {verdict && lookedFor.length > 0 && (
              <details>
                <summary>What Inkreel looked for</summary>
                <p className="muted">{lookedFor.join("; ")}</p>
              </details>
            )}
          </div>
        )}

        <div className="row card-actions">
          {!card.captionOnly && (
            <button type="button" className="secondary small-button" onClick={onSwap}>
              {card.photoId ? "Change photo" : "Choose photo"}
            </button>
          )}
          <button
            type="button"
            className="secondary small-button"
            onClick={() => dispatch({ type: "toggleCaptionOnly", cardId: card.id })}
          >
            {card.captionOnly ? "Use a photo" : "Caption only"}
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
      </div>
    </li>
  );
}
