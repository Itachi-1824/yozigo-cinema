# Review package

Status: prepared for owner review. No hiring email has been sent and no reviewer access has been granted.

## Open

- Local Docker app: http://localhost:8080
- Development preview: http://127.0.0.1:4321
- Private repository: https://github.com/Itachi-1824/yozigo-cinema
- Recording and source archive: https://github.com/Itachi-1824/yozigo-cinema/releases/tag/review-v1
- Setup, test accounts, key decisions and database diagram: [README](../README.md)

## What to review

1. Browse the four fictional films, search/filter, and inspect film details and dated showtimes.
2. Sign up or use the customer account. Choose seats, test the six-seat limit, and continue to a timed hold.
3. Simulate payment failure, retry successfully, inspect the ticket and booking history, and cancel an eligible booking.
4. Watch the two independent customer sessions compete for one seat in the recording. Only one hold succeeds; the other map updates.
5. Sign in as admin. Inspect occupancy, customer bookings, booking IDs and booking times. Add/edit/delete a sample film and try an overlapping screening.
6. Check the warm ivory, charcoal and cinema-red theme on desktop and mobile, including keyboard focus and full-size seat targets.

The primary action color is reserved for actions and selection. Availability remains green, holds amber and booked seats slate. Seats also use check, minus and cross icons. Text and controls follow [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), and meaningful states have [cues beyond color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html). No conversion uplift is claimed without user testing.

## Validation

- 11 real PostgreSQL/API tests passed, including racing reservations, expired holds, ownership, cancellation, overlapping shows and concurrent duration edits.
- All nine browser flows passed in one run, including the live seat race and admin booking ID/time checks.
- Typecheck and production build passed. Docker serves the built application.
- GitHub Actions runs the checks from a clean checkout; its final status is visible in the repository's Actions tab.

## Email requirements

Rechecked the Yozigo email and linked brief on 13 October 2026. Required flows are 1–7; bonus flows are 8–10. The submission asks for a GitHub link, reproducible README with test accounts and key decisions, database design, and a 3–5 minute screen recording. A live hosted URL is optional. The recording must include two independent customers competing for one seat.

The email arrived on 13 October at 00:07 IST and gives five days. This suggests 18 October; no exact cutoff is specified.

## Before sending

After owner approval, give the hiring team access to the private repository (their GitHub usernames are not supplied in the email), or approve making the repository public. Ensure they can view/download the recording, then reply to the original email with the repository and recording links.

Payments and film content are sample data. There is no public deployment. The app covers one cinema and one screen; its remaining limits are listed in README.
