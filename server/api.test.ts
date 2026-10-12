import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import pg from "pg";
import { buildApp } from "./app.js";

const url =
  process.env.TEST_DATABASE_URL ??
  "postgresql://frame:frame_local@127.0.0.1:54329/frame_test";
const exec = promisify(execFile);
const testDatabase = new URL(url);
const productionUrl = process.env.DATABASE_URL;
if (
  !/(^|\/)frame_test$|_test$/i.test(testDatabase.pathname) ||
  url === productionUrl
)
  throw new Error("TEST_DATABASE_URL must be an isolated *_test database");
let app: ReturnType<typeof buildApp>;
let csrf = "",
  rivalCsrf = "",
  adminCsrf = "",
  cookie = "",
  rivalCookie = "",
  adminCookie = "";
const call = async (
  method: string,
  url: string,
  body?: unknown,
  auth = true,
  rival = false,
  admin = false,
) => {
  const response: any = await (app as any).inject({
    method,
    url,
    payload: body as any,
    headers: auth
      ? {
          cookie: admin ? adminCookie : rival ? rivalCookie : cookie,
          "x-csrf-token": admin ? adminCsrf : rival ? rivalCsrf : csrf,
        }
      : {},
  });
  return {
    status: response.statusCode,
    body: response.json(),
    cookie: response.headers["set-cookie"]?.split(";")[0],
  };
};
test.before(async () => {
  const clean = new pg.Client({ connectionString: url });
  await clean.connect();
  await clean.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await clean.end();
  await exec(process.execPath, ["--import", "tsx", "server/setup.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
  });
  app = buildApp(url);
  await app.ready();
  for (const [email, password, which] of [
    ["customer@frame.test", "FrameGuest2026!", "me"],
    ["rival@frame.test", "FrameRival2026!", "rival"],
    ["admin@frame.test", "FrameAdmin2026!", "admin"],
  ] as const) {
    const out = await call(
      "POST",
      "/api/auth/login",
      { email, password },
      false,
    );
    if (which === "me") {
      cookie = out.cookie!;
      csrf = out.body.csrf_token;
    } else if (which === "rival") {
      rivalCookie = out.cookie!;
      rivalCsrf = out.body.csrf_token;
    } else {
      adminCookie = out.cookie!;
      adminCsrf = out.body.csrf_token;
    }
  }
});
test.after(async () => {
  if (app) await app.close();
});

test("setup can rerun concurrently without changing stored records", async () => {
  const before = await app.pool.query("SELECT (SELECT count(*) FROM users) users, (SELECT count(*) FROM movies) movies, (SELECT count(*) FROM shows) shows, (SELECT count(*) FROM sessions) sessions");
  await Promise.all([0, 1].map(() => exec(process.execPath, ["--import", "tsx", "server/setup.ts"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url },
  })));
  const after = await app.pool.query("SELECT (SELECT count(*) FROM users) users, (SELECT count(*) FROM movies) movies, (SELECT count(*) FROM shows) shows, (SELECT count(*) FROM sessions) sessions");
  assert.deepEqual(after.rows, before.rows);
  assert.equal((await call("GET", "/api/auth/me")).status, 200);
});

test("auth gates, ownership and admin role", async () => {
  assert.equal(
    (await call("GET", "/api/shows/1", undefined, false)).status,
    401,
  );
  assert.equal((await call("GET", "/api/admin/shows")).status, 403);
  assert.equal(
    (await call("GET", "/api/bookings/not-a-booking", undefined, true, true))
      .status,
    404,
  );
});

test("racing clients receive one owner and exact conflict", async () => {
  const [mine, rival] = await Promise.all([
    call("POST", "/api/shows/1/holds", { seats: ["A1", "A2"] }),
    call("POST", "/api/shows/1/holds", { seats: ["A1", "A2"] }, true, true),
  ]);
  assert.deepEqual([mine.status, rival.status].sort(), [201, 409]);
  const loser = mine.status === 409 ? mine : rival;
  assert.deepEqual(loser.body.seats, ["A1", "A2"]);
});

test("holds replace their owner's seats and reject cross-user payment", async () => {
  const first = await call("POST", "/api/shows/4/holds", { seats: ["D1"] });
  const replacement = await call("POST", "/api/shows/4/holds", {
    seats: ["D1", "D2"],
  });
  assert.equal(replacement.status, 201);
  assert.deepEqual(replacement.body.seats, ["D1", "D2"]);
  assert.equal(
    (
      await call(
        "POST",
        `/api/holds/${replacement.body.id}/pay`,
        { outcome: "success" },
        true,
        true,
      )
    ).status,
    404,
  );
  assert.notEqual(first.body.id, replacement.body.id);
});

