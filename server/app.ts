import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import pg from "pg";

const labels = Array.from({ length: 8 }, (_, row) =>
  Array.from(
    { length: 10 },
    (_, col) => `${String.fromCharCode(65 + row)}${col + 1}`,
  ),
).flat();
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://frame:frame_local@127.0.0.1:54329/frame";
type User = {
  id: number;
  name: string;
  email: string;
  role: "customer" | "admin";
};
type AuthRequest = FastifyRequest & { user?: User; csrf?: string };
const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const scryptAsync = promisify(scrypt);
const passwordHash = async (password: string) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${((await scryptAsync(password, salt, 64)) as Buffer).toString("hex")}`;
};
const passwordMatches = async (password: string, stored: string) => {
  const [salt, value] = stored.split(":");
  if (!salt || !/^[0-9a-f]{128}$/i.test(value ?? "")) return false;
  const candidate = (await scryptAsync(password, salt, 64)) as Buffer;
  return (
    value.length === candidate.length * 2 &&
    timingSafeEqual(candidate, Buffer.from(value, "hex"))
  );
};
const dbTime = (value: unknown) => new Date(value as string).toISOString();
const fail = (
  reply: FastifyReply,
  code: number,
  error: string,
  extra: object = {},
) => reply.code(code).send({ error, ...extra });
const publicUser = (row: any): User => ({
  id: Number(row.id),
  name: row.name,
  email: row.email,
  role: row.role,
});

export function buildApp(connectionString = databaseUrl) {
  const app = Fastify({ logger: false });
  const pool = new pg.Pool({ connectionString });
  app.decorate("pool", pool);
  app.register(cookie, { hook: "onRequest" });
  app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({ error: "Too many requests" }),
  });
  app.setErrorHandler((error: any, request, reply) => {
    if (["22P02", "22007", "22003", "23502", "23514"].includes(error.code))
      return fail(reply, 400, "Invalid request");
    if (["23503", "23505", "23P01"].includes(error.code))
      return fail(reply, 409, "Request conflicts with existing data");
    request.log.error(error);
    return fail(reply, 500, "Unable to process request");
  });
  app.addHook("onClose", async () => {
    await pool.end();
  });
  app.addHook("onRequest", async (request, reply) => {
    if (
      request.method !== "GET" &&
      request.method !== "HEAD" &&
      request.headers.origin
    ) {
      const allowed = process.env.APP_ORIGIN
        ? [process.env.APP_ORIGIN]
        : ["http://localhost:4321", "http://127.0.0.1:4321"];
      if (!allowed.includes(request.headers.origin))
        return fail(reply, 403, "Invalid origin");
    }
  });
  async function session(
    request: AuthRequest,
    reply: FastifyReply,
    csrf = false,
  ) {
    const raw = request.cookies.session;
    if (!raw) {
      fail(reply, 401, "Authentication required");
      return false;
    }
    const { rows } = await pool.query(
      "SELECT u.id,u.name,u.email,u.role,s.csrf_token FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()",
      [tokenHash(raw)],
    );
    if (!rows[0]) {
      reply.clearCookie("session", { path: "/" });
      fail(reply, 401, "Authentication required");
      return false;
    }
    request.user = publicUser(rows[0]);
    request.csrf = rows[0].csrf_token;
    if (csrf && request.headers["x-csrf-token"] !== request.csrf) {
      fail(reply, 403, "Invalid CSRF token");
      return false;
    }
    return true;
  }
  async function admin(
    request: AuthRequest,
    reply: FastifyReply,
    csrf = false,
  ) {
    return (await session(request, reply, csrf)) &&
      request.user!.role === "admin"
      ? true
      : request.user
        ? (fail(reply, 403, "Admin access required"), false)
        : false;
  }
  function setSession(
    reply: FastifyReply,
    user: User,
    csrf: string,
    token: string,
  ) {
    reply.setCookie("session", token, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
    });
    return { user, csrf_token: csrf };
  }
  async function createSession(reply: FastifyReply, user: User) {
    const token = randomBytes(32).toString("base64url"),
      csrf = randomBytes(24).toString("base64url");
    await pool.query(
      "INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,now()+interval '7 days')",
      [tokenHash(token), user.id, csrf],
    );
    return setSession(reply, user, csrf, token);
  }
  function movieInput(body: any) {
    if (
      !body ||
      typeof body.title !== "string" ||
      typeof body.description !== "string" ||
      typeof body.language !== "string" ||
      !Number.isInteger(body.duration_minutes) ||
      body.duration_minutes < 1 ||
      body.duration_minutes > 600 ||
      !["U", "UA", "A"].includes(body.rating) ||
      typeof body.poster_url !== "string" ||
      typeof body.backdrop_url !== "string" ||
      typeof body.genre !== "string"
    )
      return null;
    if (
      [body.title, body.language, body.genre].some(
        (value) => value.trim().length < 1 || value.length > 120,
      ) ||
      body.description.length > 4000 ||
      ![body.poster_url, body.backdrop_url].every(
        (value) => /^\/(?!\/)|^https?:\/\//.test(value) && value.length <= 2048,
      )
    )
      return null;
    return body;
  }
  async function showData(id: number, userId?: number) {
    const result = await pool.query(
      `SELECT s.id,s.movie_id,s.starts_at,s.ends_at,s.price_paise,m.title,m.description,m.language,m.duration_minutes,m.rating,m.poster_url,m.backdrop_url,m.genre,
      80-(SELECT count(*) FROM booking_seats bs JOIN bookings b ON b.id=bs.booking_id WHERE bs.show_id=s.id AND bs.released_at IS NULL AND b.status='confirmed')-(SELECT count(*) FROM hold_seats hs JOIN holds h ON h.id=hs.hold_id WHERE h.show_id=s.id AND h.invalidated_at IS NULL AND h.booking_id IS NULL AND h.expires_at>now()) AS available_seats
      FROM shows s JOIN movies m ON m.id=s.movie_id WHERE s.id=$1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) return null;
    const occupied = await pool.query(
      `SELECT bs.seat_label,'booked' state,false mine FROM booking_seats bs JOIN bookings b ON b.id=bs.booking_id WHERE bs.show_id=$1 AND bs.released_at IS NULL AND b.status='confirmed'
      UNION ALL SELECT hs.seat_label,'held',h.user_id=$2 FROM hold_seats hs JOIN holds h ON h.id=hs.hold_id WHERE h.show_id=$1 AND h.invalidated_at IS NULL AND h.booking_id IS NULL AND h.expires_at>now()`,
      [id, userId ?? -1],
    );
    const states = new Map(
      occupied.rows.map((x: any) => [
        x.seat_label,
        { label: x.seat_label, state: x.state, mine: x.mine },
      ]),
    );
    const hold = userId
      ? await pool.query(
          `SELECT h.id,h.show_id,array_agg(hs.seat_label ORDER BY hs.seat_label) seats,h.expires_at,s.price_paise*count(hs.seat_label)::int amount_paise FROM holds h JOIN hold_seats hs ON hs.hold_id=h.id JOIN shows s ON s.id=h.show_id WHERE h.show_id=$1 AND h.user_id=$2 AND h.invalidated_at IS NULL AND h.booking_id IS NULL AND h.expires_at>now() GROUP BY h.id,s.price_paise`,
          [id, userId],
        )
      : { rows: [] };
    const show = {
      id: Number(row.id),
      movie_id: Number(row.movie_id),
      starts_at: dbTime(row.starts_at),
      ends_at: dbTime(row.ends_at),
      price_paise: Number(row.price_paise),
      available_seats: Number(row.available_seats),
    };
    const movie = {
      id: Number(row.movie_id),
      title: row.title,
      description: row.description,
      language: row.language,
      duration_minutes: Number(row.duration_minutes),
      rating: row.rating,
      poster_url: row.poster_url,
      backdrop_url: row.backdrop_url,
      genre: row.genre,
    };
    return {
      show,
      movie,
      seats: labels.map(
        (label) =>
          states.get(label) ?? { label, state: "available", mine: false },
      ),
      hold: hold.rows[0]
        ? {
            ...hold.rows[0],
            show_id: Number(hold.rows[0].show_id),
            expires_at: dbTime(hold.rows[0].expires_at),
            amount_paise: Number(hold.rows[0].amount_paise),
          }
        : null,
    };
  }
  async function booking(id: string) {
    const { rows } = await pool.query(
      `SELECT b.id,m.title movie_title,s.starts_at,array_agg(bs.seat_label ORDER BY bs.seat_label) seats,b.amount_paise,b.status,b.created_at,m.poster_url FROM bookings b JOIN shows s ON s.id=b.show_id JOIN movies m ON m.id=s.movie_id JOIN booking_seats bs ON bs.booking_id=b.id WHERE b.id=$1 GROUP BY b.id,m.title,s.starts_at,m.poster_url`,
      [id],
    );
    return (
      rows[0] && {
        ...rows[0],
        starts_at: dbTime(rows[0].starts_at),
        created_at: dbTime(rows[0].created_at),
        amount_paise: Number(rows[0].amount_paise),
      }
    );
  }

  app.post(
    "/api/auth/signup",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request: any, reply) => {
      const b = request.body;
      if (
        !b ||
        typeof b.name !== "string" ||
        b.name.trim().length < 1 ||
        b.name.trim().length > 100 ||
        typeof b.email !== "string" ||
        b.email.trim().length > 254 ||
        !/^\S+@\S+\.\S+$/.test(b.email.trim()) ||
        typeof b.password !== "string" ||
        b.password.length < 8 ||
        b.password.length > 128
      )
        return fail(reply, 400, "Invalid signup details");
      try {
        const { rows } = await pool.query(
          "INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,role",
          [
            b.name.trim(),
            b.email.trim().toLowerCase(),
            await passwordHash(b.password),
          ],
        );
        reply.code(201);
        return await createSession(reply, publicUser(rows[0]));
      } catch (e: any) {
        return e.code === "23505"
          ? fail(reply, 409, "Email already registered")
          : fail(reply, 500, "Unable to create account");
      }
    },
  );
  app.post(
    "/api/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request: any, reply) => {
      const b = request.body;
      const { rows } = await pool.query(
        "SELECT id,name,email,role,password_hash FROM users WHERE email=$1",
        [typeof b?.email === "string" ? b.email.trim().toLowerCase() : ""],
      );
      if (
        !rows[0] ||
        typeof b?.password !== "string" ||
        !(await passwordMatches(b.password, rows[0].password_hash))
      )
        return fail(reply, 401, "Invalid email or password");
      return createSession(reply, publicUser(rows[0]));
    },
  );
  app.get("/api/auth/me", async (request: AuthRequest, reply) =>
    (await session(request, reply))
      ? { user: request.user, csrf_token: request.csrf }
      : undefined,
  );
  app.post("/api/auth/logout", async (request: AuthRequest, reply) => {
    if (!(await session(request, reply, true))) return;
    await pool.query("DELETE FROM sessions WHERE token_hash=$1", [
      tokenHash(request.cookies.session!),
    ]);
    reply.clearCookie("session", { path: "/" });
    return { ok: true };
  });
  app.get("/api/movies", async () =>
    (await pool.query("SELECT * FROM movies ORDER BY id")).rows.map(
      (x: any) => ({
        ...x,
        id: Number(x.id),
        duration_minutes: Number(x.duration_minutes),
      }),
    ),
  );
  app.get("/api/movies/:id", async (request: any, reply) => {
    const movie = (
      await pool.query("SELECT * FROM movies WHERE id=$1", [request.params.id])
    ).rows[0];
    if (!movie) return fail(reply, 404, "Movie not found");
    const shows = (
      await pool.query(
        `SELECT s.id,s.movie_id,s.starts_at,s.ends_at,s.price_paise,80-(SELECT count(*) FROM booking_seats bs JOIN bookings b ON b.id=bs.booking_id WHERE bs.show_id=s.id AND bs.released_at IS NULL AND b.status='confirmed')-(SELECT count(*) FROM hold_seats hs JOIN holds h ON h.id=hs.hold_id WHERE h.show_id=s.id AND h.invalidated_at IS NULL AND h.booking_id IS NULL AND h.expires_at>now()) available_seats FROM shows s WHERE movie_id=$1 AND starts_at>now() ORDER BY starts_at`,
        [movie.id],
      )
    ).rows.map((s: any) => ({
      ...s,
      id: Number(s.id),
      movie_id: Number(s.movie_id),
      starts_at: dbTime(s.starts_at),
      ends_at: dbTime(s.ends_at),
      price_paise: Number(s.price_paise),
      available_seats: Number(s.available_seats),
    }));
    return {
      movie: {
        ...movie,
        id: Number(movie.id),
        duration_minutes: Number(movie.duration_minutes),
      },
      shows,
    };
  });
  app.get("/api/shows/:id", async (request: AuthRequest, reply) => {
    if (!(await session(request, reply))) return;
    const data = await showData(
      Number((request.params as any).id),
      request.user!.id,
    );
    return data
      ? {
          ...data,
          server_now: (
            await pool.query("SELECT now()")
          ).rows[0].now.toISOString(),
        }
      : fail(reply, 404, "Show not found");
  });
  app.post("/api/shows/:id/holds", async (request: AuthRequest, reply) => {
    if (!(await session(request, reply, true))) return;
    const showId = Number((request.params as any).id),
      seats = (request.body as any)?.seats;
    if (
      !Number.isInteger(showId) ||
      !Array.isArray(seats) ||
      seats.length < 1 ||
      seats.length > 6 ||
      new Set(seats).size !== seats.length ||
      seats.some((x: any) => !labels.includes(x))
    )
      return fail(reply, 400, "Invalid seats");
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const exists = await c.query(
        "SELECT id,price_paise,starts_at FROM shows WHERE id=$1 FOR UPDATE",
        [showId],
      );
      if (!exists.rows[0]) {
        await c.query("ROLLBACK");
        return fail(reply, 404, "Show not found");
      }
      if (
        new Date(exists.rows[0].starts_at) <=
        new Date((await c.query("SELECT clock_timestamp() now")).rows[0].now)
      ) {
        await c.query("ROLLBACK");
        return fail(reply, 409, "Show has started");
      }
      const active = await c.query(
        `SELECT h.id,array_agg(hs.seat_label ORDER BY hs.seat_label) seats,h.expires_at FROM holds h JOIN hold_seats hs ON hs.hold_id=h.id WHERE h.show_id=$1 AND h.user_id=$2 AND h.invalidated_at IS NULL AND h.booking_id IS NULL AND h.expires_at>clock_timestamp() GROUP BY h.id`,
        [showId, request.user!.id],
      );
      const sorted = [...seats].sort();
      if (
        active.rows[0] &&
        JSON.stringify(active.rows[0].seats) === JSON.stringify(sorted)
      ) {
        await c.query("COMMIT");
        return reply.code(201).send({
          id: active.rows[0].id,
          show_id: showId,
          seats: active.rows[0].seats,
          expires_at: dbTime(active.rows[0].expires_at),
          amount_paise: Number(exists.rows[0].price_paise) * seats.length,
        });
      }
      const unavailable = await c.query(
        `SELECT seat_label FROM booking_seats bs JOIN bookings b ON b.id=bs.booking_id WHERE bs.show_id=$1 AND bs.released_at IS NULL AND b.status='confirmed' UNION SELECT hs.seat_label FROM hold_seats hs JOIN holds h ON h.id=hs.hold_id WHERE h.show_id=$1 AND h.user_id<>$2 AND h.invalidated_at IS NULL AND h.booking_id IS NULL AND h.expires_at>clock_timestamp()`,
        [showId, request.user!.id],
      );
      const bad = sorted.filter((s) =>
        unavailable.rows.some((x: any) => x.seat_label === s),
      );
      if (bad.length) {
        await c.query("ROLLBACK");
        return fail(reply, 409, "Seats unavailable", { seats: bad });
      }
      await c.query(
        "UPDATE holds SET invalidated_at=clock_timestamp() WHERE show_id=$1 AND user_id=$2 AND invalidated_at IS NULL AND booking_id IS NULL AND expires_at>clock_timestamp()",
        [showId, request.user!.id],
      );
      const id = randomUUID();
      const h = await c.query(
        `INSERT INTO holds(id,show_id,user_id,expires_at) VALUES($1,$2,$3,clock_timestamp()+interval '5 minutes') RETURNING expires_at`,
        [id, showId, request.user!.id],
      );
      for (const seat of sorted)
        await c.query(
          "INSERT INTO hold_seats(hold_id,seat_label) VALUES($1,$2)",
          [id, seat],
        );
      await c.query("COMMIT");
      return reply.code(201).send({
        id,
        show_id: showId,
        seats: sorted,
        expires_at: dbTime(h.rows[0].expires_at),
        amount_paise: Number(exists.rows[0].price_paise) * sorted.length,
      });
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  });
  app.post("/api/holds/:id/pay", async (request: AuthRequest, reply) => {
    if (!(await session(request, reply, true))) return;
    const id = (request.params as any).id,
      b = request.body as any;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(reply, 400, "Invalid hold");
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const holdRef = await c.query("SELECT show_id FROM holds WHERE id=$1", [
        id,
      ]);
      if (!holdRef.rows[0]) {
        await c.query("ROLLBACK");
        return fail(reply, 404, "Hold not found");
      }
      const show = await c.query(
        "SELECT id,starts_at,price_paise FROM shows WHERE id=$1 FOR UPDATE",
        [holdRef.rows[0].show_id],
      );
      if (!show.rows[0]) {
        await c.query("ROLLBACK");
        return fail(reply, 404, "Hold not found");
      }
      const hold = await c.query(
        "SELECT h.* FROM holds h WHERE h.id=$1 FOR UPDATE OF h",
        [id],
      );
      if (!hold.rows[0] || Number(hold.rows[0].user_id) !== request.user!.id) {
        await c.query("ROLLBACK");
        return fail(reply, 404, "Hold not found");
      }
      const h = hold.rows[0];
      if (h.booking_id) {
        const out = await booking(h.booking_id);
        await c.query("COMMIT");
        return { booking: out };
      }
      const clock = (await c.query("SELECT clock_timestamp() now")).rows[0].now;
      if (new Date(show.rows[0].starts_at) <= new Date(clock)) {
        await c.query("ROLLBACK");
        return fail(reply, 409, "Show has started");
      }
      if (h.invalidated_at || new Date(h.expires_at) <= new Date(clock)) {
        await c.query("ROLLBACK");
        return fail(reply, 409, "Hold expired");
      }
      if (b?.outcome === "failure") {
        await c.query("ROLLBACK");
        return fail(reply, 402, "Payment failed", { code: "PAYMENT_FAILED" });
      }
      if (b?.outcome !== "success") {
        await c.query("ROLLBACK");
        return fail(reply, 400, "Invalid payment outcome");
      }
      const seats = (
        await c.query(
          "SELECT seat_label FROM hold_seats WHERE hold_id=$1 ORDER BY seat_label",
          [id],
        )
      ).rows.map((x: any) => x.seat_label);
      const bookingId = randomUUID();
      await c.query(
        "INSERT INTO bookings(id,show_id,user_id,amount_paise,status) VALUES($1,$2,$3,$4,'confirmed')",
        [
          bookingId,
          h.show_id,
          request.user!.id,
          Number(show.rows[0].price_paise) * seats.length,
        ],
      );
      for (const seat of seats)
        await c.query(
          "INSERT INTO booking_seats(booking_id,show_id,seat_label) VALUES($1,$2,$3)",
          [bookingId, h.show_id, seat],
        );
      await c.query("UPDATE holds SET booking_id=$2 WHERE id=$1", [
        id,
        bookingId,
      ]);
      await c.query("COMMIT");
      return { booking: await booking(bookingId) };
    } catch (e: any) {
      await c.query("ROLLBACK");
      if (e.code === "23505") return fail(reply, 409, "Seats unavailable");
      throw e;
    } finally {
      c.release();
    }
  });
  app.get("/api/bookings", async (request: AuthRequest, reply) => {
    if (!(await session(request, reply))) return;
    const { rows } = await pool.query(
      `SELECT b.id FROM bookings b JOIN shows s ON s.id=b.show_id WHERE b.user_id=$1 ORDER BY (s.starts_at>now()) DESC,s.starts_at ASC,b.created_at DESC`,
      [request.user!.id],
    );
    return Promise.all(rows.map((x) => booking(x.id)));
  });
  app.get("/api/bookings/:id", async (request: AuthRequest, reply) => {
    if (!(await session(request, reply))) return;
    const id = (request.params as any).id;
    if (!/^[0-9a-f-]{36}$/i.test(id))
      return fail(reply, 404, "Booking not found");
    const found = await pool.query(
      "SELECT id FROM bookings WHERE id=$1 AND user_id=$2",
      [id, request.user!.id],
    );
    return found.rows[0]
      ? await booking(found.rows[0].id)
      : fail(reply, 404, "Booking not found");
  });
  app.post("/api/bookings/:id/cancel", async (request: AuthRequest, reply) => {
    if (!(await session(request, reply, true))) return;
    const bookingId = (request.params as any).id;
    if (!/^[0-9a-f-]{36}$/i.test(bookingId))
      return fail(reply, 400, "Invalid booking");
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const ref = await c.query(
        "SELECT show_id FROM bookings WHERE id=$1 AND user_id=$2",
        [bookingId, request.user!.id],
      );
      if (!ref.rows[0]) {
        await c.query("ROLLBACK");
        return fail(reply, 404, "Booking not found");
      }
      await c.query("SELECT id FROM shows WHERE id=$1 FOR UPDATE", [
        ref.rows[0].show_id,
      ]);
      const result = await c.query(
        "SELECT b.*,s.starts_at FROM bookings b JOIN shows s ON s.id=b.show_id WHERE b.id=$1 AND b.user_id=$2 FOR UPDATE OF b",
        [bookingId, request.user!.id],
      );
      const b = result.rows[0];
      if (!b) {
        await c.query("ROLLBACK");
        return fail(reply, 404, "Booking not found");
      }
      const clock = (await c.query("SELECT clock_timestamp() now")).rows[0].now;
      if (
        b.status !== "confirmed" ||
        new Date(b.starts_at).getTime() - new Date(clock).getTime() < 7200000
      ) {
        await c.query("ROLLBACK");
        return fail(reply, 409, "Booking cannot be cancelled");
      }
      await c.query("SELECT id FROM shows WHERE id=$1 FOR UPDATE", [b.show_id]);
      await c.query(
        "UPDATE bookings SET status='cancelled',cancelled_at=now() WHERE id=$1",
        [b.id],
      );
      await c.query(
        "UPDATE booking_seats SET released_at=now() WHERE booking_id=$1",
        [b.id],
      );
      await c.query("COMMIT");
      return booking(b.id);
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  });
  app.get("/api/admin/movies", async (request: AuthRequest, reply) => {
    if (!(await admin(request, reply))) return;
    return (await pool.query("SELECT * FROM movies ORDER BY id")).rows;
  });
  app.post("/api/admin/movies", async (request: AuthRequest, reply) => {
    if (!(await admin(request, reply, true))) return;
    const b = movieInput(request.body);
    if (!b) return fail(reply, 400, "Invalid movie");
    const { rows } = await pool.query(
      "INSERT INTO movies(title,description,language,duration_minutes,rating,poster_url,backdrop_url,genre) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
      [
        b.title,
        b.description,
        b.language,
        b.duration_minutes,
        b.rating,
        b.poster_url,
        b.backdrop_url,
        b.genre,
      ],
    );
    reply.code(201);
    return rows[0];
  });
  app.patch("/api/admin/movies/:id", async (request: AuthRequest, reply) => {
    if (!(await admin(request, reply, true))) return;
    const b = movieInput(request.body);
    const id = Number((request.params as any).id);
    if (!b) return fail(reply, 400, "Invalid movie");
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const existing = await c.query(
        "SELECT * FROM movies WHERE id=$1 FOR UPDATE",
        [id],
      );
      if (!existing.rows[0]) {
        await c.query("ROLLBACK");
        return fail(reply, 404, "Movie not found");
      }
      if (existing.rows[0].duration_minutes !== b.duration_minutes) {
        const overlaps = await c.query(
          `SELECT s.id FROM shows s WHERE s.movie_id=$1 AND EXISTS (SELECT 1 FROM shows other WHERE other.id<>s.id AND tstzrange(s.starts_at,s.starts_at+($2::text||' minutes')::interval,'[)') && tstzrange(other.starts_at,other.ends_at,'[)'))`,
          [id, b.duration_minutes],
        );
        const booked = await c.query(
          "SELECT 1 FROM bookings b JOIN shows s ON s.id=b.show_id WHERE s.movie_id=$1 AND b.status='confirmed' LIMIT 1",
          [id],
        );
        if (overlaps.rows[0] || booked.rows[0]) {
          await c.query("ROLLBACK");
          return fail(reply, 409, "Movie duration cannot be changed");
        }
        await c.query(
          "UPDATE shows SET ends_at=starts_at+($2::text||' minutes')::interval WHERE movie_id=$1",
          [id, b.duration_minutes],
        );
      }
      const { rows } = await c.query(
        "UPDATE movies SET title=$2,description=$3,language=$4,duration_minutes=$5,rating=$6,poster_url=$7,backdrop_url=$8,genre=$9 WHERE id=$1 RETURNING *",
        [
          id,
          b.title,
          b.description,
          b.language,
          b.duration_minutes,
          b.rating,
          b.poster_url,
          b.backdrop_url,
          b.genre,
        ],
      );
      await c.query("COMMIT");
      return rows[0];
    } catch (e: any) {
      await c.query("ROLLBACK");
      if (e.code === "23P01")
        return fail(reply, 409, "Movie duration cannot be changed");
      throw e;
    } finally {
      c.release();
    }
  });
  app.delete("/api/admin/movies/:id", async (request: AuthRequest, reply) => {
    if (!(await admin(request, reply, true))) return;
    const id = Number((request.params as any).id);
    const found = await pool.query(
      "SELECT 1 FROM bookings b JOIN shows s ON s.id=b.show_id WHERE s.movie_id=$1 LIMIT 1",
      [id],
    );
    if (found.rows[0]) return fail(reply, 409, "Movie has booking history");
    const result = await pool.query("DELETE FROM movies WHERE id=$1", [id]);
    return result.rowCount ? { ok: true } : fail(reply, 404, "Movie not found");
  });
  app.get("/api/admin/shows", async (request: AuthRequest, reply) => {
    if (!(await admin(request, reply))) return;
    const { rows } = await pool.query(
      `SELECT s.id,s.movie_id,s.starts_at,s.ends_at,s.price_paise,m.title movie_title,(SELECT count(*) FROM booking_seats bs JOIN bookings b ON b.id=bs.booking_id WHERE bs.show_id=s.id AND bs.released_at IS NULL AND b.status='confirmed') booked_seats,(SELECT coalesce(sum(b.amount_paise),0) FROM bookings b WHERE b.show_id=s.id AND b.status='confirmed') revenue_paise FROM shows s JOIN movies m ON m.id=s.movie_id ORDER BY s.starts_at`,
    );
    return rows.map((x: any) => ({
      ...x,
      id: Number(x.id),
      movie_id: Number(x.movie_id),
      starts_at: dbTime(x.starts_at),
      ends_at: dbTime(x.ends_at),
      price_paise: Number(x.price_paise),
      booked_seats: Number(x.booked_seats),
      occupancy_percent: (Number(x.booked_seats) * 100) / 80,
      revenue_paise: Number(x.revenue_paise),
    }));
  });
  app.post("/api/admin/shows", async (request: AuthRequest, reply) => {
    if (!(await admin(request, reply, true))) return;
    const b = request.body as any;
    const start = new Date(b?.starts_at);
    if (
      !Number.isInteger(b?.movie_id) ||
      !Number.isInteger(b?.price_paise) ||
      b.price_paise < 1 ||
      isNaN(start.valueOf()) ||
      start <= new Date()
    )
      return fail(reply, 400, "Invalid show");
    const movie = (
      await pool.query("SELECT duration_minutes FROM movies WHERE id=$1", [
        b.movie_id,
      ])
    ).rows[0];
    if (!movie) return fail(reply, 404, "Movie not found");
    try {
      const { rows } = await pool.query(
        "INSERT INTO shows(movie_id,starts_at,ends_at,price_paise) VALUES($1,$2,$3,$4) RETURNING *",
        [
          b.movie_id,
          start,
          new Date(start.getTime() + Number(movie.duration_minutes) * 60000),
          b.price_paise,
        ],
      );
      reply.code(201);
      return {
        ...rows[0],
        id: Number(rows[0].id),
        movie_id: Number(rows[0].movie_id),
        starts_at: dbTime(rows[0].starts_at),
        ends_at: dbTime(rows[0].ends_at),
        price_paise: Number(rows[0].price_paise),
        available_seats: 80,
      };
    } catch (e: any) {
      return e.code === "23P01"
        ? fail(reply, 409, "Show overlaps another show")
        : fail(reply, 500, "Unable to create show");
    }
  });
  app.delete("/api/admin/shows/:id", async (request: AuthRequest, reply) => {
    if (!(await admin(request, reply, true))) return;
    const id = Number((request.params as any).id);
    if (
      (
        await pool.query("SELECT 1 FROM bookings WHERE show_id=$1 LIMIT 1", [
          id,
        ])
      ).rows[0]
    )
      return fail(reply, 409, "Show has booking history");
    const result = await pool.query("DELETE FROM shows WHERE id=$1", [id]);
    return result.rowCount ? { ok: true } : fail(reply, 404, "Show not found");
  });
  app.get(
    "/api/admin/shows/:id/bookings",
    async (request: AuthRequest, reply) => {
      if (!(await admin(request, reply))) return;
      const { rows } = await pool.query(
        "SELECT b.id,u.name customer_name FROM bookings b JOIN users u ON u.id=b.user_id WHERE b.show_id=$1 ORDER BY b.created_at",
        [(request.params as any).id],
      );
      return Promise.all(
        rows.map(async (r) => ({
          ...(await booking(r.id)),
          customer_name: r.customer_name,
        })),
      );
    },
  );
  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    pool: pg.Pool;
  }
}
