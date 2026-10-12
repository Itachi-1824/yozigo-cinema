import { expect, test, type Page } from '@playwright/test';

const admin = { email: 'admin@frame.test', password: 'FrameAdmin2026!' };
const guest = { email: 'customer@frame.test', password: 'FrameGuest2026!' };
const rival = { email: 'rival@frame.test', password: 'FrameRival2026!' };

async function login(page: Page, credentials = guest) {
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Email address').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('dialog').getByRole('button', { name: /^Sign in/ }).click();
  await expect(page.locator('.user-name')).toContainText('Hi,');
}

test.beforeEach(async ({ request }) => {
  await expect.poll(async () => (await request.get('/api/movies')).status(), { timeout: 30_000 }).toBe(200);
});

async function firstShow(page: Page) {
  await page.getByRole('button', { name: /Explore what’s on/ }).click();
  await page.getByRole('button', { name: /seats available/ }).first().click();
  await expect(page.getByRole('group', { name: 'Cinema seats' })).toBeVisible();
}

async function createHold(page: Page, seat: string) {
  await page.getByRole('button', { name: new RegExp(`^${seat}, available$`) }).click();
  await page.getByRole('button', { name: /^Continue/ }).click();
  await expect(page.getByRole('dialog', { name: 'Ready for the big screen?' })).toBeVisible();
}

async function signUp(page: Page, email: string) {
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Full name').fill('Playwright Customer');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill('FramePass2026!');
  await page.getByRole('button', { name: /Create account/ }).click();
}

test('catalogue searches and authentication reports generic invalid and duplicate credentials', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Now showing.')).toBeVisible();
  await expect(page.locator('.movie-card')).toHaveCount(4);
  await page.getByPlaceholder('Find a film').fill('Neon');
  await expect(page.locator('.movie-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Email address').fill('unknown@frame.test');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('dialog').getByRole('button', { name: /^Sign in/ }).click();
  await expect(page.getByRole('alert')).toContainText(/invalid|credentials/i);
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Full name').fill('Duplicate Customer');
  await page.getByLabel('Email address').fill(guest.email);
  await page.getByLabel('Password').fill('FramePass2026!');
  await page.getByRole('button', { name: /Create account/ }).click();
  await expect(page.getByRole('alert')).toContainText(/already|email/i);
});

test('signup reaches the real authenticated 80-seat map and limits a selection to six', async ({ page }) => {
  const email = `e2e-${Date.now()}@frame.test`;
  await page.goto('/');
  await signUp(page, email);
  await firstShow(page);
  await expect(page.getByRole('button', { name: /, available$/ })).toHaveCount(80);
  for (const seat of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7']) await page.getByRole('button', { name: new RegExp(`^${seat}, available$`) }).click();
  await expect(page.getByRole('alert')).toContainText('up to 6');
  await expect(page.getByText('A1, A2, A3, A4, A5, A6')).toBeVisible();
});

test('failed payment retains a hold, retry confirms it, exposes ticket and booking history', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await firstShow(page);
  await createHold(page, 'H10');
  await page.getByRole('button', { name: 'Simulate failed payment' }).click();
  await expect(page.getByRole('dialog', { name: 'Ready for the big screen?' }).getByRole('alert')).toContainText('Payment failed');
  await expect(page.getByText(/H10 are held until/)).toBeVisible();
  await page.getByRole('button', { name: /Complete demo payment/ }).click();
  await expect(page.getByText('See you at the movies.')).toBeVisible();
  await expect(page.getByText('H10')).toBeVisible();
  await page.getByRole('link', { name: 'My bookings' }).click();
  await expect(page.getByText('Coming up')).toBeVisible();
  await expect(page.getByText('Seats H10')).toBeVisible();
});

test('two browser sessions race the same seat and the loser sees its held state through polling', async ({ browser }) => {
  const one = await browser.newContext();
  const two = await browser.newContext();
  const pageOne = await one.newPage();
  const pageTwo = await two.newPage();
  try {
    await Promise.all([pageOne.goto('/'), pageTwo.goto('/')]);
    await login(pageOne, guest); await login(pageTwo, rival);
    await firstShow(pageOne);
    const showUrl = pageOne.url();
    await pageTwo.goto(showUrl);
    await expect(pageTwo.getByRole('group', { name: 'Cinema seats' })).toBeVisible();
    await Promise.all([
      createHold(pageOne, 'H9'),
      createHold(pageTwo, 'H9').catch(() => undefined)
    ]);
    const dialogs = [pageOne.getByRole('dialog', { name: 'Ready for the big screen?' }), pageTwo.getByRole('dialog', { name: 'Ready for the big screen?' })];
    await expect.poll(async () => (await dialogs[0].count()) + (await dialogs[1].count()), { timeout: 8_000 }).toBe(1);
    const loser = await dialogs[0].count() ? pageTwo : pageOne;
    await expect.poll(async () => await loser.getByRole('button', { name: 'H9, on hold' }).count(), { timeout: 8_000 }).toBe(1);
    await expect(loser.getByRole('button', { name: 'H9, on hold' })).toBeDisabled();
  } finally { await one.close(); await two.close(); }
});

