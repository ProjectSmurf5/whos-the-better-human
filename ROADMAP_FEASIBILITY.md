# Roadmap Feasibility Report

A feasibility + sequencing analysis of the six items in the root `CLAUDE.md`
"Current Plans in the future" section. Written against the codebase as it stands
(3 services: React `:3000`, Node/Socket.IO `:4000`, Django REST `:8000` + SQLite/Postgres;
first-to-3 best-of-5 reaction game; all live game state held in-memory in Node).

**Effort:** S = hours · M = 1–2 days · L = several days · XL = 1–2+ weeks
**Risk** reflects blast radius + likelihood of subtle breakage, not difficulty.

---

## TL;DR — recommended priority

The stated list is labelled "order of importance," but importance ≠ execution order.
Two items are much cheaper than their position suggests and **de-risk the expensive ones**,
so I recommend resequencing:

| # | Item | Effort | Risk | My priority | vs. stated |
|---|------|--------|------|-------------|------------|
| A | **Fix disconnect handling** (carved out of "socket refactor") | S–M | Low | **1 — do first** | not listed separately |
| 5 | Remove Elo → win-count leaderboard | S–M | Low | **2** | ▲ up from 5 |
| 1 | Finish UI debt (Rematch button + stubs) | S | Low | **3** | tail of #1 |
| 2 | Django → Supabase migration | L–XL | Med–High | **4** | ≈ same |
| 4 | More game modes (multi-game match) | XL | Med | **5** | ▲ value, big lift |
| 6 | Matchmaking | M | Low–Med | **6 — defer** | ▼ premature |
| 3 | Socket **transport** rewrite | L–XL | Med | **7 — only if needed** | ▼ over-ranked |

**The one-line version:** knock out the two cheap wins (disconnect fix, Elo removal)
first — they're small and they shrink the Supabase migration. Treat "more game modes"
as the real product centrepiece and the biggest lift. Don't rewrite the socket transport
or build matchmaking until something actually forces them.

---

## 1. Major UI Overhaul

**Status:** Screens 1–4 shipped (hero, lobby, live round race, results). The only
remaining mockup screen is #5, "Sequence Memory" — which is **not a UI task, it's a new
game mode** (see item 4). It cannot start until the game-type abstraction exists.

**What's actually left as UI work:** three visual-only stubs the redesign left behind:
- `GameOver`'s **Rematch** button (`console.log` stub) — this is a genuine UX gap: after a
  match you can currently only go "Back to menu."
- `Lobby`'s **Share** button (stub; Copy-invite already works).
- `NavBar`'s corner `>` button (now decorative since the sidebar was removed).

**Feasibility:** The Rematch button is the only one with real value and is **S**. Wiring it
needs a small Node addition (reset an existing room's `state`/`players[].score`/`tooSoon`
back to a fresh round-0 and re-emit `game-update`) — modest, and a natural companion to the
disconnect fix since both touch room-lifecycle logic.

**Recommendation:** Consider the overhaul **done for the current single-game scope.** Fold
"screen 5" into item 4. Optionally spend a few hours wiring Rematch. Don't treat the leftover
stubs as blocking.

**Priority:** Remaining work is **Low**, except Rematch (cheap, worth doing — slot it in as item 3 above).

---

## 2. Migration from Django → Supabase

**What Django does today (the full surface to replace):** `User` + `UserProfile(rank)`
models, DRF **token** auth, five endpoints (`login`/`signup`/`test_token`/`update_rank`/`leaderboard`),
and the Elo math (`calculate_rank`, K=32). Frontend stores the token in `localStorage` and
sends `Authorization: Token <x>`.

**What Supabase gives:** managed Postgres, Auth (JWT/GoTrue), auto-generated REST (PostgREST),
Row-Level Security, and Realtime. It replaces **Django, not Node** — Node stays the authoritative
game server.

**The three real complexity hotspots (in order):**
1. **Auth rework (the bulk of the risk).** DRF-token-in-localStorage → Supabase JS client
   sessions/JWT is a different model that touches signup, login, `test_token`'s "am I logged
   in" check, and every authenticated call. Auth migrations are always where the subtle bugs live.
