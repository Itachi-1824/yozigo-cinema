CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS movies (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL, description TEXT NOT NULL, language TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 600),
  rating TEXT NOT NULL CHECK (rating IN ('U','UA','A')),
  poster_url TEXT NOT NULL, backdrop_url TEXT NOT NULL, genre TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shows (
  id BIGSERIAL PRIMARY KEY,
  movie_id BIGINT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL,
  price_paise INTEGER NOT NULL CHECK (price_paise > 0),
  CHECK (ends_at > starts_at),
  EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&)
);
CREATE TABLE IF NOT EXISTS holds (
  id UUID PRIMARY KEY,
  show_id BIGINT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  invalidated_at TIMESTAMPTZ,
  booking_id UUID UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hold_seats (
  hold_id UUID NOT NULL REFERENCES holds(id) ON DELETE CASCADE,
  seat_label TEXT NOT NULL CHECK (seat_label ~ '^[A-H](10|[1-9])$'),
  PRIMARY KEY (hold_id, seat_label)
);
ALTER TABLE holds ADD COLUMN IF NOT EXISTS booking_id UUID UNIQUE;
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY,
  show_id BIGINT NOT NULL REFERENCES shows(id) ON DELETE RESTRICT,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount_paise INTEGER NOT NULL, status TEXT NOT NULL CHECK (status IN ('confirmed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), cancelled_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS booking_seats (
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  show_id BIGINT NOT NULL REFERENCES shows(id) ON DELETE RESTRICT,
  seat_label TEXT NOT NULL CHECK (seat_label ~ '^[A-H](10|[1-9])$'),
  released_at TIMESTAMPTZ,
  PRIMARY KEY (booking_id, seat_label),
  UNIQUE NULLS NOT DISTINCT (show_id, seat_label, released_at)
);
CREATE INDEX IF NOT EXISTS holds_show_active ON holds(show_id, expires_at) WHERE invalidated_at IS NULL;
CREATE INDEX IF NOT EXISTS bookings_show ON bookings(show_id);
