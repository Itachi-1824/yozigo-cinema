import { mkdir } from "node:fs/promises";
import { renderDemo } from "./render-demo.mjs";
import { chromium, request } from "@playwright/test";
import { fileURLToPath } from "node:url";

const baseURL = process.env.FRAME_DEMO_URL || "http://127.0.0.1:4321";
const out = new URL("../artifacts/demo/", import.meta.url);
const raw = new URL("./raw/", out);
const outDir = fileURLToPath(out);
const rawDir = fileURLToPath(raw);
const stamp = Date.now();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

await mkdir(rawDir, { recursive: true });

async function apiLogin(api, email, password) {
  const response = await api.post("/api/auth/login", {
    data: { email, password },
  });
  assert(response.status() === 200, `admin login failed: ${response.status()}`);
  return response.json();
}

async function createRaceShow() {
  const api = await request.newContext({ baseURL });
  try {
    const { csrf_token: csrf } = await apiLogin(
      api,
      "admin@frame.test",
      "FrameAdmin2026!",
    );
    const movies = await api.get("/api/admin/movies");
    assert(movies.status() === 200, `list films failed: ${movies.status()}`);
    const film = (await movies.json()).find(
      (movie) => movie.title === "Beyond the Blue",
    );
    assert(film, "Beyond the Blue is unavailable for the race show");
    const shows = await api.get("/api/admin/shows");
    assert(shows.status() === 200, "list screenings failed");
    let starts = new Date(Date.now() + 36 * 3600000);
    starts.setUTCHours(3, 30, 0, 0);
    for (const screening of await shows.json()) {
      if (starts.getTime() < new Date(screening.ends_at).getTime() &&
          starts.getTime() + film.duration_minutes * 60000 > new Date(screening.starts_at).getTime()) {
        starts = new Date(new Date(screening.ends_at).getTime() + 10 * 60000);
      }
    }
    const show = await api.post("/api/admin/shows", {
      headers: { "x-csrf-token": csrf },
      data: {
        movie_id: Number(film.id),
        starts_at: starts.toISOString(),
        price_paise: 35000,
      },
    });
    assert(
      show.status() === 200 || show.status() === 201,
      `race show failed: ${show.status()} ${await show.text()}`,
    );
    return { film, show: await show.json(), starts };
  } finally {
    await api.dispose();
  }
}

async function login(page, email, password) {
  await page.goto(`${baseURL}/#login`);
  await page.getByRole('heading', { name: 'Welcome back.' }).waitFor();
  await page.locator('.auth-form-inner').getByLabel("Email address").fill(email);
  await page.locator('.auth-form-inner input[name="password"]').fill(password);
  await page
    .locator('.auth-form-inner')
    .getByRole("button", { name: /^Sign in$/ })
    .click();
  await page.locator(".user-name").waitFor();
}

async function signup(page, name, email) {
  await page.goto(`${baseURL}/#signup`);
  await page.getByRole('heading', { name: 'Come on in.' }).waitFor();
  await page.locator('.auth-form-inner').getByLabel("Full name").fill(name);
  await page.locator('.auth-form-inner').getByLabel("Email address").fill(email);
  await page.locator('.auth-form-inner input[name="password"]').fill("FramePass2026!");
  await page
    .locator('.auth-form-inner')
    .getByRole("button", { name: /^Create account$/ })
    .click();
  await page.locator(".user-name").waitFor();
}

async function firstAvailable(page, count = 1) {
  const labels = await page
    .getByRole("button", { name: /^[A-H]\d+, available$/ })
    .evaluateAll((nodes, limit) =>
      nodes
        .slice(0, limit)
        .map((node) => node.getAttribute("aria-label").split(",")[0]),
      count,
    );
  assert(
    labels.length === count,
    `expected ${count} available seats, got ${labels.length}`,
  );
  return labels;
}

async function chooseMainShow(page) {
  await page.locator('.editorial-film').first().getByRole("button", { name: "View showtimes", exact: true }).click();
  await page
    .getByRole("button", { name: /of 80 available/ })
    .first()
    .click();
  await page.getByRole("group", { name: "Cinema seats" }).waitFor();
}

const race = await createRaceShow();
const browser = await chromium.launch({ headless: true });
let mainContext,
  adminContext,
  leftContext,
  rightContext,
  mainRecording,
  leftRecording,
  rightRecording,
  adminRecording;
