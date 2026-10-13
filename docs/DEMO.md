# Recording guide

Target duration: 3–5 minutes. Show actual browser interaction, including a failed payment and two separate sessions competing for one seat. Use a private/incognito window for the second customer; two ordinary tabs share the same login.

With the local app running, `node scripts/record-demo.mjs` records the customer journey, two independent customers competing for one seat, and admin film management and overlap validation. It requires the installed Playwright Chromium browser and `ffmpeg`/`ffprobe` on PATH. Set `FRAME_DEMO_URL` to use another local base URL.

The recorder creates sample customer accounts, a future screening, and demo booking history in the running database. Temporary films are deleted after their CRUD demonstration. Raw recordings, captions, and the verified 2560×1440 (2K) `frame-demo.mp4` are saved under the ignored `artifacts/demo/` directory. Capture renders the full app at 2× zoom for readable native text; the race uses two 1280×1440 windows placed side by side without resizing. Rendering rejects lower-resolution inputs, encodes once at H.264 CRF 14, and checks the 3–5 minute duration and video format before reporting success.

| Time      | Show                                                                                                                                                                                                                                                                    |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:30 | Home, language/genre/search, film synopsis and credits, date and showtime                                                                                                                                                                                               |
| 0:30–1:00 | Customer login or sign-up; seat map states, screen direction, selection and price; seventh-seat limit                                                                                                                                                                   |
| 1:00–1:45 | Continue creates a timed hold; refresh preserves it; Payment failure retains seats; Try again then Payment success produces a ticket                                                                                                                                    |
| 1:45–2:15 | My bookings, own ticket, cancel an eligible booking and show the freed seats                                                                                                                                                                                            |
| 2:15–3:15 | Two visible browser windows with different customer accounts choose the same free seat; Continue simultaneously; exactly one gets the hold and the other sees a conflict. The second map updates automatically. Complete the winner's payment and show the booked state |
| 3:15–4:15 | Admin films/showtimes, add or edit film, create show, overlap error, occupancy and per-show booking inspector                                                                                                                                                           |
| 4:15–4:30 | Briefly show the database diagram and explain show-first transactions, active-seat uniqueness, database time and polling                                                                                                                                                |

Passwords are local demo credentials in README. Payment controls are simulated, with no real charge. Keep captions short and avoid showing private mail, credentials for other services or unrelated browser tabs.

For the hiring call, be able to explain the request path, SQL lock order, the all-or-nothing hold transaction, why polling does not prevent double booking, cancellation history, and why the API rejects unauthorized calls independently of the frontend.