test("invalid input, csrf, origin, and started shows are rejected", async () => {
  assert.equal(
    (await call("POST", "/api/holds/not-an-id/pay", { outcome: "success" }))
      .status,
    400,
  );
  const badOrigin: any = await (app as any).inject({
    method: "POST",
    url: "/api/shows/5/holds",
    payload: { seats: ["E1"] },
    headers: { cookie, "x-csrf-token": csrf, origin: "https://attacker.test" },
  });
  assert.equal(badOrigin.statusCode, 403);
  const pool = new pg.Pool({ connectionString: url });
  await pool.query(
    "UPDATE shows SET starts_at=clock_timestamp()-interval '2 hours', ends_at=clock_timestamp()-interval '1 minute' WHERE id=5",
  );
  await pool.end();
  assert.equal(
    (await call("POST", "/api/shows/5/holds", { seats: ["E1"] })).status,
    409,
  );
});

test("hold payment is idempotent, failure retains, and partial conflict rolls back", async () => {
  const hold = await call("POST", "/api/shows/2/holds", {
    seats: ["B1", "B2"],
  });
  assert.equal(hold.status, 201);
  assert.equal(
    (
      await call("POST", `/api/holds/${hold.body.id}/pay`, {
        outcome: "failure",
      })
    ).status,
    402,
  );
  const [one, two] = await Promise.all([
    call("POST", `/api/holds/${hold.body.id}/pay`, { outcome: "success" }),
    call("POST", `/api/holds/${hold.body.id}/pay`, { outcome: "success" }),
  ]);
  assert.equal(one.status, 200);
  assert.equal(two.status, 200);
  assert.equal(one.body.booking.id, two.body.booking.id);
  const other = await call(
    "POST",
    "/api/shows/2/holds",
    { seats: ["B2", "B3"] },
    true,
    true,
  );
  assert.equal(other.status, 409);
  assert.deepEqual(other.body.seats, ["B2"]);
  const seats = (await call("GET", "/api/shows/2")).body.seats;
  assert.equal(seats.find((x: any) => x.label === "B3").state, "available");
});

test("expired hold is rejected and cancellation frees seats", async () => {
  const hold = await call("POST", "/api/shows/3/holds", { seats: ["C1"] });
  assert.equal(hold.status, 201);
  const pool = new pg.Pool({ connectionString: url });
  await pool.query(
    "UPDATE holds SET expires_at=now()-interval '1 second' WHERE id=$1",
    [hold.body.id],
  );
  await pool.end();
  assert.equal(
    (
      await call("POST", `/api/holds/${hold.body.id}/pay`, {
        outcome: "success",
      })
    ).status,
    409,
  );
  const paid = await call(
    "POST",
    `/api/holds/${(await call("POST", "/api/shows/3/holds", { seats: ["C1"] })).body.id}/pay`,
    { outcome: "success" },
  );
  const cancel = await call(
    "POST",
    `/api/bookings/${paid.body.booking.id}/cancel`,
    {},
  );
  assert.equal(cancel.status, 200);
  assert.equal(
    (await call("GET", "/api/shows/3")).body.seats.find(
      (x: any) => x.label === "C1",
    ).state,
    "available",
  );
});

test("database ties booked seats to the booking show", async () => {
  const pool = new pg.Pool({ connectionString: url });
  const booking = await pool.query(
    "SELECT id FROM bookings WHERE show_id=2 LIMIT 1",
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO booking_seats(booking_id,show_id,seat_label) VALUES($1,1,'H10')",
      [booking.rows[0].id],
    ),
    { code: "23503" },
  );
  await pool.end();
});

test("admin rejects overlap and booked-show deletion", async () => {
  const show = (
    await call("GET", "/api/admin/shows", undefined, true, false, true)
  ).body.find((item: any) => new Date(item.starts_at) > new Date());
  assert.equal(
    (
      await call(
        "POST",
        "/api/admin/shows",
        {
          movie_id: show.movie_id,
          starts_at: show.starts_at,
          price_paise: 30000,
        },
        true,
        false,
        true,
      )
    ).status,
    409,
  );
  assert.equal(
    (await call("DELETE", "/api/admin/shows/2", undefined, true, false, true))
      .status,
    409,
  );
});