try {
  mainContext = await browser.newContext({
    recordVideo: { dir: rawDir, size: { width: 1280, height: 720 } },
    viewport: { width: 1280, height: 720 },
  });
  const main = await mainContext.newPage();
  mainRecording = main.video();
  await main.goto(baseURL);
  await main.getByRole("heading", { name: "Now showing", exact: true }).waitFor();
  await pause(12000);
  await main.getByRole('search').getByRole('textbox', { name: 'Search films', exact: true }).fill("Neon");
  await pause(7000);
  await main.getByRole('search').getByRole('textbox', { name: 'Search films', exact: true }).fill("");
  await pause(5000);
  await main.locator('.editorial-film').first().getByRole("button", { name: "View showtimes", exact: true }).click();
  await main.getByRole("heading", { name: "Showtimes", exact: true }).waitFor();
  await pause(10000);
  await main.goto(baseURL);
  await signup(main, "Demo Customer", `demo-${stamp}@frame.test`);
  await pause(5000);
  await chooseMainShow(main);
  const seven = await firstAvailable(main, 7);
  for (const seat of seven)
    await main.getByRole("button", { name: `${seat}, available` }).click();
  await main.getByRole("alert").filter({ hasText: "up to 6" }).waitFor();
  await pause(10000);
  for (const seat of seven.slice(1, 6))
    await main.getByRole("button", { name: `${seat}, selected` }).click();
  const heldSeat = seven[0];
  const holdResponse = main.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/api\/shows\/\d+\/holds$/.test(new URL(response.url()).pathname),
  );
  await main.getByRole("button", { name: /^Continue/ }).click();
  assert((await holdResponse).status() === 201, "main hold was not created");
  await main
    .getByRole("dialog", { name: "Review booking" })
    .waitFor();
  await pause(10000);
  await main.reload();
  await main.locator('.hold-clock').waitFor();
  await pause(7000);
  await main.getByRole("button", { name: /Continue to payment/ }).click();
  await main.getByRole("button", { name: "Simulate failed payment" }).click();
  await main
    .getByRole("dialog")
    .getByRole("alert")
    .filter({ hasText: "Payment failed" })
    .waitFor();
  await pause(8000);
  await main.getByRole("button", { name: "Try again" }).click();
  await main.getByText("See you at the movies.").waitFor();
  await pause(12000);
  const bookingId = main.url().split("/").at(-1);
  assert(bookingId, "booking id missing");
  await main
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "My bookings" })
    .click();
  await main
    .locator(".booking-item")
    .filter({ hasText: `Seats ${heldSeat}` })
    .first()
    .waitFor();
  await pause(9000);
  main.once("dialog", (dialog) => dialog.accept());
  await main.getByRole("button", { name: "Cancel booking" }).first().click();
  await main.getByText("Past & cancelled").waitFor();
  await pause(7000);
  await mainContext.close();

  leftContext = await browser.newContext({
    recordVideo: { dir: rawDir, size: { width: 1280, height: 720 } },
    viewport: { width: 1280, height: 720 },
  });
  rightContext = await browser.newContext({
    recordVideo: { dir: rawDir, size: { width: 1280, height: 720 } },
    viewport: { width: 1280, height: 720 },
  });
  const left = await leftContext.newPage(),
    right = await rightContext.newPage();
  leftRecording = left.video();
  rightRecording = right.video();
  await Promise.all([left.goto(baseURL), right.goto(baseURL)]);
  await Promise.all([
    signup(left, "Race Left", `race-left-${stamp}@frame.test`),
    signup(right, "Race Right", `race-right-${stamp}@frame.test`),
  ]);
  await Promise.all([
    left.goto(`${baseURL}/#seats/${race.show.id}`),
    right.goto(`${baseURL}/#seats/${race.show.id}`),
  ]);
  await Promise.all([
    left.getByRole("group", { name: "Cinema seats" }).waitFor(),
    right.getByRole("group", { name: "Cinema seats" }).waitFor(),
  ]);
  const [raceSeat] = await firstAvailable(left);
  await Promise.all([
    left.getByRole("button", { name: `${raceSeat}, available` }).click(),
    right.getByRole("button", { name: `${raceSeat}, available` }).click(),
  ]);
  await pause(6000);
  const one = left.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      /\/api\/shows\/\d+\/holds$/.test(new URL(r.url()).pathname),
  );
  const two = right.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      /\/api\/shows\/\d+\/holds$/.test(new URL(r.url()).pathname),
  );
  await Promise.all([
    left.getByRole("button", { name: /^Continue/ }).click(),
    right.getByRole("button", { name: /^Continue/ }).click(),
  ]);
  const [oneResult, twoResult] = await Promise.all([one, two]);
  assert(
    [oneResult.status(), twoResult.status()].sort().join(",") === "201,409",
    `race statuses ${oneResult.status()},${twoResult.status()}`,
  );
  const winner = oneResult.status() === 201 ? left : right,
    loser = winner === left ? right : left;
  await winner
    .getByRole("dialog", { name: "Review booking" })
    .waitFor();
  await loser
    .getByRole("alert")
    .filter({ hasText: /Choose another seat/ })
    .waitFor();
  await loser.getByRole("button", { name: `${raceSeat}, on hold` }).waitFor();
  await pause(15000);
  await winner.getByRole("button", { name: "Complete demo payment" }).click();
  await winner.getByText("See you at the movies.").waitFor();
  await pause(8000);
  const winnerBooking = winner.url().split("/").at(-1);
  assert(winnerBooking, "race booking missing");
  await Promise.all([leftContext.close(), rightContext.close()]);

  adminContext = await browser.newContext({ recordVideo: { dir: rawDir, size: { width: 1280, height: 720 } }, viewport: { width: 1280, height: 720 } });
  const admin = await adminContext.newPage();
  adminRecording = admin.video();
  await login(admin, "admin@frame.test", "FrameAdmin2026!");
  await admin.getByRole("link", { name: "Studio admin" }).click();
  await admin.getByText("Studio admin.").waitFor();
  await pause(10000);
  const raceItem = admin.locator(`[data-show-id="${race.show.id}"]`);
  await raceItem.getByRole("button", { name: "View details" }).click();
  await admin.getByText("Customer bookings").waitFor();
  await pause(9000);
  await admin.getByRole("button", { name: "Close" }).click();
  await admin.getByRole("button", { name: "Films" }).click();
  await admin.locator(".admin-section-title").getByRole("button", { name: "Add film", exact: true }).click();
  const title = `Demo edit ${stamp}`;
  await admin.getByLabel("Title").fill(title);
  await admin.getByLabel("Description").fill("An on-screen CRUD demonstration.");
  await admin.getByLabel("Genre").fill("Drama");
  await admin.getByLabel("Language").fill("English");
  await admin.getByLabel("Duration (minutes)").fill("90");
  await admin.getByLabel("Poster URL").fill("/posters/orbit.svg");
  await admin.getByLabel("Backdrop URL").fill("/backdrops/orbit.svg");
  const creating = admin.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/admin/movies");
  await admin
    .getByRole("dialog", { name: "Add a film", exact: true })
    .getByRole("button", { name: "Add film" })
    .click();
  const created = await creating;
  assert(created.status() === 201, "film creation failed");
  const demoFilm = await created.json();
  const item = admin.locator(".admin-film", { hasText: title });
  await item.waitFor();
  await pause(5000);
  await item.getByRole("button", { name: "Edit" }).click();
  await admin.getByLabel("Title").fill(`${title} updated`);
  const editing = admin.waitForResponse(response => response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/admin/movies/${demoFilm.id}`);
  await admin.getByRole("button", { name: "Save changes" }).click();
  assert((await editing).status() === 200, "film update failed");
  const updated = admin.locator(".admin-film", { hasText: `${title} updated` });
  await updated.waitFor();
  await pause(5000);
  admin.once("dialog", (dialog) => dialog.accept());
  const deleting = admin.waitForResponse(response => response.request().method() === "DELETE" && new URL(response.url()).pathname === `/api/admin/movies/${demoFilm.id}`);
  await updated.getByRole("button", { name: "Delete" }).click();
  assert((await deleting).ok(), "film deletion failed");
  await updated.waitFor({ state: "detached" });
  await pause(5000);
  await admin.getByRole("button", { name: "Showtimes" }).click();
  await admin.getByRole("button", { name: "Add show" }).click();
  await admin.locator('select[name="movie_id"]').selectOption(String(race.film.id));
  const local = new Date(
    race.starts.getTime() - race.starts.getTimezoneOffset() * 60000,
  )
    .toISOString()
    .slice(0, 16);
  await admin.getByLabel("Start time (your local time)").fill(local);
  await admin.getByLabel("Ticket price (₹)").fill("350");
  const overlap = admin.getByRole("dialog", { name: "Add a show", exact: true });
  const overlapResponse = admin.waitForResponse(response => response.request().method() === "POST" && /\/api\/admin\/shows$/.test(new URL(response.url()).pathname));
  await overlap.getByRole("button", { name: "Create show" }).click();
  assert((await overlapResponse).status() === 409, "overlap validation did not reject the show");
  await overlap.getByRole("alert").waitFor();
  await pause(6000);
  await admin.getByRole("button", { name: "Close" }).click();
  await pause(5000);
  await adminContext.close();
} finally {
  const cleanup = await Promise.allSettled([leftContext?.close(), rightContext?.close(), mainContext?.close(), adminContext?.close(), browser.close()]);
  const failures = cleanup.filter(result => result.status === 'rejected');
  if (failures.length) console.error(`Capture cleanup failures: ${failures.map(result => result.reason instanceof Error ? result.reason.message : String(result.reason)).join('; ')}`);
}

const [mainVideo, leftVideo, rightVideo, adminVideo] = await Promise.all([
  mainRecording.path(),
  leftRecording.path(),
  rightRecording.path(),
  adminRecording.path(),
]);
await renderDemo([mainVideo, leftVideo, rightVideo, adminVideo], outDir);
