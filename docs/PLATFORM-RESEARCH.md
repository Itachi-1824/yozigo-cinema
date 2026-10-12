# Booking platform screen study

Reviewed 13 October 2026. This combines direct browser observations of BookMyShow, District and Fandango with the official support evidence in [Booking behavior research](BOOKING-BEHAVIOR-RESEARCH.md). Cinemark's browser page was blocked by its security service; only its public documentation was reviewed. No accounts, purchases or external bookings were created.

## What the actual screens contain

| Screen | BookMyShow | District | Fandango | FRAME decision |
| --- | --- | --- | --- | --- |
| Global navigation | Two compact rows: brand, persistent search, region, sign-in; categories below. | Brand, selected city, product categories, search and account. | Persistent movie/location search, Movies, Theaters and account; offers separate. | One compact header. Movie search, Now showing, My bookings and account. One cinema needs no invented city selector. |
| Catalogue | Language/genre/format filters, regional heading, portrait posters, title, certification and languages. Promotional material sits above the catalogue. | Featured film has an actual title, synopsis and booking button; release grouping and language/format filters precede poster listings. | Movie discovery and theater-first browsing; calendar and location are central in showtime browsing. | Film listings lead immediately. Search and language/genre filters are working controls. Portrait posters, title, runtime, language, certification, next show and price provide comparison. |
| Film details | Poster alongside backdrop; title; audience score with vote count; runtime, genres, certification, release date, formats, languages; Book tickets. About, cast, crew, reviews and related films follow. | Backdrop, poster, title, certification/language/runtime, synopsis, genres and release date. Cast/crew, actual trailers and image gallery follow. | Poster/backdrop, title, age rating/runtime, separate critic/audience measures, Trailer and List. Synopsis, genre, release date, cast/crew and photos below. | Provide complete sample film facts and a readable synopsis. Optional credits and release date come from fixture/API data. A numerical audience score is different from age certification; do not fake audience votes. Do not show a trailer button without a playable source. |
| Showtimes | A compact film identity block, sticky date strip, filters and availability legend. Cinema rows contain time/format buttons and explicit cancellation policy. | Small poster and film facts; adult-content advisory where applicable; dates, time/amenity filters and cinema rows with availability, distance and cancellation. Seat category/price appears before the seat map. | Calendar, format filters, theater address/distance, amenity descriptions, time buttons and Check Seats. | Keep title/date/time/certification visible. Show price and live availability on every screening. Dates only include scheduled shows. Use the one real screen; do not invent venue choices or formats. State the assignment's two-hour cancellation cutoff before payment. |
| Seats | Showtime buttons were inspected, but this browser session did not reach a usable BookMyShow seat map. | A separate booking header retains film, venue/date/time. Seat classes include prices. Rows, aisles, labels and screen orientation match a spatial map. Persistent bottom legend distinguishes recommended, available, occupied and selected seats. Mobile pans instead of shrinking all seats. | Official docs reviewed; no paid ticket transaction attempted. | An 80-seat spatial map, readable labels, real aisle, minimum 44px targets, named states and screen orientation. A persistent summary contains selected labels, count and exact total; the actual five-minute hold countdown appears after Continue. |
| Accounts | Header sign-in entry observed; no external sign-in completed. | A short mobile-number dialog explains account creation, with country code, number input, Continue and terms links. | A dedicated signup form requests name/email/password, exposes password guidance and sign-in switch. Benefits sit separately from the form. | Keep the brief's email/password system. Center a clear labeled form, expose password visibility, validation, pending state and errors. Preserve the requested booking destination after signing in. Do not display unsupported OTP or social login. |
| Review/payment | Official support documents confirmation and charge-without-ticket recovery; the protected live payment screen was not inspected. | Terms document booking details, fees and confirmation channels. | Ticket policy documents convenience fees and confirmation/retrieval. | Review actual film/show/seats/amount before simulated payment. Keep clear success/failure controls required by the brief. Failure retains the live hold and offers retry; expired holds reject payment. No invented fees, discounts or payment-provider logos. |
| Confirmation/history | Successful bookings appear in Your Orders. Participating-cinema cancellation has its own eligibility/cutoff. | Confirmation uses the booking/order ID; cancellation depends on the cinema's policy. | Purchase History and confirmation provide retrieval and refund/exchange access. | Own bookings only, upcoming before past, real booking ID, explicit confirmed/cancelled status, exact amount and seat labels. Show cancellation eligibility and release seats through the API. |

