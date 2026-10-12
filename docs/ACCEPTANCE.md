# Assignment acceptance checklist

Source: https://docs.google.com/document/d/e/2PACX-1vTnYWEWfso4qdP46og3IPZeDBB54CVXe2BpM9nQ_MmyzO0cRahP4TRvIgFJFSQ7WgytnSTvUIlqZk0f/pub
Received 13 October 2026 00:07 IST; five-day deadline inferred 18 October 2026. No exact cutoff provided.

1. Signup name/email/password, unique email, password >=8 hashed, login/logout and generic bad credentials error, backend and frontend authentication gates.
2. Movie catalogue title/poster/language/duration/U-UA-A rating; movie details; upcoming shows grouped by date; start time, price, available seats; hide started shows.
3. Authenticated 8x10 A–H map with screen marker; available/other-held/booked visually distinct; unavailable disabled; backend state on refresh.
4. 1–6 selected seats; seventh shows error; labels and total; atomic Continue creates 5min hold and countdown; conflicts name seats and refresh; expiry releases everyone.
5. Pay opens fake payment success/failure controls; success receipt contains all booking details; failure no booking, retains hold, Try again; expired rejected; concurrent requests prove exactly one seat owner.
6. Own booking history upcoming then past; all details and status; backend protects other-user IDs.
7. Seed-only admin; movie add/edit/delete; future shows with time/price; DB rejects overlap; booked shows cannot delete; customer cannot access admin UI/APIs.
8. Own cancellation >=2h before start; otherwise error; seats immediately free; status cancelled.
9. Admin per-show booked/80, occupancy%, revenue, customer bookings, same seat map.
10. Live seat changes within seconds using 3-second polling; rationale in README.

Submission: incremental public GitHub repository (or private shared), reproducible README and demo accounts, completed flow list and limitations, key decisions in 5–10 lines, database design, 3–5 minute recording including two windows competing for one seat, optional live URL. Candidate must understand and explain every line. No email or form submission without direct user request.
