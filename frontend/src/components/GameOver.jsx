import React from "react";
import "./GameOver.css";
import mascotImage from "../assets/wtbh-logo.png";
import mascotImage2 from "../assets/wtbh-logo-white.png";
import crownImage from "../assets/king.png";
import { getRoundWins } from "../utils/functions";

function findFastest(p1Scores, p1Name, p2Scores, p2Name) {
  let best = Infinity;
  let bestPlayer = null;
  let bestRound = null;
  p1Scores.forEach((score, i) => {
    if (score < best) {
      best = score;
      bestPlayer = p1Name;
      bestRound = i + 1;
    }
  });
  p2Scores.forEach((score, i) => {
    if (score < best) {
      best = score;
      bestPlayer = p2Name;
      bestRound = i + 1;
    }
  });
  return { best, bestPlayer, bestRound };
}

function findClosestRound(p1Scores, p2Scores, roundsPlayed) {
  let min = Infinity;
  let round = null;
  for (let i = 0; i < roundsPlayed; i++) {
    const diff = Math.abs(p1Scores[i] - p2Scores[i]);
    if (diff < min) {
      min = diff;
      round = i + 1;
    }
  }
  return { min, round };
}

/**
 * Match-results screen (design screen 4 in the user's numbering). Simplified
 * from the mockup on purpose: the mockup's results screen assumes a
 * multi-game best-of-5 (Quick Math/Type Racer/Sequence/Bullet Chess round
 * cards) that doesn't exist yet — only Reaction does — so this shows a
 * single-game round-outcome strip instead, sized to however many rounds were
 * actually played (3, 4, or 5 under the first-to-3 win condition). Elo is
 * deliberately left exactly as it was before this redesign (no absolute
 * rank tile) since it's slated for removal in a later roadmap phase.
 *
 * @param {object} gameObj - full room state at game-end, including both
 *   players' score histories, eloDiff, and gameObj.state.result.winner/loser
 * @param {number} playerNumber - the viewing client's own player slot
 * @param {function} handleMainMenu - navigates back to the hero page
 */
function GameOver({ gameObj, playerNumber, handleMainMenu }) {
  const player1 = gameObj.players[1];
  const player2 = gameObj.players[2];
  const winnerName = gameObj.state.result.winner;
  const isDraw = winnerName === "Draw";
  const player1IsWinner = !isDraw && winnerName === player1.username;

  const { wins1, wins2, roundsPlayed, perRound } = getRoundWins(
    player1.score,
    player2.score
  );
  const winnerTally = player1IsWinner ? wins1 : wins2;
  const loserTally = player1IsWinner ? wins2 : wins1;

  const fastest = findFastest(
    player1.score,
    player1.username,
    player2.score,
    player2.username
  );
  const closest = findClosestRound(player1.score, player2.score, roundsPlayed);

  const eloDifference = gameObj.players[playerNumber].eloDiff;

  function roundPipClass(outcome) {
    if (outcome === "push") return "round-pip round-pip--push";
    const roundWinnerName = outcome === "p1" ? player1.username : player2.username;
    return roundWinnerName === winnerName
      ? "round-pip round-pip--winner"
      : "round-pip round-pip--loser";
  }

  return (
    <div className="game-over-container">
      <p className="game-over-subheader">
        MATCH COMPLETE · {isDraw ? "DRAW" : "BEST OF 5"}
      </p>

      <div className="game-over-mascot-row">
        <img src={crownImage} className="game-over-crown" alt="" />
        {player1IsWinner ? <img src={mascotImage2} className="game-over-mascot" alt="" /> :
          <img src={mascotImage} className="game-over-mascot" alt="" />}
        <img src={crownImage} className="game-over-crown" alt="" />
      </div>

      <h1 className="game-over-text">
        {isDraw ? "Draw!" : (
          <>
            {winnerName} <span className="game-over-wins">WINS</span>
          </>
        )}
      </h1>

      {!isDraw && (
        <p className="game-over-tally">
          <span className="tally-num tally-winner">{winnerTally}</span>
          <span className="tally-dash">–</span>
          <span className="tally-num tally-loser">{loserTally}</span>
        </p>
      )}

      {roundsPlayed > 0 && (
        <div className="round-pip-strip">
          {perRound.map((outcome, i) => (
            <span key={i} className={roundPipClass(outcome)}>
              {i + 1}
            </span>
          ))}
        </div>
      )}

      <div className="game-over-stats">
        <div className="game-over-stat-tile">
          <p className="stat-label">FASTEST REACTION</p>
          <p className="stat-value">{(fastest.best / 1000).toFixed(3)}s</p>
          <p className="stat-caption">
            by {fastest.bestPlayer} · round {fastest.bestRound}
          </p>
        </div>
        <div className="game-over-stat-tile">
          <p className="stat-label">CLOSEST ROUND</p>
          <p className="stat-value">Δ {closest.min}ms</p>
          <p className="stat-caption">round {closest.round}</p>
        </div>
      </div>

      <h3 className="game-over-elogain">
        {eloDifference > 0
          ? `Elo Gain: +${eloDifference}`
          : eloDifference < 0
          ? `Elo Loss: ${eloDifference}`
          : "No Elo Change"}
      </h3>

      <div className="game-over-buttons">
        <button
          className="pill-button--filled"
          onClick={() => console.log("Rematch clicked (not yet wired up)")}>
          Rematch
        </button>
        <button className="pill-button--outline" onClick={handleMainMenu}>
          Back to menu
        </button>
      </div>
    </div>
  );
}

export default GameOver;