## Visual findings

- Information is organized around the film and the customer's next decision. Marketing typography does not occupy the whole first screen before the catalogue.
- Portrait posters provide identity; backdrop images support film detail context. The interfaces use ordinary readable sans typography for facts, forms, prices and dates.
- Repeated film and screening controls have predictable sizes and placement. People can compare several films or times without learning a different layout for each.
- Booking screens become quieter: compact identity header, seat map, summary and action. Discovery navigation does not compete with seat selection.
- Color describes availability or selection. Text, labels and disabled states remain necessary; a green rectangle alone cannot explain whether a show is available or seats are selected.
- Mobile retains usable seat geometry and persistent context. Compressing 80 seats into tiny targets would lose the main interaction.

## Content gaps in the rejected demo

The original four films had one-line descriptions and no release dates or credits. The oversized slogan, editorial indexes, serif display text and panoramic hero made the catalogue secondary. Login promoted another fictional film instead of concentrating on the account task. These are structural gaps, not a reason to add more decorative motion.

The user chose **fake stub data for the demo**. The four film identities remain fictional, with fuller sample synopses, release dates, age certifications and cast/crew. Sample names are not endorsements or representations of real film credits. Artwork remains sample artwork. Screening schedules, availability, holds, confirmation and history come from the working PostgreSQL API rather than hardcoded success screens.

## Rules retained from the assignment

One screen with 80 seats; at most six seats per booking; atomic five-minute holds; simulated payment; cancellation at least two hours before the show; authenticated customer history; protected admin tools. Competing platforms' policies differ, so their cutoffs, fees, authentication methods and seat categories are not copied into the assessment.

## Evidence and limits

Saved browser captures are in the local ignored `artifacts/research/` directory: BookMyShow catalogue/details/showtimes; District catalogue/details/showtimes/seats/login and mobile seats. Screenshots document observations, not reusable brand assets.

Public browsing could show different schedules or data after the review date. For example, Other Mommy showed 1h 33m on Fandango and 2h on District. This disagreement is a reason to use a consistent authoritative dataset for real film imports, not silently combine fields from unrelated providers. FRAME uses explicit fixtures instead.

Live payment, refund execution and authenticated third-party order history were not tested. The documented behavior matrix states where evidence is limited. No provider's server locking algorithm or hold duration is inferred from its visible UI.

## Viewed primary pages

- [BookMyShow Bengaluru catalogue](https://in.bookmyshow.com/explore/movies-bengaluru?cat=MT)
- [BookMyShow Premada Oorali details](https://in.bookmyshow.com/movies/bengaluru/premada-oorali/ET00412717)
- [BookMyShow Premada Oorali showtimes](https://in.bookmyshow.com/movies/bengaluru/premada-oorali/buytickets/ET00412717/20261013?etCodes=ET00412717&language=kannada&refEventCode=ET00412717)
- [District movie catalogue](https://www.district.in/movies/)
- [District Other Mommy details](https://www.district.in/movies/other-mommy-movie-tickets-MV207240)
- [District Doraemon details](https://www.district.in/movies/doraemon-the-movie-new-nobita-and-the-castle-of-the-undersea-devil-movie-tickets-MV223185)
- [District Doraemon showtimes](https://www.district.in/movies/doraemon-the-movie-new-nobita-and-the-castle-of-the-undersea-devil-movie-tickets-in-gurgaon-MV223185)
- [Fandango movie times](https://www.fandango.com/movietimes)
- [Fandango Other Mommy details](https://www.fandango.com/other-mommy-2026-246464/movie-overview)
- [Fandango account creation](https://www.fandango.com/accounts/join-now)
- [Cinemark official ticket FAQ](https://www.cinemark.com/faq-tickets-purchases-refunds)