2. **Homing the business logic.** `update_rank`'s Elo calc has no natural place in Supabase
   (there's no `views.py`). Options: a Postgres RPC function, a Supabase Edge Function (Deno),
   or move it into Node. **This is where item 5 matters enormously:** if Elo is already gone,
   the only server-side logic left is "increment the winner's win count," which is a one-line
   guarded update / trivial RPC. Doing item 5 first turns this hotspot into a non-issue.
3. **Trust boundary.** Decide who writes match results. Cleanest: **Node writes with the
   service-role key** (clients can't forge results), frontend uses the anon key + RLS for
   reads (leaderboard) and its own auth. Avoid letting the browser write ranks/wins directly.

**Security upside (real):** RLS directly closes the documented "no auth on `/update_rank` /
`/leaderboard`" gap, and Supabase Auth eliminates the "signup echoes the plaintext password"
gap by owning hashing. Two known cross-cutting issues die for free.

**Data migration:** export `User`/`UserProfile` rows, import to Supabase Postgres. Presumably
a tiny dataset — **Low** risk.

**Effort:** L–XL. **Risk:** Med–High (auth).

**Recommendation:** Sequence **after item 5** so there's essentially no business logic to
port. Keep Node authoritative and give it a service-role key; frontend does auth + reads only.
Migrate auth in its own PR, separate from the rank/leaderboard reads, so the risky part is isolated.

**Priority:** **Medium.** High value (kills a whole service + two security gaps) but not urgent
unless you're about to expose this publicly. Its cost drops sharply once Elo is gone.

---

## 3. Socket refactoring — stay with Socket.IO or switch?

**Reframe the question.** The pain points aren't the transport — they're:
(a) game state is in-memory in a single Node process (no restart survival, no horizontal scale);
(b) the `disconnect` handler is commented out; (c) there's no reconnect-into-an-active-game path.
Socket.IO itself is a perfectly good fit for 1v1 realtime. **Don't rewrite the transport for its own sake.**

**Fixes, cheapest-first:**
- **(A) Re-enable + finish `handleDisconnect`.** *This is the urgent one* and I've pulled it to
  the top of the roadmap. It's a known correctness gap, and the frontend's "opponent may have
  disconnected" banner is currently *faking* what the server should authoritatively detect
  (forfeit the round/match, notify the opponent, free the room). **S–M.**
- **(B) Redis adapter + room state in Redis** — only when you actually run more than one Node
  instance. Socket.IO's Redis adapter is the standard answer; keep it in the back pocket. **M–L.**
- **(C) Colyseus** (authoritative Node game-server framework) — worth evaluating **only if items
  4 and 6 both land**, because it provides rooms + authoritative state sync + built-in
  matchmaking, absorbing the plumbing of items 3/4/6 at once. But it's a real rewrite. **XL.**

**Explicitly not recommended:** replacing Socket.IO with **Supabase Realtime**. That's pub/sub
over DB changes + broadcast — it has no authoritative game loop, and this game's whole point is
server-authoritative timing/scoring (the STEADY/CLICK timers, the score comparison). Keep Node authoritative.

**Effort/Risk:** Split it. Disconnect fix = **S–M / Low**. Transport rewrite = **L–XL / Med**.

**Recommendation:** Do (A) now as a standalone correctness fix. Defer (B)/(C) until scaling pain
or a Colyseus adoption driven by items 4+6 actually materialises.

**Priority:** Disconnect fix = **High**. Transport rewrite = **Low** (deferred).

---

## 4. Adding more game modes (best-of-3 games × 3 rounds; Type Racer, Reaction, +1)

**This is the architectural centrepiece and the biggest lift.** Today *everything* hardcodes
reaction-time scoring:
- `handlePlayerScore` takes a single `{score, tooSoon}` number;
- `getRoundWins` hardcodes **"lower time wins"** (duplicated in `backend/utils.js` and
  `frontend/src/utils/functions.js`);
- the Timer-1 (STEADY) / Timer-2 (CLICK) loop is reaction-specific;
- `RoundResult`/`GameOver` render millisecond times.

**What generalising requires:**
1. **A game-type registry.** Each type declares: its client play component + timing, its score
   *shape* (Reaction = `{ms, tooSoon}`; Type Racer = `{wpm, accuracy}`; a Sequence game =
   `{levelReached}`), its **round-winner comparator** (lower-better for time, **higher-better**
   for levels — the current hardcoded comparator can't express that), and its result display.
2. **Generalise `getRoundWins`** to take a per-type comparator, keeping the two copies in sync
   (already a documented duplication seam).
3. **A nested match structure.** Today: best-of-5 rounds of *one* game. Target: *3 games × 3
   rounds* = match → game → round. That's a real state-model change in Node and a bigger results
   screen — **but the mockup already designed for exactly this** (screen 6's per-game round cards:
   Reaction / Quick Math / Type Racer / Sequence / Bullet Chess), so the UI direction is settled.

**Payoffs:** unblocks UI screen 5, and finally gives the hero-screen mode tags and the results-card
layout real meaning instead of being decorative.

**Effort:** XL. **Risk:** Medium — mostly *additive* if the abstraction is clean up front; the
risk concentrates in retrofitting the match→game→round structure and in touching the
frontend/backend `getRoundWins` pair in lockstep.

**Recommendation:** Stage it. (i) Introduce the game-type interface with **Reaction as the first
implementation, refactor-in-place, zero behaviour change** — pure groundwork. (ii) Add **one**
second game (Type Racer is the most self-contained) to *prove* the abstraction. (iii) Only then
generalise the match structure to 3×3. Resist building all games at once.

**Priority:** **High** (it's the product's spine and the reason the whole revamp exists), but
sequence it *after* the cheap wins and ideally after the Supabase decision, since it's the item
most likely to churn the data model.

---

## 5. Remove Elo → win-count leaderboard

**The smallest, most contained item — and a de-risker for item 2.**

**Exact surface:**
- `UserProfile` gains a `wins` field (one migration; `rank` can stay or be dropped later).
- `update_rank` → increment the winner's `wins` (draw = no-op; **the draw path is already
  handled** end-to-end from the earlier win-condition work). The Elo math (`calculate_rank`) is deleted.
- `leaderboard`'s `order_by('-rank')` → `order_by('-wins')`.
- Frontend strips Elo display — and this is *already minimal*: the `GameOver` Elo line, the
  `HeroPage` rank readout, and the `Lobby`'s decorative `ELO 1184`/`1201` labels (the last are
  cosmetic placeholders anyway).

**Effort:** S–M. **Risk:** Low.

**Caveat worth a decision:** raw win-count rewards *volume* of play over skill (someone who plays
1000 games beats a better player who played 50). If that bothers you, consider win-rate or showing
games-played alongside. Simple total-wins is fine to ship first.

**Recommendation:** Do this **early.** It's a quick, low-risk win on its own, and critically it
removes the only real business logic Django holds — which is what makes the Supabase migration cheap.

**Priority:** **High** (moved up from stated #5).

---

## 6. Matchmaking instead of party invite

**Current:** create room → share 5-char code → join by code. This is a *party-invite* model and
it's genuinely good for "play with a friend."

**Matchmaking = an auto-pairing queue.** A simple FIFO queue is easy in the current single-process
Node (`waitingQueue` array; when two players are waiting, spin up a room and emit to both). It gets
harder exactly where item 3 does: with more than one Node instance it needs shared queue state
(Redis), and Colyseus would provide it for free — so items 3/4/6 are coupled.

**Two honest constraints:**
- **Skill-based matchmaking needs a rating** — but item 5 *removes* Elo. So SBMM is off the table
  unless you deliberately keep a hidden rating. Realistic scope is **random / FIFO** pairing.
- **Matchmaking only shines with concurrent player volume.** A queue that never fills (because
  nobody else is online) is *worse* UX than an invite link. For a project without an active
  userbase, matchmaking is premature.

**Effort:** M (simple FIFO). **Risk:** Low–Med.

**Recommendation:** **Add** matchmaking *alongside* invites, don't replace them — keep the invite
flow for friends, offer "Find Match" for strangers. Build it only once there's enough concurrent
traffic to make a queue fill, and after the game-type work (so it knows *what* to match on).

**Priority:** **Low–Medium / defer.**

---

## Dependency graph & sequencing rationale

```
A. Disconnect fix ───────────────► (unblocks honest forfeit + Rematch room-reset)
5. Remove Elo ───────┐
                     ├──► 2. Supabase migration (cheap once Elo logic is gone)
1. Rematch/stubs ────┘
4. More games ──────► completes UI screen 5, gives mode-tags/result-cards meaning
                └──► precedes 6 (matchmaking must know which game to match on)
3. Transport rewrite (Redis/Colyseus) ── only if scaling pain, or adopted *with* 4+6
6. Matchmaking ── after 4, and only once player volume justifies it
```

**Where I diverge from the stated "order of importance," and why:**
- **Elo removal (their #5) jumps to near-top:** it's a few hours of low-risk work and it's the
  single biggest cost reducer for the Supabase migration. Cheap + unblocking = do it early.
- **"Socket refactor" (their #3) splits in two:** the *disconnect fix* inside it is urgent (a real
  bug the UI is papering over); the *transport rewrite* is not — Socket.IO is fine until you have a
  scaling or multi-instance reason.
- **Matchmaking (their #6) drops further:** it's premature without concurrent players and can't be
  skill-based once Elo is gone.
- **More games (their #4) stays high** — it's the actual product vision and everything visual in the
  mockup points at it — but it's XL, so it follows the cheap de-risking work rather than leading.

**Suggested first sprint (all Low-risk, high-leverage):** finish `handleDisconnect` → remove Elo /
switch leaderboard to wins → wire the Rematch button. That clears a real correctness bug, deletes
two known security gaps' worth of surface (via making the eventual Supabase move trivial), and closes
the most visible UX gap — before committing to any XL rewrite.
