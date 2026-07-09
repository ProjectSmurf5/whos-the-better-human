# Backend — Node/Socket.IO

Scope: `backend/server.js` + `backend/utils.js` (the socket/game-room server).
The Django REST API lives in `backend/django-backend/` and should get its own
CLAUDE.md — this one is just for the realtime layer.

## Stack
- Express 5 wrapped in a plain `http.createServer`, with `socket.io` v4 attached to
  the same HTTP server (not a separate port).
- `cors` configured twice, independently: once for Express routes, once for the
  Socket.IO server — origin switches on `NODE_ENV` (prod: hardcoded Render URL,
  dev: `"*"`).
- `axios` used only to call out to the Django backend (`DJANGO_API_URL`), never to
  talk to a database directly.
- No framework beyond that — single file, no Express Router, no controllers/routes
  split, no ORM. `nodemon` for dev (`npm run dev`), plain `node server.js` for prod.

## Architecture
- **This server has no database and no persistent storage.** All game-room state
  lives in two module-scope JS objects: `socketRooms` (socket.id → roomName) and
  `getGameObjFromRoom` (roomName → game state). It's entirely in-memory — a restart
  wipes every in-progress game, and this can't be horizontally scaled without adding
  a shared store (Redis pub/sub or similar), since two instances wouldn't see each
  other's rooms.
- Game/player state shape comes from factory functions (`newGameObj(roomName)`,
  `newPlayerObj()`), not classes.
- All socket event handlers are declared as closures nested inside the single
  `io.on("connect", (socket) => {...})` callback (`handleJoinRoom`, `handleNewRoom`,
  `handlePlayerReady`, `handlePlayerScore`). They capture `socket` via closure rather
  than taking it as a parameter — keep new handlers consistent with this pattern
  rather than pulling them out to module scope.
- This server decides the match winner but does not persist rankings. `handlePlayerScore`
  decides the match via `getRoundWins` (`backend/utils.js`) — first-to-3 round wins,
  best of 5 (`WINS_TO_CLINCH`/`NUMBEROFROUNDS` constants), falling back to average
  reaction time only as a tiebreaker if both hit the round-5 cap tied.
- Ending a match (POST the decided result to Django's `/update_rank`, then emit `game-end`
  to the room once Django responds) is centralised in the **`finalizeGameEnd(currentGame,
  roomName, endingPlayerId)`** helper. The caller sets `state.result.winner`/`.loser` first;
  `finalizeGameEnd` handles the Django round-trip and the emit. Two callers share it:
  `handlePlayerScore` (normal finish) and `handleDisconnect` (forfeit). Django is the
  source of truth for users/ranks; this server just relays that part.
- **Rematch reuses the same room.** `handleRematch` marks the requester's `wantsRematch`
  (a `newPlayerObj` field); once *both* players have opted in, `resetGameForRematch` wipes
  the per-round state (scores, tooSoon, isReady, eloDiff, result) but keeps the same room +
  usernames/slot mappings, sets `currentRound = 1`, and the room emits `game-update` +
  `next-round` — the same pair `handlePlayerReady` fires at match start, so both clients drop
  **straight into round 1, skipping the lobby ready screen**. Guarded on `result.winner`
  being set (only rematch a genuinely finished match). A single opt-in isn't broadcast — the
  requesting client shows its own "waiting for opponent" state optimistically. Reuses
  existing events, so the only frontend change was wiring the results-screen button.
- **Disconnect handling forfeits in-progress matches.** `handleDisconnect` (now live) has
  two paths: mid-match (a round started, no result yet, opponent still present) → set the
  remaining player as winner and end via `finalizeGameEnd` so they land on the results
  screen instead of hanging; otherwise (lobby, or already-ended) → remove the leaver, drop
  the room if it's now empty, else emit `game-update` so a waiting host falls back to
  screen 2. It reuses existing events (`game-end`/`game-update`), so no frontend change was
  needed. `handlePlayerScore` also guards against a stray score arriving after a result is
  already set (would otherwise read a score array off a missing player).
- **Round-win counting needs no new socket payload fields.** `getRoundWins` derives
  wins purely from the existing `players[1].score`/`players[2].score` arrays (pairwise
  comparison, lower time wins, equal is a push) — both this server and the frontend
  (`frontend/src/utils/functions.js` has an intentionally duplicated copy) compute it
  identically from data that was already being sent.
