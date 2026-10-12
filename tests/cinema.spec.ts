import { expect, test, type Page } from "@playwright/test";

test("loading follows real readiness and a failed catalogue can be retried", async ({
  page,
}) => {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/movies", async (route) => {
    await ready;
    await route.continue();
  });
  await page.goto("/");
  try {
    await expect(
      page.getByRole("heading", { name: "Setting the scene." }),
    ).toBeVisible();
    await expect(page.locator(".boot-screen")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await page.screenshot({ path: "artifacts/loading-screen.png" });
  } finally {
    release();
  }
  await expect(
    page.getByRole("heading", { name: "Now showing", exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/movies");
  await page.route("**/api/movies", (route) => route.abort("failed"));
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A brief intermission." }),
  ).toBeVisible();
  await page.unroute("**/api/movies");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Now showing", exact: true }),
  ).toBeVisible();
});

const admin = { email: "admin@frame.test", password: "FrameAdmin2026!" };
const guest = { email: "customer@frame.test", password: "FrameGuest2026!" };
const rival = { email: "rival@frame.test", password: "FrameRival2026!" };

test("a failed screening request is reported and retry restores actual showtimes", async ({
  page,
}) => {
  await page.route("**/api/movies/1", (route) => route.abort("failed"));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Some showtimes could not be loaded",
  );
  const film = page.locator(".editorial-film").filter({
    has: page.getByRole("heading", { name: "Beyond the Blue", exact: true }),
  });
  await expect(
    film.getByText("Showtimes unavailable", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/movies/1");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(film.locator(".next-show")).toContainText("Next:");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

async function login(page: Page, credentials = guest) {
  await page.goto("/#login");
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await page.getByLabel("Email address").fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
}

test.beforeEach(async ({ request }) => {
  await expect
    .poll(async () => (await request.get("/api/movies")).status(), {
      timeout: 30_000,
    })
    .toBe(200);
});

async function firstShow(page: Page) {
  await page
    .locator(".editorial-film")
    .first()
    .getByRole("button", { name: "View showtimes", exact: true })
    .click();
  await page
    .getByRole("button", { name: /of 80 available/ })
    .first()
    .click();
  await expect(page.getByRole("group", { name: "Cinema seats" })).toBeVisible();
}

async function createHold(page: Page, seat: string) {
  await page
    .getByRole("button", { name: new RegExp(`^${seat}, available$`) })
    .click();
  await page.getByRole("button", { name: /^Continue/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Review booking" }),
  ).toBeVisible();
}

async function availableSeats(page: Page, count: number) {
  const seats = await page
    .getByRole("button", { name: /^[A-H]\d+, available$/ })
    .evaluateAll(
      (nodes, limit) =>
        nodes
          .slice(0, limit)
          .map((node) => node.getAttribute("aria-label")!.split(",")[0]),
      count,
    );
  expect(seats).toHaveLength(count);
  return seats;
}

async function signUp(page: Page, email: string, next = "") {
  await page.goto(next ? `/#signup/${encodeURIComponent(next)}` : "/#signup");
  await expect(
    page.getByRole("heading", { name: "Come on in." }),
  ).toBeVisible();
  await page.getByLabel("Full name").fill("Playwright Customer");
  await page.getByLabel("Email address").fill(email);
  await page.locator('input[name="password"]').fill("FramePass2026!");
  await page
    .locator("form")
    .getByRole("button", { name: "Create account" })
    .click();
}

test("catalogue searches and authentication reports generic invalid and duplicate credentials", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Now showing", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".editorial-film")).toHaveCount(4);
  await page
    .getByRole("search")
    .getByRole("textbox", { name: "Search films", exact: true })
    .fill("Neon");
  await expect(page.locator(".editorial-film")).toHaveCount(1);
  await page
    .getByRole("button", { name: "View Neon City showtimes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Neon City", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Cast & crew", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Zara Quinn", { exact: true })).toBeVisible();
  const search = page
    .getByRole("search")
    .getByRole("textbox", { name: "Search films", exact: true });
  await search.fill("Beyond");
  await search.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Now showing", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".editorial-film")).toHaveCount(1);
  await expect(page.locator(".editorial-film").getByRole("heading")).toHaveText(
    "Beyond the Blue",
  );
  await search.fill("");
  await page
    .getByRole("group", { name: "Filter by language" })
    .getByRole("button", { name: "Hindi", exact: true })
    .click();
  await expect(page.locator(".editorial-film")).toHaveCount(1);
  await expect(page.locator(".editorial-film").getByRole("heading")).toHaveText(
    "Monsoon Letters",
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await page.getByLabel("Email address").fill("unknown@frame.test");
  await page.locator('input[name="password"]').fill("wrong-password");
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText(/invalid|credentials/i);
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Full name").fill("Duplicate Customer");
  await page.getByLabel("Email address").fill(guest.email);
  await page.locator('input[name="password"]').fill("FramePass2026!");
  await page
    .locator("form")
    .getByRole("button", { name: "Create account" })
    .click();
  await expect(page.getByRole("alert")).toContainText(/already|email/i);
});

test("signup reaches the real authenticated 80-seat map and limits a selection to six", async ({
  page,
}) => {
  const email = `e2e-${Date.now()}@frame.test`;
  await signUp(page, email, "seats/1");
  await expect(page).toHaveURL(/#seats\/1$/);
  await expect(page.getByRole("group", { name: "Cinema seats" })).toBeVisible();
  await expect(page.locator(".seat")).toHaveCount(80);
  const seats = await availableSeats(page, 7);
  for (const seat of seats)
    await page
      .getByRole("button", { name: new RegExp(`^${seat}, available$`) })
      .click();
  await expect(page.getByRole("alert")).toContainText("up to 6");
  await expect(page.getByText(seats.slice(0, 6).join(", "))).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const targets = await page.locator(".seat").evaluateAll((nodes) =>
    nodes.map((node) => ({
      width: node.getBoundingClientRect().width,
      height: node.getBoundingClientRect().height,
    })),
  );
  expect(
    targets.every((target) => target.width >= 44 && target.height >= 44),
  ).toBe(true);
  await expect
    .poll(() =>
      page
        .locator(".summary-panel")
        .evaluate((node) =>
          Math.abs(node.getBoundingClientRect().bottom - window.innerHeight),
        ),
    )
    .toBeLessThan(2);
  expect(
    await page
      .locator(".summary-panel")
      .evaluate(
        (node) => node.getBoundingClientRect().top > window.innerHeight / 2,
      ),
  ).toBe(true);
});

test("failed payment retains a hold, retry confirms it, exposes ticket and booking history", async ({
  page,
}) => {
  await page.goto("/");
  await login(page);
  await firstShow(page);
  const [seat] = await availableSeats(page, 1);
  await createHold(page, seat);
  await page.getByRole("button", { name: "Simulate failed payment" }).click();
  await expect(
    page.getByRole("dialog", { name: "Review booking" }).getByRole("alert"),
  ).toContainText("Payment failed");
  await expect(
    page.getByText(new RegExp(`${seat} are held until`)),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("See you at the movies.")).toBeVisible();
  const bookingId = page.url().split("/").at(-1)!;
  await expect(page.getByText(seat)).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "My bookings" })
    .click();
  await expect(page.getByText("Coming up")).toBeVisible();
  await expect(
    page
      .locator(".booking-item")
      .filter({ hasText: `Seats ${seat}` })
      .first(),
  ).toBeVisible();
  await page.goto(`/#ticket/${bookingId}`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancel this booking" }).click();
  await expect(page.locator(".ticket-status")).toHaveText("BOOKING CANCELLED");
});

test("two sessions race one seat, live states update, and admin sees the booking details", async ({
  browser,
}) => {
  const one = await browser.newContext();
  const two = await browser.newContext();
  const staff = await browser.newContext();
  const pageOne = await one.newPage();
  const pageTwo = await two.newPage();
  try {
    await Promise.all([pageOne.goto("/"), pageTwo.goto("/")]);
    await signUp(pageOne, `race-one-${Date.now()}@frame.test`);
    await signUp(pageTwo, `race-two-${Date.now()}@frame.test`);
    await firstShow(pageOne);
    const showUrl = pageOne.url();
    await pageTwo.goto(showUrl);
    await expect(
      pageTwo.getByRole("group", { name: "Cinema seats" }),
    ).toBeVisible();
    const [seat] = await availableSeats(pageOne, 1);
    await Promise.all([
      pageOne.getByRole("button", { name: `${seat}, available` }).click(),
      pageTwo.getByRole("button", { name: `${seat}, available` }).click(),
    ]);
    const oneHold = pageOne.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/api\/shows\/\d+\/holds$/.test(new URL(response.url()).pathname),
    );
    const twoHold = pageTwo.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/api\/shows\/\d+\/holds$/.test(new URL(response.url()).pathname),
    );
    await Promise.all([
      pageOne.getByRole("button", { name: /^Continue/ }).click(),
      pageTwo.getByRole("button", { name: /^Continue/ }).click(),
    ]);
    const [oneResponse, twoResponse] = await Promise.all([oneHold, twoHold]);
    expect([oneResponse.status(), twoResponse.status()].sort()).toEqual([
      201, 409,
    ]);
    const winner = oneResponse.status() === 201 ? pageOne : pageTwo;
    const loser = winner === pageOne ? pageTwo : pageOne;
    await expect(
      winner.getByRole("dialog", { name: "Review booking" }),
    ).toBeVisible();
    await expect(
      loser.getByRole("alert").filter({ hasText: /Choose another seat/ }),
    ).toContainText(/no longer available/i);
    await expect
      .poll(
        async () =>
          await loser.getByRole("button", { name: `${seat}, on hold` }).count(),
        { timeout: 8_000 },
      )
      .toBe(1);
    await expect(
      loser.getByRole("button", { name: `${seat}, on hold` }),
    ).toBeDisabled();
    await winner.getByRole("button", { name: "Complete demo payment" }).click();
    await expect(winner.getByText("See you at the movies.")).toBeVisible();
    const bookingId = winner.url().split("/").at(-1)!;
    const stored = await (
      await winner.request.get(`/api/bookings/${bookingId}`)
    ).json();
    await expect(loser.getByRole("button", { name: `${seat}, booked` })).toBeDisabled();
    const adminPage = await staff.newPage();
    await login(adminPage, admin);
    await adminPage.getByRole("link", { name: "Studio admin" }).click();
    const showId = showUrl.split("/").at(-1)!;
    await adminPage
      .locator(`.admin-show[data-show-id="${showId}"]`)
      .getByRole("button", { name: "View details" })
      .click();
    const entry = adminPage.locator(".inspector-bookings > div").filter({ hasText: bookingId });
    await expect(entry).toContainText(seat);
    await expect(entry).toContainText("Booked");
    const bookedTime = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true,
    }).format(new Date(stored.created_at));
    await expect(entry).toContainText(bookedTime);
    await expect(adminPage.locator(".mini-seat-map .mini-seat")).toHaveCount(80);
    await winner.goto(`/#ticket/${bookingId}`);
    winner.once("dialog", dialog => dialog.accept());
    await winner.getByRole("button", { name: "Cancel this booking" }).click();
    await expect(winner.locator(".ticket-status")).toHaveText("BOOKING CANCELLED");
  } finally {
    await one.close();
    await two.close();
    await staff.close();
  }
});

