# Frontend (React) — CLAUDE.md draft

## Stack
- Create React App (react-scripts 5), React 18, react-router-dom v6
- axios for REST calls to a Django backend
- socket.io-client for real-time game state (separate Node/Express+Socket.IO server)
- No CSS framework — plain per-component CSS files, no CSS modules/styled-components/Tailwind
- No state management library — all shared state is lifted into `App.js`

## Architecture
- `App.js` (`AppRoutes`) is the single source of truth for shared state: `gameObj`, `user`,
  `leaderboard`, `playerNumber`, `loggedIn`, `errorMessage`. All mutating logic
  (`handleLogin`, `handleSignIn`, `handleMainMenu`, `validateUser`, `getLeaderboard`, ...)
  lives here and is passed down to route components as props.
- Route components (`SignUp`, `Login`, `Leaderboard`, `HeroPage`, `Game`, ...) are mostly
  presentational — they hold local form/UI state (`useState`) but call back up to `App.js`
  handlers for anything that touches the network or global state, rather than calling
  axios themselves.
- Real-time game flow goes through the socket singleton in `src/socket.js`, imported
  directly wherever needed (`Game.jsx`, `HeroPage.jsx`) rather than passed as a prop.
  Socket listeners are registered in a `useEffect` with an empty dependency array and
  torn down via `socket.off(...)` in the cleanup function.
- Two backends: a Django REST API for auth/leaderboard/rank (`REACT_APP_DJANGO_API_URL`)
  and a Node/Socket.IO server for live game rooms (`REACT_APP_SOCKET_URL`).
- `Game.jsx` gates its render on the match state: when `gameObj.state.currentRound === 0`
  (and not finished) it shows the pre-game **`Lobby`** component (design screens 2 & 3 —
  "waiting for opponent" when `numPlayers === 1`, "ready to start" when `2`); once the
  first round begins (`currentRound >= 1`) it renders the live round view. `Lobby` is
  presentational and reuses `Game`'s existing `readyHandler`/`clickedReady` — it adds no
  new socket events.
- Known lobby limitation: the Node server's `handleJoinRoom` only sends `game-update` to
  the joining socket, so the **host stays on screen 2 until the guest presses Ready** (the
  first room-wide `game-update`), then flips to screen 3. Fixing this (instant host flip on
  join) is a backend/`server.js` change, deliberately out of scope for the frontend overhaul.
