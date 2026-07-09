export function generateRandom(n) {
  const randomNumber = Math.round(Math.random() * n);
  return randomNumber;
}

/**
 * Counts per-round wins from two players' reaction-time score arrays (lower
 * time wins that round; equal times are a push, no point either way).
 * Intentionally duplicated from backend/utils.js's identical helper — they
 * run in different runtimes (frontend derives it for display only, backend
 * uses it to decide the actual match winner). Keep both in sync if the
 * win-target or scoring rule ever changes.
 *
 * @param {number[]} scores1 - player 1's reaction times in ms, one per round played
 * @param {number[]} scores2 - player 2's reaction times in ms, one per round played
 * @returns {{wins1: number, wins2: number, roundsPlayed: number, perRound: string[]}}
 *   perRound[i] is 'p1' | 'p2' | 'push' for round i.
 */
export function getRoundWins(scores1, scores2) {
  const roundsPlayed = Math.min(scores1.length, scores2.length);
  let wins1 = 0;
  let wins2 = 0;
  const perRound = [];
  for (let i = 0; i < roundsPlayed; i++) {
    if (scores1[i] < scores2[i]) {
      wins1++;
      perRound.push("p1");
    } else if (scores2[i] < scores1[i]) {
      wins2++;
      perRound.push("p2");
    } else {
      perRound.push("push");
    }
  }
  return { wins1, wins2, roundsPlayed, perRound };
}
