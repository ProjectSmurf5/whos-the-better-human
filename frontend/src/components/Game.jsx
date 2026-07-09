import "../App.css";
import ReactionBox from "./ReactionBox";
import RoundResult from "./RoundResult";
import Lobby from "./Lobby";
import { generateRandom } from "../utils/functions";
import GameOver from "./GameOver";
import NavBar from "./NavBar";
import { useState, useEffect, use } from "react";
import { socket } from "../socket";
import axios from "axios";
import hostAvatar from "../assets/wtbh-logo-white.png";
import challengerAvatar from "../assets/wtbh-logo.png";

// How long to wait for the opponent's score before showing a soft
// "may have disconnected" banner. Not real forfeit detection (the server's
// disconnect handler is still disabled) — just a generous heuristic so a
// player isn't stuck staring at "awaiting opponent" forever.
const OPPONENT_WAIT_TIMEOUT_MS = 9000;

// Player 1 (host) is always the white stick figure, player 2 (challenger) is
// always the black one — mirrors the fixed player-number scheme used
// everywhere else (Lobby.jsx assigns these the same way).
function avatarForPlayer(playerNum) {
  return playerNum === 1 ? hostAvatar : challengerAvatar;
}

function Game({ gameObj, playerNumber, handleMainMenu, setGameObj, username }) {
  const [result, setResult] = useState({ winner: "", loser: "" });
  const [gameFinished, setGameFinished] = useState(false);
  const [roundRunning, setRoundRunning] = useState(false);
  const [timer1Running, setTimer1Running] = useState(false);
  const [timer1AFKTimeout, setTimer1AFKTimeout] = useState();
  const [eloGain, setEloGain] = useState(0);

  const [timerTwoStartStamp, setTimerTwoStartStamp] = useState();
  const [timerTwoAFKTimeout, setTimerTwoAFKTimeout] = useState();

  const [clickedReady, setClickedReady] = useState(false);

  // Round-race state: myLastScore is the missing piece that used to be
  // computed locally in clickHandler and only ever emitted, never stored, so
  // a player had no way to see their own time until the opponent also
  // finished. tooSoon distinguishes an early click ("TOO SOON") from a
  // 1000ms auto-miss timeout, purely for the visual state.
  const [myLastScore, setMyLastScore] = useState(null);
  const [tooSoon, setTooSoon] = useState(false);
  const [showOpponentWaitBanner, setShowOpponentWaitBanner] = useState(false);

  const gameState = gameObj.state;
  const API_URL =
    process.env.REACT_APP_DJANGO_API_URL || "http://localhost:8000/";

  const opponentNumber = playerNumber === 1 ? 2 : 1;
  // Both players' score arrays only grow to the current round's length once
  // the server's "game-update" for that round has arrived (i.e. only after
  // BOTH players have scored) — so this is naturally false until then, and
  // resets itself next round since the arrays lag currentRound until both score.
  // Guarded on both player slots existing: this is a plain top-level const,
  // evaluated on every render including while the host is alone in the lobby
  // (currentRound === 0, gameObj.players[2] not created yet until they join).
  const roundResultReceived =
    !!gameObj.players[1] &&
    !!gameObj.players[2] &&
    gameObj.players[1].score.length === gameState.currentRound &&
    gameObj.players[2].score.length === gameState.currentRound;

  function readyHandler() {
    if (clickedReady) return;
    if (timer1Running || roundRunning) {
      console.log("Player clicked ready during a round!");
      return;
    }
    socket.emit("player-ready");
    setClickedReady(true);
  }

  // Old: "player-score" carried just the raw ms number, so the opponent
  //   (and the server) couldn't tell a 1000 penalty from an early click
  //   apart from a 1000 penalty from simply missing the CLICK window.
  // New: carries { score, tooSoon } — tooSoon is true only for the early-click
  //   branch below. server.js stores both in parallel arrays; a true miss
  //   (timer2's auto-emit) sends tooSoon: false, same score, different reason.
  function clickHandler() {
    console.log("Player Clicked!");
    if (roundRunning) {
      setRoundRunning(false);
      clearTimeout(timerTwoAFKTimeout);

      let reactionTime = Date.now() - timerTwoStartStamp;

      console.log(`Player Clicked at ${reactionTime}ms`);
      socket.emit("player-score", { score: reactionTime, tooSoon: false });
      setMyLastScore(reactionTime);
      setClickedReady(false);
      return;
    } else {
      if (timer1Running) {
        // If clicked before timer 1 finished
        setTimer1Running(false);
        clearTimeout(timer1AFKTimeout);
        setRoundRunning(false);

        console.log("Player Clicked before Timer 1 Finished! (TOO SOON)");
        socket.emit("player-score", { score: 1000, tooSoon: true });
        setMyLastScore(1000);
        setTooSoon(true);
        setClickedReady(false);
      }
    }
  }

  // Listener UseEffect
  useEffect(() => {
    console.log("[Debug] Game component mounted");

    socket.on("next-round", onRoundStart);
    socket.on("game-end", (gameEndData) => {
      console.log("Game Ended: ", gameEndData);
      onGameEnd(gameEndData.game);
    });

    // Log initial socket connection status
    console.log("[Debug] Socket connected:", socket.connected);
    console.log("[Debug] Current room:", gameObj.roomName);

    // Cleanup function to remove event listeners
    return () => {
      console.log("[Debug] Game component unmounting");
      socket.off("next-round");
      socket.off("game-end");
    };
  }, []);

  // Soft "opponent may have disconnected" heuristic: while I've scored this
  // round but the opponent's score hasn't arrived yet, wait a generous window
  // before surfacing a banner. Not real forfeit detection (the server's
  // disconnect handler is disabled) — just an escape hatch so a player isn't
  // stuck indefinitely if the opponent's tab silently hangs or closes.
  useEffect(() => {
    if (myLastScore == null || roundResultReceived) return;
    const waitTimeoutId = setTimeout(() => {
      setShowOpponentWaitBanner(true);
    }, OPPONENT_WAIT_TIMEOUT_MS);
    return () => clearTimeout(waitTimeoutId);
  }, [myLastScore, roundResultReceived]);

  // Timer 1
  function onRoundStart() {
    setRoundRunning(false);
    console.log("Timer Triggered");
    setTimer1Running(true);

    // Single reset point for the whole per-round race-view state machine.
    setMyLastScore(null);
    setTooSoon(false);
    setShowOpponentWaitBanner(false);

    // Random time between 2-4 secs
    let timerOneLength = generateRandom(2000) + 2000;
    console.log(`random time generated: ${timerOneLength}`);

    let timeoutId = setTimeout(() => {
      console.log("Timer 1 Finished: Turning Screen Red!");

      setRoundRunning(true);
      setTimer1Running(false);

      timer2();
    }, timerOneLength);
    setTimer1AFKTimeout(timeoutId);
  }

  //Timer 2
  function timer2() {
    console.log("Timer 2 Triggered");
    setTimerTwoStartStamp(Date.now());

    let timeoutId = setTimeout(() => {
      if (!roundRunning) {
        console.log(`Player Clicked at 1000 ms`);
        // Not a too-soon click — just never clicked during the CLICK window.
        socket.emit("player-score", { score: 1000, tooSoon: false });
        setMyLastScore(1000);

        console.log("Timer 2 Finished: Turning Screen Normal!");

        setRoundRunning(false);
        setClickedReady(false);
      }
    }, 1000);

    setTimerTwoAFKTimeout(timeoutId);
  }

  function onGameEnd(finalGameObj) {
    setGameFinished(true);
    setGameObj(finalGameObj);
    console.log("Game Ended: ", finalGameObj);
  }

  // Old: entering a room dropped straight into the reaction view (ReactionBox +
  //   ReadyButton + right sidebar), with no lobby/waiting UI.
  // New: while the match hasn't started (currentRound === 0) we show the <Lobby>
  //   (design screens 2 & 3 — waiting for opponent / ready to start). Once the
  //   first round begins (currentRound >= 1) the original in-game view renders
  //   unchanged, so no game logic is affected.
  const isLobby = gameObj.state.currentRound === 0 && !gameFinished;

  return (
    <div className={`Game ${isLobby ? "Game--lobby" : ""}`}>
      <NavBar roomName={gameObj.roomName} />
      {gameFinished ? (
        <GameOver
          gameObj={gameObj}
          playerNumber={playerNumber}
          handleMainMenu={handleMainMenu}
        />
      ) : null}
      {isLobby ? (
        <Lobby
          gameObj={gameObj}
          playerNumber={playerNumber}
          username={username}
          readyHandler={readyHandler}
          clickedReady={clickedReady}
        />
      ) : !gameFinished ? (
        <div className="game-container full-width">
          {/* Old: always rendered <ReactionBox> + <ReadyButton> together,
              with the reaction time computed in clickHandler only ever
              emitted, never shown, so a player had no feedback until the
              opponent also finished.
              New: <ReactionBox> owns STEADY/CLICK only; the instant this
              player has a score for the round (myLastScore set), it's
              replaced by <RoundResult>, which shows that score immediately,
              the opponent's once it arrives, and hosts the next-round Ready
              button (now gated on both scores being in). */}
          {myLastScore == null ? (
            <ReactionBox
              clickHandler={clickHandler}
              roundRunning={roundRunning}
              timer1Running={timer1Running}
            />
          ) : (
            <RoundResult
              myScore={myLastScore}
              myTooSoon={tooSoon}
              myUsername={username}
              myAvatar={avatarForPlayer(playerNumber)}
              myScores={gameObj.players[playerNumber].score}
              opponentUsername={gameObj.players[opponentNumber].username}
              opponentAvatar={avatarForPlayer(opponentNumber)}
              opponentScore={
                gameObj.players[opponentNumber].score[gameState.currentRound - 1]
              }
              opponentTooSoon={
                gameObj.players[opponentNumber].tooSoon[gameState.currentRound - 1]
              }
              opponentScores={gameObj.players[opponentNumber].score}
              roundResultReceived={roundResultReceived}
              roundNumber={gameState.currentRound}
              readyHandler={readyHandler}
              clickedReady={clickedReady}
            />
          )}
          {showOpponentWaitBanner && !roundResultReceived && (
            <div className="opponent-wait-banner">
              <p>Your opponent hasn't responded — they may have disconnected.</p>
              <button className="pill-button--outline" onClick={handleMainMenu}>
                Back to menu
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
export default Game;