- **`"player-score"` payload changed shape.** Old: a raw ms number. New:
  `{ score, tooSoon }` — `tooSoon` is true only for an early click (clicked during
  STEADY), false for a real reaction *and* for a timeout miss (both of which also
  score the same 1000ms penalty and were previously indistinguishable). `score` is
  still pushed to `players[N].score` exactly as before — round-win/match-win logic
  is unaffected by *why* a 1000 happened. `tooSoon` is pushed to a new parallel
  `players[N].tooSoon` array (see `newPlayerObj()`) purely so the frontend can show
  the accurate reason instead of guessing from the score value.
- `GET /` doubles as a Django keep-alive ping (fires `axios.get(API_URL + "leaderboard")`
  on every hit) — this is intentional, likely to stop the Django service from
  idling/sleeping on Render's free tier, not dead code.

## Conventions actually in use
- Heavy `console.log` debug tracing, often prefixed `[Debug] ...` — same style as the
  frontend, keep it when adding new handlers.
- Room capacity is hardcoded at 2 players (`numsockets >= 2` check in `handleJoinRoom`).
- Round count and win target are top-of-file constants: `NUMBEROFROUNDS = 5` and
  `WINS_TO_CLINCH = 3`, under a `// SERVER WIDE SETTINGS` comment — add new server-wide
  tunables there.
- Socket event names are mostly kebab-case strings (`"join-room"`, `"player-ready"`,
  `"player-score"`, `"rematch"`, `"game-update"`, `"next-round"`, `"game-end"`,
  `"player-event"`), but two are camelCase (`"tooManyPlayers"`, `"unknownCode"`) — replae
  these with kebab-case and remove this point accordingly.
- No input validation on socket payloads beyond a truthy check on `roomName` in
  `handleJoinRoom` — `handleNewRoom` doesn't validate `username` at all, for example.
  Don't assume payloads are sanitized upstream.

- A tied match (`wins1 === wins2` at the round-5 cap, falling through the average-time
  tiebreak to still-equal) sends `{winner: "Draw", loser: "Draw"}` to Django's
  `/update_rank`. The `.then` handler checks `response.data.draw` before touching
  `.winner`/`.loser` — Django now short-circuits and returns `{draw: true}` for that case
  instead of 404ing (see `backend/django-backend/CLAUDE.md`). Under the old average-time
  win condition this was a near-impossible float-equality tie; under first-to-3 round wins
  a 2-2-with-a-push tie is realistic, so this path is now genuinely reachable, not just
  theoretical.

## Known gaps (be aware, don't silently "fix" without asking)
- `handleDisconnect` cleans up on *disconnect*, but a **forfeit-ended room is not torn
  down** (same as a normally-ended room — the game object lingers in `getGameObjFromRoom`
  until the process restarts). Only the fully-empty-room case deletes the room record.
  Rooms therefore still accumulate over the process lifetime for *completed* matches; this
  is the residual of the old "stale rooms" gap, now narrowed to ended-but-not-emptied rooms.
- Disconnect detection is Socket.IO's transport-level `disconnect` only — a frozen/hung tab
  that never actually drops the socket won't trigger it. The frontend's opponent-wait banner
  (`OPPONENT_WAIT_TIMEOUT_MS` in `Game.jsx`) is the client-side backstop for that case.
- **"Back to menu" doesn't leave the socket room** (frontend `handleMainMenu` just navigates,
  no leave/disconnect event) — a pre-existing quirk now visible via rematch: if player A
  clicks Rematch then Back to menu, their `wantsRematch` stays set, so when B clicks Rematch
  the room resets and the `next-round`/`game-update` broadcast yanks A (still socket-joined)
  back into the fresh game via App.js's game-update navigation. Fixing it properly needs a
  real "leave room" event/protocol (out of scope for the rematch change).
- No error handling middleware and no try/catch around most socket handlers — a
  thrown error inside a handler (e.g. `currentGame` being `undefined` if state got
  out of sync) will surface as an unhandled exception rather than a clean error to
  the client.

## When making changes
- New game-state fields → add to both `newGameObj`/`newPlayerObj` factories, and
  make sure they're included wherever `game-update`/`game-end` payloads are emitted,
  since the frontend (`Game.jsx`) reads this shape directly off the socket payload.
- New socket events → register inside the `io.on("connect", ...)` block alongside
  the existing handlers, and update the frontend's `socket.on(...)` listeners in
  `frontend/src/socket.js`-consuming components to match.
- Anything involving persisted data (users, ranks, leaderboard) → goes through the
  Django backend via axios, not this server directly.