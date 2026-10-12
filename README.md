# FRAME

An editorial cinema booking app. Browse four fictional films, pick a screening, reserve up to six seats, and confirm a simulated payment. Built with Astro, React, TypeScript, Fastify and PostgreSQL.

## Run with Docker

Install Docker Desktop (or Docker Engine with Compose), then:

```sh
docker compose up --build -d
```

Open **http://localhost:8080**. The API and database stay on the private container network; the database's development port is bound to loopback only. The setup script creates the schema and seeds an empty database. Running it again preserves existing bookings and applies the integrity migration.

```sh
docker compose down
```

The named database volume persists. Do not remove it to restart the app.

## Run for development

Requires Node.js 22.19+ and PostgreSQL 17+ (the supplied container is the easiest option).

```sh
npm ci
docker compose up -d db
npm run db:setup
npm run dev
```

Open **http://127.0.0.1:4321**. Astro proxies `/api` to the separate API at port 4000. Defaults work without an environment file. To use another database or change credentials, copy `.env.example` to `.env` and edit it before seeding. `APP_ORIGIN` must match the browser's origin exactly.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Customer | customer@frame.test | FrameGuest2026! |
| Second customer | rival@frame.test | FrameRival2026! |
| Admin | admin@frame.test | FrameAdmin2026! |

These are intentional local demo credentials. Public hosting requires replacing the default database password and seeded account passwords, setting a correct `APP_ORIGIN`, and serving over HTTPS with `NODE_ENV=production`. Normal sign-up always creates a customer. Payments are simulated; no payment provider is connected.

## Completed flows

1. Sign-up, login and logout with hashed passwords and cookie sessions.
2. Movie catalogue, search, genre filters, details and upcoming showtimes grouped by date.
3. Eight rows (A–H), ten seats each; available, held and booked states from the API.
4. Atomic five-minute holds for one to six seats, conflict feedback and countdown.
5. Simulated payment success/failure, retry, booking receipt and expired-hold rejection.
6. Own booking history and private ticket details.
7. Admin film CRUD and show creation/deletion with overlap and booking-history protection.
8. Upcoming booking cancellation at least two hours before the screening; seats release immediately.
9. Per-show occupancy, confirmed revenue, customer booking list and seat map.
10. Live seats through three-second polling, with visible connection errors and hold recovery on refresh.

The interface includes an opt-in sound toggle, reduced-motion support, keyboard focus management, and a horizontally scrollable mobile seat map that preserves full-size targets. Film imagery and fonts are local assets. The fictional film artwork is illustrative; ratings are age classifications, not audience scores.

## Key decisions

- Astro serves the page and bundles React; the interactive application is React with TypeScript.
- Fastify runs as a separate API, so authentication and booking rules remain independent of the UI.
- PostgreSQL owns durable data, time and concurrency; monetary amounts are integer paise.
- Every reservation mutation locks the show first, then its hold or booking, giving a consistent lock order.
- A partial unique index allows only one active booking for each show/seat; a composite foreign key prevents seats belonging to the wrong show.
- Holds expire according to the database clock. Reads exclude expired holds, so a background cleanup job is unnecessary for correctness.
- The single screen uses an exclusion constraint on `[start,end)` time ranges; adjacent shows are valid, overlapping shows are rejected.
- Opaque session cookies are HttpOnly; session tokens are hashed in the database, and mutations check CSRF tokens and browser origin.
- Polling is sufficient for eighty seats and one screen. Transactions, rather than live UI updates, protect correctness.
- Film discovery uses an editorial composition; checkout keeps price, seats, time and payment status explicit.

## Database design

```mermaid
erDiagram
  users ||--o{ sessions : authenticates
  users ||--o{ holds : reserves
  users ||--o{ bookings : owns
  movies ||--o{ shows : screens
  shows ||--o{ holds : has
  shows ||--o{ bookings : has
  holds ||--|{ hold_seats : includes
  bookings ||--|{ booking_seats : includes
```

| Table | Important columns and rules |
|---|---|
| `users` | id, name, unique normalized email, password_hash, customer/admin role |
| `sessions` | token_hash, user_id, csrf_token, expires_at |
| `movies` | title, description, language, duration_minutes, rating, poster_url, backdrop_url, genre |
| `shows` | movie_id, starts_at, ends_at, price_paise; exclusion constraint prevents overlaps |
| `holds` | UUID, show_id, user_id, expires_at, invalidated_at, booking_id |
| `hold_seats` | hold_id, seat_label; one entry per selected seat |
| `bookings` | UUID, show_id, user_id, amount_paise, status, created_at, cancelled_at |
| `booking_seats` | booking_id, show_id, seat_label, released_at; active-seat unique index and booking/show composite foreign key |

See [schema.sql](server/schema.sql) for the complete schema and [API contract](docs/CONTRACT.md) for routes. Cancellation keeps the booking and seat history while releasing active ownership.

## Checks

```sh
npm run check
npm run build
docker compose exec -T db createdb -U frame frame_test
npm test
npx playwright install chromium
npm run test:e2e
```

Create `frame_test` once; an already-existing database needs no creation. Backend tests reset **only** an isolated database whose name ends in `_test`, and reject a URL matching `DATABASE_URL`. They use real PostgreSQL with no mocked database. Browser tests use the running app; start the database and run `db:setup` first. Playwright starts the application if it is not running.

## Demo walkthrough

Use [the recording guide](docs/DEMO.md) for a 3–5 minute demonstration, including two independent browser sessions competing for the same seat. This project is prepared locally; repository publication, external video sharing and the hiring-email reply are separate submission steps.

## Assumptions and limits

- One cinema and one screen; dates and customer-facing showtimes use India Standard Time.
- Seed data covers the next seven days from initial setup. An existing database is never destructively reseeded; staff can add new shows.
- Changing a film's duration is blocked when it affects confirmed bookings or creates a schedule overlap. Removing a film or show with booking history is blocked, including cancelled history.
- No real payments, email receipts, QR admission system, password reset or multi-cinema search. The supplied brief does not require them.
- No autoplay audio. Sound preferences live in the browser; authentication credentials do not.
- No public deployment or submission is claimed by this repository.
