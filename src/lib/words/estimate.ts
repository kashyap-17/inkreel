// How many photos the writing will roughly need, shown before photos are added.
// Rule and starting values are recorded in docs/decisions.md ("Photo estimate").

export const MAX_PHOTOS = 20; // Instagram's limit per carousel

export const ESTIMATE = {
  wordsPerPhotoMax: 40, // fewest photos: one per 40 words
  wordsPerPhotoMin: 25, // most photos: one per 25 words
  sentencesPerPhotoMax: 4, // fewest photos: one per 4 sentences
  sentencesPerPhotoMin: 2, // most photos: one per 2 sentences
};

export interface PhotoEstimate {
  min: number;
  max: number;
  /** True when the writing would need more than Instagram allows. */
  overLimit: boolean;
}

export function estimatePhotos(words: number, sentences: number, maxMoments?: number): PhotoEstimate | null {
  if (words === 0 || sentences === 0) return null;
  const fewest = Math.ceil(Math.max(words / ESTIMATE.wordsPerPhotoMax, sentences / ESTIMATE.sentencesPerPhotoMax));
  const most = Math.ceil(Math.max(words / ESTIMATE.wordsPerPhotoMin, sentences / ESTIMATE.sentencesPerPhotoMin));
  const cap = Math.min(sentences, MAX_PHOTOS, maxMoments ?? Infinity);
  const max = Math.max(1, Math.min(most, cap));
  const min = Math.max(1, Math.min(fewest, max));
  return { min, max, overLimit: most > MAX_PHOTOS && sentences > MAX_PHOTOS };
}

export function formatEstimate(e: PhotoEstimate): string {
  if (e.min === e.max) return `About ${e.min} photo${e.min === 1 ? "" : "s"}`;
  return `About ${e.min}–${e.max} photos`;
}