- **Live round view (design screen 3)**: within an active round, `Game.jsx` further gates
  on local state, not just `gameObj`: `myLastScore === null` → `<ReactionBox>` (STEADY/CLICK
  click-target only); once the local player has a score for the round (`myLastScore` set in
  `clickHandler`/the timer-2 auto-miss branch) → `<RoundResult>`, which shows that score
  immediately and the opponent's once `gameObj.players[opponentNumber].score` catches up to
  the current round (i.e. once the server's `game-update` for that round arrives — the
  opponent's own score is otherwise invisible client-side until then). `RoundResult` also
  hosts the next-round `<ReadyButton>`, now gated on `roundResultReceived` (both scored) —
  a small intentional tightening, since the button previously had no such gate. A
  `showOpponentWaitBanner` heuristic (9s timeout, see `OPPONENT_WAIT_TIMEOUT_MS` in
  `Game.jsx`) shows a soft "opponent may have disconnected" message with a manual
  "Back to menu" escape if the opponent's score never arrives — **not real forfeit
  detection**, the Node disconnect handler is still commented out (see `backend/CLAUDE.md`).
- **Match results (design screen 4)**: `GameOver` takes `{ gameObj, playerNumber,
  handleMainMenu }` (not individual pre-extracted fields, matching the `Lobby` prop
  pattern) and derives everything else — round-win tally, fastest-reaction/closest-round
  stats, the round-outcome pip strip — from `gameObj.players[1].score`/`[2].score` via
  `getRoundWins` (`src/utils/functions.js`). Elo display is untouched from before this
  redesign (no new rank tile) — Elo is slated for removal in a later roadmap phase per the
  root `CLAUDE.md`, so it wasn't worth building further UI around.
- **The old right-hand sidebar (score table + chat) was removed entirely** — it wasn't part
  of any mockup screen and its data (hardcoded "Player 1"/"Player 2" headers, an unstyled
  chat feed) predated this redesign. `showSideInterface`/`toggleSideInterface` state, the
  `"chat"`/`"player-event"` socket listeners, and the corresponding `App.css` rules
  (`.side-interface-container`, `.table-container`, `.chat-*`) are gone. `NavBar`'s corner
  `>` button remains (it's in every room screen in the mockup) but is now purely
  decorative/visual-only — there's nothing left for it to toggle.
- **Win condition changed**: the match is now decided by first-to-3 round wins (best of 5),
  not average reaction time — see `backend/CLAUDE.md` for the server-side half of this
  change. `getRoundWins(scores1, scores2)` is duplicated (frontend `src/utils/functions.js`
  and `backend/utils.js`) since the two run in different runtimes; keep both in sync if the
  win-target or scoring rule ever changes.
- **Player 1 (host) is always the white stick figure (`wtbh-logo-white.png`), player 2
  (challenger) always the black one (`wtbh-logo.png`)** — a fixed scheme, not "me vs
  opponent." `Lobby.jsx` assigns these directly per player slot; `Game.jsx` resolves
  them via `avatarForPlayer(playerNum)` and passes `myAvatar`/`opponentAvatar` into
  `RoundResult` (which stays presentational and doesn't decide the mapping itself).
- **`"player-score"` socket payload changed shape**: `{ score, tooSoon }`, not a raw
  number — see `backend/CLAUDE.md`. `tooSoon` is only true for an early click; a
  timeout miss sends the same `score: 1000` but `tooSoon: false`. `RoundResult` reads
  the opponent's reason from `gameObj.players[opponentNumber].tooSoon[roundIndex]`
  (passed down as `opponentTooSoon`) rather than guessing from the score value — the
  two cases used to be visually indistinguishable since both score exactly 1000.
- Design tokens: the overhaul palette lives as `:root` CSS variables in `index.css`
  (`--terracotta`, `--petrol`, `--petrol-deep`, `--yellow`, `--rust`, `--cream`), plus two
  shared button classes (`.pill-button--filled`/`.pill-button--outline`) and a shared
  `.waiting-dots` loading-dots animation used by `Lobby` and `RoundResult`. Older rules
  still use hardcoded `#1c3235`/`#d2ab99`; prefer the variables in new/edited CSS. Display
  font is **Shrikhand** (loaded via a single `<link>` in `public/index.html`) — the revamp
  mockup's "Bevan" was intentionally not adopted.

## Conventions actually in use
- Function components with props destructured in the signature, e.g.
  `function SignUp({ handleSignIn }) { ... }`. 
- Every component does `export default ComponentName` at the bottom; no named exports.
- Each component imports a co-located CSS file: `import "./ComponentName.css"`.
- Debug tracing via `console.log`/`console.error` is the norm, not the exception —
  socket events, handler entry points, and effect updates are logged liberally
  (see `Game.jsx`, `socket.js`, `HeroPage.jsx`). Keep this pattern when adding new
  handlers/socket listeners rather than stripping logs.
- Inline arrow functions for simple input handlers (`onChange={(e) => setX(e.target.value)}`),
  named functions for anything with real logic.
- Env vars follow the CRA `REACT_APP_*` convention and are read with a hardcoded
  localhost fallback, e.g. `process.env.REACT_APP_DJANGO_API_URL || "http://..."`.

## Known inconsistencies (be aware, don't silently "fix" without asking)
- CSS class naming is split between kebab-case (`signup-container`, `nav-container`,
  most components) and camelCase (`heroPage`, `leaderboardButton`, in `HeroPage.jsx`
  / `HeroLoginSignUp.jsx`). No enforced convention yet.

## When making changes
- New shared/cross-page state → add to `App.js`, pass down as props (don't reach for
  Context/Redux, that's not the pattern here).
- New real-time behavior → extend the socket event contract in both
  `frontend/src/socket.js`-consuming components and `backend/server.js` together.
- New REST calls → go through the Django backend (`backend/django-backend`), not the
  Node server, which only handles Socket.IO game logic.
