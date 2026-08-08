import React, { useState } from "react";
import "./Lobby.css";
import avatarImage from "../assets/wtbh-logo.png";
import smallLogoImage from "../assets/wtbh-logo-white.png";

/**
 * Pre-game room lobby shown before the first round begins (game state
 * currentRound === 0). Purely presentational — it renders the design mockup's
 * screen 2 ("hosting, waiting for an opponent") when only one player is present,
 * and screen 3 ("opponent joined, ready to start") once both seats are filled.
 * All game logic (readying up, starting the match) is unchanged and handled by
 * the parent Game component via the passed-in readyHandler.
 *
 * @param {object} gameObj - in-memory room state from the socket server. Reads
 *   gameObj.state.numPlayers (1 or 2), gameObj.roomName (invite code), and
 *   gameObj.players[1|2] ({ username, isReady, ... }).
 * @param {number} playerNumber - this client's own player slot (1 = host, 2 = guest).
 * @param {string} username - this client's username (fallback display name).
 * @param {function} readyHandler - parent callback that emits "player-ready".
 * @param {boolean} clickedReady - parent's optimistic "I pressed ready" flag.
 */
function Lobby({ gameObj, playerNumber, username, readyHandler, clickedReady }) {
  const [copied, setCopied] = useState(false);

  const roomName = gameObj.roomName || "";
  const numPlayers = gameObj.state.numPlayers;
  const opponentJoined = numPlayers >= 2;

  // Player 1 is always the host (rendered on the left), player 2 the guest
  // (right) — mirrors the fixed numbering used everywhere else in the game.
  const player1 = gameObj.players[1] || {};
  const player2 = gameObj.players[2] || {};

  const myReady = clickedReady || (gameObj.players[playerNumber] || {}).isReady;

  /**
   * Copies the current room URL to the clipboard so it can be shared as an
   * invite link. Shows a transient "Copied!" confirmation for ~2s.
   */
  const handleCopyInvite = () => {
    navigator.clipboard
      .writeText(roomName)
      .then(() => {
        console.log("Invite code copied");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((error) => console.error("Failed to copy invite link:", error));
  };

  return (
    <div className="lobby">
      <p className="lobby-status-line">
        {opponentJoined ? "ROUND 1 · REACTION TEST" : "HOSTING · BEST OF 5"}
      </p>

      <div className="lobby-versus">
        {/* Left seat — host / this player */}
        <div className="player-slot">
          <div className={`player-card ${!opponentJoined ? "player-card--host" : ""}`}>
            <img src={smallLogoImage} alt="" className="player-avatar" />
          </div>
          <span className="player-name">{player1.username || username}</span>
          {opponentJoined && <span className="player-elo">ELO 1184</span>}
          {opponentJoined ? (
            <span className={`player-badge ${player1.isReady || (playerNumber === 1 && clickedReady) ? "player-badge--ready" : "player-badge--waiting"}`}>
              {player1.isReady || (playerNumber === 1 && clickedReady) ? (
                "READY"
              ) : (
                <>
                  WAITING
                  <span className="waiting-dots" aria-hidden="true" />
                </>
              )}
            </span>
          ) : (
            <span className="player-badge player-badge--host">HOST</span>
          )}
        </div>

        <div className={`lobby-vs ${opponentJoined ? "lobby-vs--active" : ""}`}>VS</div>

        {/* Right seat — opponent or empty */}
        <div className="player-slot">
          {opponentJoined ? (
            <>
              <div className="player-card">
                <img src={avatarImage} alt="" className="player-avatar" />
              </div>
              <span className="player-name">{player2.username}</span>
              <span className="player-elo">ELO 1201</span>
              <span className={`player-badge ${player2.isReady || (playerNumber === 2 && clickedReady) ? "player-badge--ready" : "player-badge--waiting"}`}>
                {player2.isReady || (playerNumber === 2 && clickedReady) ? (
                  "READY"
                ) : (
                  <>
                    WAITING
                    <span className="waiting-dots" aria-hidden="true" />
                  </>
                )}
              </span>
            </>
          ) : (
            <>
              <div className="player-card player-card--empty">
                <span className="empty-plus">+</span>
                <span className="empty-label">EMPTY SEAT</span>
              </div>
              <span className="player-name player-name--muted">?</span>
              <span className="player-badge player-badge--open">OPEN</span>
            </>
          )}
        </div>
      </div>

      {opponentJoined ? (
        <>
          <p className="lobby-subtext">First to 3 · Best of 5</p>
          <p className="lobby-hint">
            &gt; {player2.username} has joined · press ready to begin
          </p>
          <button
            className={`lobby-ready-button ${myReady ? "lobby-ready-button--pressed" : ""}`}
            onClick={readyHandler}>
            {myReady ? "You're Ready" : "Ready"}
          </button>
        </>
      ) : (
        <>
          <p className="lobby-hint">
            &gt; waiting for an opponent to join
            <span className="waiting-dots" aria-hidden="true" />
          </p>
          <div className="invite-panel">
            <p className="invite-title">SHARE THIS CODE TO INVITE A FRIEND</p>
            <div className="invite-tiles">
              {roomName.split("").map((char, i) => (
                <span
                  key={i}
                  className={`invite-tile ${
                    i === roomName.length - 1 ? "invite-tile--accent" : ""
                  }`}>
                  {char}
                </span>
              ))}
            </div>
            <div className="invite-actions">
              <button className="invite-copy" onClick={handleCopyInvite}>
                {copied ? "Copied!" : "Copy invite code"}
              </button>
              <button className="invite-share">Share</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Lobby;
