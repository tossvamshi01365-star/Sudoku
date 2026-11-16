# API (Express + TypeORM + PostgreSQL on Supabase)

Our own auth: Supabase is used **only as the PostgreSQL database**. Supabase Auth is not used.

## Run locally

1. `cp .env.example .env` and fill in:
   - `DATABASE_URL`: Supabase Dashboard → **Connect** → "Session pooler" connection string (or a local Postgres URL).
   - `DATABASE_SSL=true` and `DATABASE_SSL_CA_FILE` for Supabase (Project Settings → Database → SSL Configuration → download certificate).
   - `COOKIE_SECRET` and `JWT_SECRET`: two **different** random values. Generate each with
     `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
   - Google keys if you want Google sign-in.
2. `npm install` (from the repo root)
3. `npm run migrate --workspace=apps/api` creates the tables.
4. `npm run dev:api` (from the repo root) starts the API on http://localhost:4100

With `EMAIL_TRANSPORT=console`, confirmation and reset emails are printed in the terminal.

`npm test --workspace=apps/api` runs the tests (no database needed).

## How login works

| Cookie | What | Lifetime | Sent to |
|---|---|---|---|
| `access_token` | JWT (HS256) with the user ID | 12 minutes | every API route |
| `refresh_token` | random secret, stored hashed | 7 days, **rotated on every use** | `/api/auth/*` only |
| `csrf` | signed CSRF secret | 7 days | every API route |

All three are `httpOnly`, so page JavaScript can never read them.

- When an API call answers `401 ACCESS_TOKEN_EXPIRED` (or `NOT_AUTHENTICATED`, because the browser deletes the access cookie once it expires), the website calls `POST /api/auth/refresh` once and retries. See `apps/web/src/lib/api-client.ts`.
- Every refresh replaces the refresh token. If an already-replaced token is used again, it was stolen: the whole login is ended.
- A password reset logs out every device and invalidates access tokens already issued.

### CSRF

1. The website calls `GET /api/auth/csrf` → `{ "csrfToken": "..." }`.
2. Every POST/PUT/PATCH/DELETE sends it back in the `X-CSRF-Token` header (and must come from `FRONTEND_URL`).
3. `login` and `logout` return a **new** `csrfToken`. After the Google redirect, call `GET /api/auth/csrf` again.

## Google sign-in setup

Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → "Web application".
Add this Authorized redirect URI: `{API_PUBLIC_URL}/api/auth/google/callback`
(locally: `http://localhost:4100/api/auth/google/callback`).

## Auth endpoints (`/api/auth`)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/csrf` | – | Returns the CSRF token |
| GET | `/google` | – | Browser navigates here to start Google sign-in |
| GET | `/google/callback` | – | Google returns here; sets cookies; redirects to `/complete-profile` or `/dashboard` |
| POST | `/register` | email, password, displayName, userType, isAgeConfirmed? | Sends a confirmation email |
| POST | `/verify-email` | token | Token comes from the email link `#token=...` |
| POST | `/resend-verification` | email | |
| POST | `/login` | email, password | Sets the token cookies; returns `user`, `next`, `csrfToken` |
| POST | `/refresh` | – | New access + refresh token |
| POST | `/logout` | – | Ends this login; returns a new `csrfToken` |
| GET | `/me` | – | Logged-in user |
| POST | `/complete-profile` | displayName, userType, isAgeConfirmed? | Once only (Google sign-ups) |
| POST | `/forgot-password` | email | |
| POST | `/reset-password` | token, password | Logs out every device |

Every endpoint is rate-limited per IP, and the sensitive ones also per email or per user. Extra fields in a body are rejected.
