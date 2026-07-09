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
  reaction time only as a tiebreaker if both hit the round-5 cap tied. It then POSTs the
  result to Django's `/update_rank` and waits for the response before emitting `game-end`
  to the room. Django is the source of truth for users/ranks; this server just relays that
  part.
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
  `"game-update"`, `"next-round"`, `"game-end"`, `"player-event"`), but two are
  camelCase (`"tooManyPlayers"`, `"unknownCode"`) — replae these with kebab-case and remove this point accordingly.
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
- The `disconnect` handler (`handleDisconnect`) is fully commented out at the bottom
  of the `connect` block. Players who close the tab are never removed from
  `socketRooms` or their game's `players` map — stale entries accumulate for the
  life of the process. This is a known, currently-accepted gap, not an oversight to
  silently patch.
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