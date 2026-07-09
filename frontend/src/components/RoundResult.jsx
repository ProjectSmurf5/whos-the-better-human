import React from "react";
import "./RoundResult.css";
import ReadyButton from "./ReadyButton";
import { getRoundWins } from "../utils/functions";

// Reaction times beyond this are treated as a "full" (0%) bar — keeps the
// fill scale readable without needing a live/continuous data feed, since we
// only ever know a score once it's final.
const LANE_MAX_MS = 1000;

function lanePercent(score) {
  if (score == null) return 0;
  const pct = 100 - (score / LANE_MAX_MS) * 100;
  return Math.min(100, Math.max(8, pct));
}

/**
 * Live per-round race/result view (design screen 3 in the user's numbering).
 * Mounts the instant the local player has a score for the current round
 * (Game.jsx's myLastScore), replacing <ReactionBox>. Shows my own result
 * immediately; the opponent's lane stays pending until their score arrives
 * (roundResultReceived), matching the "show my time, then transition once
 * the opponent responds" flow. Hosts the (now-gated) next-round Ready button.
 *
 * @param {number} myScore - my reaction time in ms for this round (or 1000 for a miss/too-soon)
 * @param {boolean} myTooSoon - true if my score came from an early click, not a real reaction
 * @param {string} myUsername
 * @param {string} myAvatar - image src for my player-number's stick figure (host=white, challenger=black)
 * @param {number[]} myScores - my full score history, used to compute the round-win tally
 * @param {string} opponentUsername
 * @param {string} opponentAvatar - image src for the opponent's player-number's stick figure
 * @param {number} [opponentScore] - opponent's ms for this round, undefined until roundResultReceived
 * @param {boolean} [opponentTooSoon] - true if the opponent's score came from an early click,
 *   from the server's authoritative tooSoon array (see backend/server.js) — not inferred from
 *   the score value, since a real miss also submits the same 1000ms penalty
 * @param {number[]} opponentScores - opponent's full score history, for the round-win tally
 * @param {boolean} roundResultReceived - true once both players have scored this round
 * @param {number} roundNumber - 1-indexed current round
 * @param {function} readyHandler - emits "player-ready" for the next round
 * @param {boolean} clickedReady - whether I've already readied up for the next round
 */
function RoundResult({
  myScore,
  myTooSoon,
  myUsername,
  myAvatar,
  myScores,
  opponentUsername,
  opponentAvatar,
  opponentScore,
  opponentTooSoon,
  opponentScores,
  roundResultReceived,
  roundNumber,
  readyHandler,
  clickedReady,
}) {
  const { wins1: myWins, wins2: opponentWins } = getRoundWins(
    myScores,
    opponentScores
  );

  const bothScored = roundResultReceived && opponentScore != null;
  const tied = bothScored && myScore === opponentScore;
  const iAmFastest = bothScored && !tied && myScore < opponentScore;
  const opponentIsFastest = bothScored && !tied && opponentScore < myScore;

  return (
    <div className="round-result">
      <div className="round-status-line">
        <span>REACTION TEST · ROUND {roundNumber}</span>
        <span className="round-tally">
          {myWins} · {opponentWins}
        </span>
      </div>

      <div className={`race-lane ${iAmFastest ? "race-lane--fastest" : ""}`}>
        {iAmFastest && <span className="race-badge">FASTEST · +1</span>}
        <img src={myAvatar} className="race-avatar" alt="" />
        <span className="race-name">{myUsername}</span>
        {myTooSoon ? (
          <span className="race-too-soon">✕ TOO SOON — ROUND FORFEIT</span>
        ) : (
          <>
            <div className="race-bar-track">
              <div
                className="race-bar-fill race-bar-fill--mine"
                style={{ width: `${lanePercent(myScore)}%` }}
              />
            </div>
            <span className="race-time">{(myScore / 1000).toFixed(3)}s</span>
          </>
        )}
      </div>

      <div
        className={`race-lane ${
          opponentIsFastest ? "race-lane--fastest" : ""
        }`}>
        {opponentIsFastest && <span className="race-badge">FASTEST · +1</span>}
        <img src={opponentAvatar} className="race-avatar" alt="" />
        <span className="race-name">{opponentUsername}</span>
        {!roundResultReceived ? (
          <span className="race-pending">
            racing<span className="waiting-dots" aria-hidden="true" />
          </span>
        ) : opponentTooSoon ? (
          <span className="race-too-soon">✕ TOO SOON — ROUND FORFEIT</span>
        ) : (
          <>
            <div className="race-bar-track">
              <div
                className="race-bar-fill race-bar-fill--opponent"
                style={{ width: `${lanePercent(opponentScore)}%` }}
              />
            </div>
            <span className="race-time">{(opponentScore / 1000).toFixed(3)}s</span>
          </>
        )}
      </div>

      {bothScored && (
        <p className="round-caption">
          {tied
            ? "Round tied"
            : `Δ ${Math.abs(myScore - opponentScore)}ms · ${
                iAmFastest ? myUsername : opponentUsername
              } takes round ${roundNumber}`}
        </p>
      )}

      {roundResultReceived && (
        <ReadyButton readyHandler={readyHandler} clickedReady={clickedReady} />
      )}
    </div>
  );
}

export default RoundResult;
