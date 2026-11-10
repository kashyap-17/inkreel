// Matching and chunking, in plain code (docs/plan.md, "Matching and chunking").
// Groups consecutive sentences into chunks and picks a photo for each, with at most one
// photo per stack. Chunks are whole consecutive sentences, so they join back into the exact text.

export interface Candidate {
  photoId: string;
  stackId: string;
}

export interface ProposedChunk {
  /** Sentence indexes [start, end). */
  start: number;
  end: number;
  photoId: string | null;
  score: number;
  /** Next-best photos from other stacks, best first. */
  alternatives: string[];
  strength: "strong" | "weak";
}

// Starting values, tuned in Milestone 0.
export const MATCHING = {
  /** Pull towards chunks of similar length, so one chunk doesn't swallow the poem. */
  balanceWeight: 0.02,
  /** A match is weak when it beats the typical photo by less than this. */
  weakMargin: 0.04,
  alternatives: 2,
};

/** Per-candidate mean score over a run of sentences, using prefix sums. */
export function makeRangeScorer(scores: number[][], candidateCount: number) {
  const prefix: Float64Array[] = [];
  for (let p = 0; p < candidateCount; p++) {
    const row = new Float64Array(scores.length + 1);
    for (let s = 0; s < scores.length; s++) row[s + 1] = row[s]! + (scores[s]?.[p] ?? 0);
    prefix.push(row);
  }
  return (start: number, end: number): number[] =>
    prefix.map((row) => (row[end]! - row[start]!) / (end - start));
}

/** Candidate indexes for a run of sentences, best first. */
export function rankCandidates(scorer: ReturnType<typeof makeRangeScorer>, start: number, end: number): number[] {
  const means = scorer(start, end);
  return means.map((_, i) => i).sort((a, b) => means[b]! - means[a]!);
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

/**
 * Splits `sentenceCount` sentences into `target` chunks (fewer if there aren't enough
 * sentences or stacks) and matches each chunk to a photo.
 */
export function chunkAndMatch(scores: number[][], candidates: Candidate[], target: number): ProposedChunk[] {
  const n = scores.length;
  if (n === 0) return [];
  const distinctStacks = new Set(candidates.map((c) => c.stackId)).size;
  const k = Math.max(1, Math.min(target, n, distinctStacks || n));
  const scorer = makeRangeScorer(scores, candidates.length);

  // value[i][j]: how well sentences i..j-1 work as one chunk (best photo's mean score),
  // minus a small penalty for being much longer or shorter than average.
  const ideal = n / k;
  const memo = new Map<number, number>();
  const value = (i: number, j: number) => {
    const key = i * (n + 1) + j;
    let v = memo.get(key);
    if (v === undefined) {
      const means = scorer(i, j);
      const best = means.length ? Math.max(...means) : 0;
      const off = (j - i - ideal) / ideal;
      v = best - MATCHING.balanceWeight * off * off;
      memo.set(key, v);
    }
    return v;
  };

  // dp[c][j]: best total for the first j sentences in c chunks.
  const dp = Array.from({ length: k + 1 }, () => new Float64Array(n + 1).fill(-Infinity));
  const from = Array.from({ length: k + 1 }, () => new Int32Array(n + 1));
  dp[0]![0] = 0;
  for (let c = 1; c <= k; c++) {
    for (let j = c; j <= n - (k - c); j++) {
      for (let i = c - 1; i < j; i++) {
        const total = dp[c - 1]![i]! + value(i, j);
        if (total > dp[c]![j]!) {
          dp[c]![j] = total;
          from[c]![j] = i;
        }
      }
    }
  }
  const ranges: [number, number][] = [];
  for (let c = k, j = n; c > 0; c--) {
    const i = from[c]![j]!;
    ranges.unshift([i, j]);
    j = i;
  }

  if (candidates.length === 0) {
    return ranges.map(([start, end]) => ({ start, end, photoId: null, score: 0, alternatives: [], strength: "weak" }));
  }

  // Give each chunk its best photo, most confident chunks first, never two from one stack.
  const ranked = ranges.map(([start, end]) => ({ means: scorer(start, end), order: rankCandidates(scorer, start, end) }));
  const chosen = new Array<number | null>(ranges.length).fill(null);
  const usedStacks = new Set<string>();
  const byConfidence = ranked.map((r, i) => i).sort((a, b) => ranked[b]!.means[ranked[b]!.order[0]!]! - ranked[a]!.means[ranked[a]!.order[0]!]!);
  for (const ci of byConfidence) {
    const pick = ranked[ci]!.order.find((p) => !usedStacks.has(candidates[p]!.stackId));
    if (pick === undefined) continue;
    chosen[ci] = pick;
    usedStacks.add(candidates[pick]!.stackId);
  }

  return ranges.map(([start, end], ci) => {
    const pick = chosen[ci];
    const { means, order } = ranked[ci]!;
    if (pick === null || pick === undefined) {
      return { start, end, photoId: null, score: 0, alternatives: [], strength: "weak" as const };
    }
    const alternatives = order
      .filter((p) => !usedStacks.has(candidates[p]!.stackId))
      .slice(0, MATCHING.alternatives)
      .map((p) => candidates[p]!.photoId);
    const score = means[pick]!;
    return {
      start,
      end,
      photoId: candidates[pick]!.photoId,
      score,
      alternatives,
      strength: score - median(means) >= MATCHING.weakMargin || candidates.length < 3 ? "strong" : "weak",
    };
  });
}
