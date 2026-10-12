# Design and implementation references

Research was used to sharpen the product's own behaviour rather than reproduce another platform's identity.

- [BookMyShow booking support](https://support.bookmyshow.com/support/solutions/folders/4000033182): held seats after an incomplete transaction, show language, connectivity errors and booking cutoff questions. FRAME makes hold expiry and payment failure explicit and shows current availability from the API.
- [Fandango](https://www.fandango.com/): film discovery with prominent ticket actions and clear links into showtimes. FRAME puts a real film in the feature area and makes Book tickets the main action.
- [Cinemark](https://www.cinemark.com/): dedicated movie and showtime browsing. The assessment's single-screen scope removes location-selection friction.
- [MUBI](https://mubi.com/en/us): a film-first editorial presentation. FRAME's visual direction uses generous composition and photographic imagery while keeping booking controls readable.
- [Astro React integration](https://docs.astro.build/en/guides/integrations-guide/react/): rendering and hydration for React inside Astro.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html): transactions serialize reservation changes through a consistent show-first row lock.
- [PostgreSQL range constraints](https://www.postgresql.org/docs/current/rangetypes.html): exclusion constraints prevent overlapping screenings at the database boundary.
- [Fastify validation](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/): request validation and safe API response boundaries.

Films, storylines and posters in the seed catalogue are fictional. No reviews, audience ratings or third-party endorsements are invented.
