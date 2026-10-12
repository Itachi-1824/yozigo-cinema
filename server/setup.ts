import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://frame:frame_local@127.0.0.1:54329/frame";
const client = new pg.Client({ connectionString });
const hash = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
};

await client.connect();
try {
  await client.query("BEGIN");
  // Serialize schema and seed work when two app processes start together.
  await client.query("SELECT pg_advisory_xact_lock(652351)");
  await client.query(
    await readFile(join(import.meta.dirname, "schema.sql"), "utf8"),
  );
  const {
    rows: [{ count }],
  } = await client.query<{ count: string }>("SELECT count(*) FROM movies");
  if (count !== "0") process.exitCode = 0;
  else {
    const users = [
      [
        process.env.DEMO_CUSTOMER_EMAIL ?? "customer@frame.test",
        process.env.DEMO_CUSTOMER_PASSWORD ?? "FrameGuest2026!",
        "Frame Guest",
        "customer",
      ],
      [
        process.env.DEMO_RIVAL_EMAIL ?? "rival@frame.test",
        process.env.DEMO_RIVAL_PASSWORD ?? "FrameRival2026!",
        "Frame Rival",
        "customer",
      ],
      [
        process.env.DEMO_ADMIN_EMAIL ?? "admin@frame.test",
        process.env.DEMO_ADMIN_PASSWORD ?? "FrameAdmin2026!",
        "Frame Admin",
        "admin",
      ],
    ];
    for (const [email, password, name, role] of users)
      await client.query(
        "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4)",
        [name, email, hash(password), role],
      );
    const films = JSON.parse(
      await readFile(join(import.meta.dirname, "catalogue.json"), "utf8"),
    );
    for (const film of films)
      await client.query(
        "INSERT INTO movies(title,description,language,duration_minutes,rating,poster_url,backdrop_url,genre,release_date,certification,credits) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        [
          film.title,
          film.description,
          film.language,
          film.duration_minutes,
          film.rating,
          `/posters/${film.asset}.svg`,
          `/backdrops/${film.asset}.svg`,
          film.genre,
          film.release_date,
          film.certification,
          JSON.stringify(film.credits),
        ],
      );
    const { rows: movies } = await client.query<{
      id: number;
      duration_minutes: number;
    }>("SELECT id,duration_minutes FROM movies ORDER BY id");
    for (let day = 1; day <= 7; day++)
      for (let slot = 0; slot < 3; slot++) {
        const movie = movies[(day + slot) % movies.length];
        const start = new Date();
        start.setUTCDate(start.getUTCDate() + day);
        start.setUTCHours(7 + slot * 5, 0, 0, 0);
        await client.query(
          "INSERT INTO shows(movie_id,starts_at,ends_at,price_paise) VALUES($1,$2,$3,$4)",
          [
            movie.id,
            start,
            new Date(start.getTime() + movie.duration_minutes * 60000),
            25000 + slot * 10000,
          ],
        );
      }
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
