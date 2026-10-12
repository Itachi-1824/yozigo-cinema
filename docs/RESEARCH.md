# Design and implementation references

Direct screen observations and provider support documentation informed the booking interface. See [Platform screen study](PLATFORM-RESEARCH.md) and [Booking behavior evidence](BOOKING-BEHAVIOR-RESEARCH.md) for the source matrix and limits.

- [BookMyShow booking support](https://support.bookmyshow.com/support/solutions/folders/4000033182): held seats after an incomplete transaction, show language, connectivity errors and booking cutoff questions. FRAME makes hold expiry and payment failure explicit and shows current availability from the API.
- [Fandango](https://www.fandango.com/): persistent search, film information and calendar-led showtimes. FRAME keeps discovery and screening selection close together.
- [Cinemark](https://www.cinemark.com/): dedicated movie and showtime browsing. The assessment's single-screen scope removes location-selection friction.
- [District](https://www.district.in/movies/): compact film facts, cast/crew, dated screenings, cancellation disclosure, spatial seats and mobile seat-map panning. FRAME uses these booking patterns within its single-screen scope.
- [Astro React integration](https://docs.astro.build/en/guides/integrations-guide/react/): rendering and hydration for React inside Astro.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html): transactions serialize reservation changes through a consistent show-first row lock.
- [PostgreSQL range constraints](https://www.postgresql.org/docs/current/rangetypes.html): exclusion constraints prevent overlapping screenings at the database boundary.
- [Fastify validation](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/): request validation and safe API response boundaries.

The user chose fictional stub film data for the demo. Film stories, release dates, credits and artwork are sample content; no audience votes, reviews, endorsements or real screenings are claimed. Booking availability and transactions remain backed by PostgreSQL.