test("unauthorized and cross-account booking APIs deny access and ownership", async ({
  browser,
  request,
}) => {
  const publicResponse = await request.get("/api/bookings");
  expect(publicResponse.status()).toBe(401);
  expect((await request.get("/api/admin/shows")).status()).toBe(401);
  const owner = await browser.newContext();
  const intruder = await browser.newContext();
  try {
    const ownerPage = await owner.newPage();
    const intruderPage = await intruder.newPage();
    await ownerPage.goto("/");
    await login(ownerPage);
    await firstShow(ownerPage);
    await createHold(ownerPage, (await availableSeats(ownerPage, 1))[0]);
    await ownerPage
      .getByRole("button", { name: /Complete demo payment/ })
      .click();
    await expect(ownerPage.getByText("See you at the movies.")).toBeVisible();
    const id = ownerPage.url().split("/").at(-1)!;
    await intruderPage.goto("/");
    await login(intruderPage, rival);
    const response = await intruderPage.request.get(`/api/bookings/${id}`);
    expect(response.status()).toBe(404);
    await ownerPage.goto(`/#ticket/${id}`);
    ownerPage.once("dialog", (dialog) => dialog.accept());
    await ownerPage
      .getByRole("button", { name: "Cancel this booking" })
      .click();
    await expect(ownerPage.locator(".ticket-status")).toHaveText(
      "BOOKING CANCELLED",
    );
  } finally {
    await owner.close();
    await intruder.close();
  }
});

