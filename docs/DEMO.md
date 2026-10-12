# Recording guide

Target duration: 3–5 minutes. Show actual browser interaction, including a failed payment and two separate sessions competing for one seat. Use a private/incognito window for the second customer; two ordinary tabs share the same login.

| Time | Show |
|---|---|
| 0:00–0:30 | Home, film selector, genre/search, film details, date and showtime |
| 0:30–1:00 | Customer login or sign-up; seat map states, screen direction, selection and price; seventh-seat limit |
| 1:00–1:45 | Continue creates a timed hold; refresh preserves it; Payment failure retains seats; Try again then Payment success produces a ticket |
| 1:45–2:15 | My bookings, own ticket, cancel an eligible booking and show the freed seats |
| 2:15–3:15 | Two visible browser windows with different customer accounts choose the same free seat; Continue simultaneously; exactly one gets the hold and the other sees a conflict. The second map updates automatically. Complete the winner's payment and show the booked state |
| 3:15–4:15 | Admin films/showtimes, add or edit film, create show, overlap error, occupancy and per-show booking inspector |
| 4:15–4:30 | Briefly show the database diagram and explain show-first transactions, active-seat uniqueness, database time and polling |

Passwords are local demo credentials in README. Payment controls are simulated, with no real charge. Keep captions short and avoid showing private mail, credentials for other services or unrelated browser tabs.

For the hiring call, be able to explain the request path, SQL lock order, the all-or-nothing hold transaction, why polling does not prevent double booking, cancellation history, and why the API rejects unauthorized calls independently of the frontend.
