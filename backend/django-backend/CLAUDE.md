# Backend — Django REST API — CLAUDE.md draft

Scope: `backend/django-backend/`. This is the persistence/auth layer — users, ranks,
leaderboard. The Node/Socket.IO realtime layer (`backend/server.js`) is documented
separately and calls into this service over HTTP.

## Stack
- Django 5.2 + Django REST Framework, DRF Token auth (`rest_framework.authtoken`).
- SQLite locally (`db.sqlite3`, via `dj_database_url` fallback), swaps to whatever
  `DATABASE_URL` points at in prod (Postgres on Render, per the earlier CLAUDE.md
  work on this repo).
- `django-cors-headers` for CORS, `whitenoise` for static file serving in prod,
  `gunicorn` as the prod WSGI server (see `build.sh` / `Procfile`-equivalent).

## Architecture
- **No separate Django "app"** — this was scaffolded as `startproject server .`
  and the models/views/serializers/urls were added straight into the `server/`
  project package, which is also what's registered in `INSTALLED_APPS`. There's no
  `startapp`-created module. Keep new endpoints in this same package unless you're
  deliberately restructuring into multiple apps.
- Views are plain DRF function-based views with `@api_view([...])`, not
  viewsets/routers/class-based views. Every POST view is also `@csrf_exempt`, since
  this is a stateless token-auth API called cross-origin, not session/form-based.
- Endpoints (`server/urls.py`):
  - `POST /login` — checks password, returns/creates a token.
  - `POST /signup` — creates a `User` (+ auto-created `UserProfile` via signal),
    returns a token.
  - `GET /test_token` — the only endpoint that actually enforces auth
    (`TokenAuthentication`/`SessionAuthentication` + `IsAuthenticated`).
  - `POST /update_rank` — called by the Node server after a game ends; recomputes
    Elo for winner/loser and persists it. A `{winner: "Draw", loser: "Draw"}` body
    (a tied match) short-circuits to `{draw: true}` before the rank lookup, rather
    than 404ing on a nonexistent "Draw" user — see Known gaps below for why this
    got more likely to actually happen and needed a guard.
  - `GET /leaderboard` — all `UserProfile`s ordered by rank.
- `UserProfile` (one-to-one with `User`, default `rank = 1200`) is created
  automatically by a `post_save` signal on `User` (`server/models.py`) — you never
  create a `UserProfile` directly; it's implicit whenever a `User` is created.
- Elo math lives inline in `views.py` (`calculate_rank`, standard K-factor formula,
  `k=32` hardcoded default) rather than in a separate service/module — it's small
  enough that it hasn't been split out yet.
- Manual API testing is done via `.rest` scratch files (`server/test.rest`,
  `test.rest` at the project root) rather than a test suite — there's no
  `tests.py` coverage currently, these are just REST Client examples for local use.

## Conventions actually in use
- `re_path(...)` used for every route instead of `path(...)`, with bare strings and
  no anchors — e.g. `re_path('login', views.login)`. Django resolves these with
  `re.search`, not an exact match, so these patterns match as a substring anywhere
  in the URL, not just an exact `/login` path. New routes should follow the same
  `re_path('name', views.name)` style for consistency, but be aware this means route
  order and naming can shadow/collide (see gaps below).
- `login` uses `Token.objects.get_or_create(...)`; `signup` uses
  `Token.objects.create(...)` (no `get_or_create`) — asymmetric on purpose, since a
  brand-new user shouldn't already have a token, but keep this in mind if you ever
  call `signup` logic a second time for the same user.
- Env-driven settings via `os.environ.get(...)` with local-dev-friendly defaults
  (`DJANGO_DEBUG`, `DJANGO_SECRET_KEY`, `DATABASE_URL`) — same pattern as the
  Node/React sides of this repo.

## Known gaps / bugs (flag before "fixing" silently — some may be intentional trade-offs, some are just bugs)
- **Security bug:** `UserSerializer` (`server/serializers.py`) includes `password`
  in `fields` without `write_only=True`, and `signup`'s response body includes
  `serializer.data` — meaning the plaintext password submitted at signup is echoed
  back in the API response. This should be fixed (mark `password` `write_only`, or
  exclude it from the response serializer).
- **Config bug:** `CSRF_TRUSTED_ORIGINS` in `settings.py` is missing a comma between
  its two entries, so Python concatenates them into a single malformed string
  instead of a 2-item list — neither production origin is actually trusted as
  written.
- **No auth on `/update_rank` or `/leaderboard`.** `/update_rank` accepts any
  `{winner, loser}` usernames from an unauthenticated caller and mutates both
  users' ranks — currently only "protected" by obscurity (only the Node server is
  expected to call it), not by any shared secret or auth check.
- **Fixed:** `/update_rank` used to `get_object_or_404` on the literal username
  `"Draw"` whenever a match tied, 500ing since no such user exists. Node's game
  win condition changed (round-tally first-to-3 instead of average time, see
  `backend/CLAUDE.md`) made a real tie meaningfully more likely to occur, so this
  is now guarded: a `"Draw"` winner/loser short-circuits to `{draw: true}` before
  the lookup, no rank change, no error.
- Unanchored `re_path` routing (see above) means a new route whose name is a
  substring of an existing one (or vice versa) could shadow it depending on
  declaration order — double check `urlpatterns` ordering when adding routes.
- `ALLOWED_HOSTS` is defined twice in `settings.py` (identical both times) — the
  second definition silently overwrites the first; harmless today but redundant.
- `db.sqlite3` ships in the repo as a tracked file (per earlier debugging in this
  project, it was present but unmigrated) — worth double-checking it's meant to be
  version-controlled at all, since SQLite files are usually gitignored to avoid
  committing local data/schema drift.

## When making changes
- New persisted fields (e.g. on `User`/`UserProfile`) → add a migration
  (`python manage.py makemigrations`) and commit it under `server/migrations/`.
- New endpoints → add the view in `views.py`, wire it in `urls.py` with the same
  `re_path('name', views.name)` style, and if it's meant to be public/internal-only,
  explicitly decide on `@authentication_classes`/`@permission_classes` rather than
  leaving it open by default.
- Anything the Node server needs (new computed fields, new actions) → this is the
  side that should own the logic; Node just calls it via axios and relays results
  over the socket.