# whos-the-better-human — CLAUDE.md

Root doc for the whole repo. Service-specific detail lives in each subdirectory's
own `CLAUDE.md` — read this first for the big picture, then the relevant sub-doc
before touching that service:

- [`frontend/CLAUDE.md`](frontend/CLAUDE.md) — React client
- [`backend/CLAUDE.md`](backend/CLAUDE.md) — Node/Socket.IO realtime server
- [`backend/django-backend/CLAUDE.md`](backend/django-backend/CLAUDE.md) — Django REST API

## What this is (CURRENT MVP)
A real-time 1v1 reaction-time game: two players join a room and react to an on-screen
cue as fast as they can over up to 5 rounds. The match is decided by first-to-3 round
wins (best of 5) — the faster reaction time each round scores a point; a full 5-round
tie falls back to average reaction time, then to a draw. Results feed an Elo-style rank
per user, shown on a leaderboard.

## Current Plans in the future (Order of Importance)
- Major UI Overhaul (see WHOSTHEBETTERHUMAN Revamp.png) — screens 1-4 done (hero,
  pre-game lobby, live round race, match results); the mockup's screen 5 ("Sequence
  Memory" minigame) is a future-game preview and hasn't been started, since no second
  game mode exists yet (see the "Adding more games" item below).
- Migration from Django to a better persistent backend,
most likely supabase.
- Refactoring of using socket for game room management,
suggest if I should stay with socket or use other libraries.
- Adding more games ideally best of 3 games with 3 rounds each. (Type Racer, Reaction Time and something else not confirmed.)
- Remove ELO System for now and leaderboard is based on
amount of wins
- Implement a matchmaking system instead of a party invite system.

## Services & how they talk to each other
Three independently-deployable services, each with its own runtime and its own
`package.json`/`requirements.txt`:

```
Browser (React, :3000)
   │  REST (axios)                     │  WebSocket (socket.io-client)
   ▼                                    ▼
Django REST API (:8000)  ◄── axios ──  Node/Socket.IO server (:4000)
   │
   ▼
SQLite (dev) / Postgres (prod, via DATABASE_URL)
```

- **Frontend** never talks to Django directly for game state — it goes through the
  Node server's sockets for anything realtime (rooms, rounds, scores), and axios to
  Django for anything persistent (signup/login/leaderboard).
- **Node server** holds no persistent state itself. It's a relay: it manages
  in-memory game rooms and, when a game ends, calls Django's `/update_rank` to
  persist the result, then relays Django's response back to the room over the
  socket.
- **Django** is the only service with a database. It owns users, auth tokens, and
  ranks, and is the source of truth for the leaderboard.

Each service's env vars point at the others — if routing breaks, check these first:

| Var | Used by | Points at |
|---|---|---|
| `REACT_APP_DJANGO_API_URL` | frontend | Django (:8000) |
| `REACT_APP_SOCKET_URL` | frontend | Node server (:4000) |
| `DJANGO_API_URL` | Node server | Django (:8000) |
| `FRONTEND_URL` | Node server | frontend (:3000), for CORS |
| `DATABASE_URL` | Django | Postgres in prod, SQLite fallback locally |

Local dev needs all three running at once (`frontend`, `backend`, and
`backend/django-backend`, each in its own terminal/venv) — there's no single
top-level script that boots all of them yet.

## Cross-cutting issues (span more than one service — check the relevant sub-CLAUDE.md for full detail before touching)
- **The win-condition logic spans two services on purpose.** Node's `server.js` decides
  the match winner (first-to-3 round wins via `getRoundWins`, `backend/utils.js`); Django's
  `/update_rank` had to gain a small guard for the resulting "Draw" case becoming
  realistically reachable. If you ever touch how a match is decided (win target, round
  count, tiebreak), check both `backend/CLAUDE.md` and `backend/django-backend/CLAUDE.md`,
  not just one.
- **`/update_rank` and `/leaderboard` have no auth** on the Django side — anyone who
  can reach the Django service can rewrite any two users' ranks. Currently only
  "protected" by the fact that the Node server is the only expected caller.
- **Signup echoes the plaintext password** back in the API response
  (`UserSerializer` doesn't mark `password` `write_only`) — see
  `backend/django-backend/CLAUDE.md`.
- **`CSRF_TRUSTED_ORIGINS` is malformed** in Django settings (missing comma between
  two URL strings → they concatenate into one invalid entry).
- **Player disconnects aren't cleaned up** on the Node server — closing a tab
  mid-game leaves stale entries in its in-memory room state.
- API base URL fallbacks have drifted inconsistently across frontend files in the
  past (one file defaulted to the Node port instead of Django's) — this already
  caused a real 404-then-500 bug chasing signup. Double check env var fallbacks
  match the table above whenever you touch them.

None of the above should be "fixed" silently as a side effect of an unrelated
change — call them out and confirm before touching them, since some may be
deliberate (if under-documented) trade-offs for a small project rather than
oversights.

## Conventions for major changes
"Major" = anything that changes a function's contract, replaces an existing
approach, or would surprise someone reading a diff without this context (new
socket event, new endpoint, new persisted field, swapping how something is stored
or computed, etc.). Small fixes/tweaks don't need this treatment — don't add
ceremony to a one-line bug fix.

1. **Block-comment new or changed functions that are part of the change.**
   Above the function, in plain language:
   - what it does and why it exists (not a restatement of the code)
   - each parameter: name, expected shape, and any non-obvious constraint
   - what it returns / emits, including error or edge-case behavior if relevant

   Example shape (adapt to the language's normal doc-comment style — JSDoc for JS,
   docstrings for Python):
   ```js
   /**
    * Ends the current round and computes both players' next Elo rank via Django.
    * Called once both players have submitted a score for the round.
    *
    * @param {object} currentGame - in-memory game object for this room (see newGameObj)
    * @param {number} thisPlayerId - 1 or 2, the player who just triggered this call
    * Emits "game-end" to the room with the updated game object once Django responds.
    */
   ```

2. **When replacing an existing approach, say what it replaces and why**, right
   next to the change — a comment if it's localized, or in a summary md file.
   if it spans files. Cover:
   - **Old:** what the previous approach did (one or two lines)
   - **New:** what's different and the concrete reason (bug it fixes, limitation it
     removes, requirement that forced it)
   - **Migration:** anything that needs to happen for existing data/state/callers
     to keep working (e.g., a migration file, a required env var, a socket event
     rename that both frontend and backend need updated together)

3. **Update the relevant sub-`CLAUDE.md`** if the change invalidates something it
   documents — a "Known gap" that got fixed, a convention that changed, a new env
   var. Treat these docs as living, not written-once.

4. **Cross-service changes get called out explicitly.** Since frontend, Node, and
   Django are three separate deployables with no shared type system, a change that
   touches a socket event payload or a REST response shape should say, in the
   summary md file, which other service(s) also need updating and whether
   they were updated in the same change or need a follow-up.