test("admin can add, edit and delete a film, rejects an overlapping show, and a customer cannot open admin", async ({
  browser,
}) => {
  const adminContext = await browser.newContext();
  const customerContext = await browser.newContext();
  try {
    const page = await adminContext.newPage();
    await page.goto("/");
    await login(page, admin);
    await page.getByRole("link", { name: "Studio admin" }).click();
    await page.getByRole("button", { name: "Films" }).click();
    const title = `E2E Film ${Date.now()}`;
    await page
      .locator(".admin-section-title")
      .getByRole("button", { name: "Add film" })
      .click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Description").fill("A test film.");
    await page.getByLabel("Genre").fill("Drama");
    await page.getByLabel("Language").fill("English");
    await page.getByLabel("Duration (minutes)").fill("100");
    await page.getByLabel("Poster URL").fill("/posters/orbit.svg");
    await page.getByLabel("Backdrop URL").fill("/backdrops/orbit.svg");
    await page.getByLabel("Release date", { exact: true }).fill("2026-10-09");
    await page.getByRole("button", { name: "Add credit", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Credit 1 name", exact: true })
      .fill("Sample Actor");
    await page
      .getByRole("textbox", { name: "Credit 1 role", exact: true })
      .fill("Lead cast");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add film" })
      .click();
    const item = page.locator(".admin-film", { hasText: title });
    await expect(item).toBeVisible();
    const stored = (await (await page.request.get("/api/movies")).json()).find(
      (movie: { title: string }) => movie.title === title,
    );
    expect(stored.credits).toEqual([
      { name: "Sample Actor", role: "Lead cast", image_url: "" },
    ]);
    expect(stored.release_date).toBe("2026-10-09");
    await item.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Title").fill(`${title} edited`);
    await page.getByLabel("Release date", { exact: true }).fill("");
    await page
      .getByRole("button", { name: "Remove credit 1", exact: true })
      .click();
    await page.getByRole("button", { name: "Save changes" }).click();
    const edited = page.locator(".admin-film", { hasText: `${title} edited` });
    await expect(edited).toBeVisible();
    const cleared = await (
      await page.request.get(`/api/movies/${stored.id}`)
    ).json();
    expect(cleared.movie.credits).toEqual([]);
    expect(cleared.movie.release_date).toBe("");
    page.once("dialog", (dialog) => dialog.accept());
    await edited.getByRole("button", { name: "Delete" }).click();
    await expect(edited).toHaveCount(0);
    await page.getByRole("button", { name: "Showtimes" }).click();
    const screenings = await (
      await page.request.get("/api/admin/shows")
    ).json();
    const date = new Date(
      Math.max(
        Date.now() + 370 * 86400000,
        ...screenings.map((show: { ends_at: string }) =>
          new Date(show.ends_at).getTime(),
        ),
      ) + 86400000,
    );
    const startsAt = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T18:00`;
    await page.getByRole("button", { name: "Add show" }).click();
    await page.getByLabel("Start time (your local time)").fill(startsAt);
    await page.getByLabel("Ticket price (₹)").fill("300");
    const creating = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/admin/shows",
    );
    await page.getByRole("button", { name: "Create show" }).click();
    const created = await creating;
    expect(created.status()).toBe(201);
    const createdShowId = (await created.json()).id;
    await expect(page.getByRole("dialog", { name: "Add a show" })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "Add show" }).click();
    await page.getByLabel("Start time (your local time)").fill(startsAt);
    await page.getByLabel("Ticket price (₹)").fill("300");
    await page.getByRole("button", { name: "Create show" }).click();
    await expect(
      page.getByRole("dialog", { name: "Add a show" }).getByRole("alert"),
    ).toBeVisible();
    await page
      .getByRole("dialog", { name: "Add a show" })
      .getByRole("button", { name: "Close" })
      .click();
    const createdShow = page.locator(
      `.admin-show[data-show-id="${createdShowId}"]`,
    );
    page.once("dialog", (dialog) => dialog.accept());
    await createdShow.getByRole("button", { name: "Delete" }).click();
    await expect(createdShow).toHaveCount(0);
    const customer = await customerContext.newPage();
    await login(customer);
    await customer.goto("/#admin");
    await expect(customer.getByText("Studio access only")).toBeVisible();
    expect((await customer.request.get("/api/admin/shows")).status()).toBe(403);
  } finally {
    await adminContext.close();
    await customerContext.close();
  }
});

test("cancellation changes the ticket status and releases the seat", async ({
  page,
}) => {
  await page.goto("/");
  await login(page, rival);
  await firstShow(page);
  const showUrl = page.url();
  const [seat] = await availableSeats(page, 1);
  await createHold(page, seat);
  await page.getByRole("button", { name: /Complete demo payment/ }).click();
  await expect(page.getByText("See you at the movies.")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancel this booking" }).click();
  await expect(page.locator(".ticket-status")).toHaveText("BOOKING CANCELLED");
  await page.goto(showUrl);
  await expect(
    page.getByRole("button", { name: `${seat}, available` }),
  ).toBeVisible();
});
