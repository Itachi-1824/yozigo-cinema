# API contract

All routes start `/api`. JSON uses snake_case. Integer money is INR paise. Dates are ISO-8601 UTC; UI presents Asia/Kolkata. API port 4000, Astro 4321; Astro proxies /api. Same-origin cookie session; never localStorage tokens. Successful auth or GET /auth/me returns `{user, csrf_token}`. Frontend sends `x-csrf-token` on authenticated mutations. Errors `{error, code?, seats?}` with safe text. No wrapping except explicitly listed below.

Types:
- User: `{id:number,name:string,email:string,role:'customer'|'admin'}`
- Movie: `{id:number,title:string,description:string,language:string,duration_minutes:number,rating:'U'|'UA'|'A',poster_url:string,backdrop_url:string,genre:string,release_date:string,certification:string,credits:{name:string,role:string,image_url:string}[],gallery:string[],trailer_url:string,source_url:string}`. Optional metadata defaults to empty strings/arrays. Release date is a valid calendar date in YYYY-MM-DD; credits and gallery are bounded. `rating` is age classification; `certification` may provide the more detailed label. Trailers accept verified HTTPS YouTube watch links; empty metadata is not rendered. Admin updates preserve omitted optional metadata.
- Show: `{id:number,movie_id:number,starts_at:string,ends_at:string,price_paise:number,available_seats:number}`
- Seat: `{label:string,state:'available'|'held'|'booked',mine:boolean}`
- Hold: `{id:string,show_id:number,seats:string[],expires_at:string,amount_paise:number}`
- Booking: `{id:string,movie_title:string,starts_at:string,seats:string[],amount_paise:number,status:'confirmed'|'cancelled',created_at:string,poster_url:string}`

Auth:
- POST /auth/signup `{name,email,password}` -> 201 `{user,csrf_token}`; normal signup always customer.
- POST /auth/login `{email,password}` -> `{user,csrf_token}`; generic credentials error.
- GET /auth/me -> session or 401; POST /auth/logout -> `{ok:true}`.

Browse and booking:
- GET /movies -> Movie[]; GET /movies/:id -> `{movie,shows:Show[]}` upcoming only.
- GET /shows/:id -> `{show:Show,movie:Movie,seats:Seat[],hold:Hold|null,server_now:string}`. Auth required for booking screen; current user's active hold included for refresh recovery.
- POST /shows/:id/holds `{seats:string[]}` -> 201 Hold. 1–6 unique valid A1–H10 labels; atomic all-or-nothing 5-minute hold; conflict 409 includes exact unavailable `seats`. Existing same-user active hold returned only if identical seats; different hold for this user/show is replaced transactionally, old hold invalidated.
- POST /holds/:id/pay `{outcome:'success'|'failure'}` -> `{booking:Booking}` on success; failure HTTP 402 `{error:'Payment failed',code:'PAYMENT_FAILED'}` retains hold. Expired hold 409. Only hold owner. Repeated successful payment idempotently returns same booking. All reservations serialized in PostgreSQL with row locks plus database uniqueness.
- GET /bookings -> Booking[] upcoming first then past; GET /bookings/:id -> own Booking or 404.
- POST /bookings/:id/cancel -> Booking; own, confirmed, >=2h before show; cancelled seats release immediately.

Admin (all enforce role):
- GET /admin/movies -> Movie[] (or reuse public GET).
- POST /admin/movies -> Movie; PATCH /admin/movies/:id -> Movie; DELETE /admin/movies/:id -> `{ok:true}`. Same Movie fields without id, all validated. Don't permit duration edits to cause overlaps or destroy booked history; block movie deletion if any bookings, delete its empty shows safely.
- GET /admin/shows -> `(Show & {movie_title:string,booked_seats:number,occupancy_percent:number,revenue_paise:number})[]`.
- POST /admin/shows `{movie_id,starts_at,price_paise}` -> Show. Duration determines ends_at; enforce no overlap for single screen at database boundary. Start must be future.
- DELETE /admin/shows/:id -> `{ok:true}`; reject if has any booking (even cancelled).
- GET /admin/shows/:id/bookings -> `(Booking & {customer_name:string})[]`.

Live updates: frontend polls GET /shows/:id every 3s; preserve selection, remove externally unavailable seats with message. Timer uses server timestamp offset. Failed polling visibly reported; booking APIs remain authority.

Demo seed: customer@frame.test / FrameGuest2026!; rival@frame.test / FrameRival2026!; admin@frame.test / FrameAdmin2026! (demo-only public accounts). Seed uses env overrides, hashes passwords, inserts four fictional films with local poster assets /posters/orbit.svg, /posters/monsoon.svg, /posters/neon.svg, /posters/last-light.svg and backdrops /backdrops/orbit.svg etc. Movie titles: Beyond the Blue, Monsoon Letters, Neon City, The Last Light. 80 seats A–H x1–10 per show. Multiple nonoverlapping shows across next 7 days, INR 250–450. Seed only when empty, no destructive reset.