test('unauthorized and cross-account booking APIs deny access and ownership', async ({ browser, request }) => {
  const publicResponse = await request.get('/api/bookings');
  expect(publicResponse.status()).toBe(401);
  expect((await request.get('/api/admin/shows')).status()).toBe(401);
  const owner = await browser.newContext();
  const intruder = await browser.newContext();
  try {
    const ownerPage = await owner.newPage(); const intruderPage = await intruder.newPage();
    await ownerPage.goto('/'); await login(ownerPage); await firstShow(ownerPage); await createHold(ownerPage, 'H8');
    await ownerPage.getByRole('button', { name: /Complete demo payment/ }).click();
    await expect(ownerPage.getByText('See you at the movies.')).toBeVisible();
    const id = ownerPage.url().split('/').at(-1)!;
    await intruderPage.goto('/'); await login(intruderPage, rival);
    const response = await intruderPage.request.get(`/api/bookings/${id}`);
    expect(response.status()).toBe(404);
  } finally { await owner.close(); await intruder.close(); }
});

test('admin can add, edit and delete a film, rejects an overlapping show, and a customer cannot open admin', async ({ browser }) => {
  const adminContext = await browser.newContext();
  const customerContext = await browser.newContext();
  try {
    const page = await adminContext.newPage();
    await page.goto('/'); await login(page, admin); await page.getByRole('link', { name: 'Studio admin' }).click();
    await page.getByRole('button', { name: 'Films' }).click();
    const title = `E2E Film ${Date.now()}`;
    await page.getByRole('button', { name: 'Add film' }).click();
    await page.getByLabel('Title').fill(title); await page.getByLabel('Description').fill('A test film.');
    await page.getByLabel('Genre').fill('Drama'); await page.getByLabel('Language').fill('English'); await page.getByLabel('Duration (minutes)').fill('100');
    await page.getByLabel('Poster URL').fill('/posters/orbit.svg'); await page.getByLabel('Backdrop URL').fill('/backdrops/orbit.svg');
    await page.getByRole('button', { name: 'Add film' }).click();
    const item = page.locator('.admin-film', { hasText: title }); await expect(item).toBeVisible();
    await item.getByRole('button', { name: 'Edit' }).click(); await page.getByLabel('Title').fill(`${title} edited`); await page.getByRole('button', { name: 'Save changes' }).click();
    const edited = page.locator('.admin-film', { hasText: `${title} edited` }); await expect(edited).toBeVisible();
    page.once('dialog', dialog => dialog.accept()); await edited.getByRole('button', { name: 'Delete' }).click(); await expect(edited).toHaveCount(0);
    await page.getByRole('button', { name: 'Showtimes' }).click();
    const date = new Date(Date.now() + 370 * 24 * 60 * 60 * 1_000);
    const startsAt = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T18:00`;
    await page.getByRole('button', { name: 'Add show' }).click();
    await page.getByLabel('Start time (your local time)').fill(startsAt); await page.getByLabel('Ticket price (₹)').fill('300');
    await page.getByRole('button', { name: 'Create show' }).click();
    await expect(page.getByRole('dialog', { name: 'Add a show' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Add show' }).click();
    await page.getByLabel('Start time (your local time)').fill(startsAt); await page.getByLabel('Ticket price (₹)').fill('300');
    await page.getByRole('button', { name: 'Create show' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    const customer = await customerContext.newPage(); await customer.goto('/#admin'); await expect(customer.getByText('Studio access only')).toBeVisible();
    expect((await customer.request.get('/api/admin/shows')).status()).toBe(403);
  } finally { await adminContext.close(); await customerContext.close(); }
});

test('cancellation changes the ticket status and releases the seat', async ({ page }) => {
  await page.goto('/'); await login(page, rival); await firstShow(page); await createHold(page, 'H7');
  await page.getByRole('button', { name: /Complete demo payment/ }).click();
  await expect(page.getByText('See you at the movies.')).toBeVisible();
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Cancel this booking' }).click();
  await expect(page.getByText('BOOKING CANCELLED')).toBeVisible();
  await page.reload(); await expect(page.getByRole('button', { name: 'H7, available' })).toBeVisible();
});
