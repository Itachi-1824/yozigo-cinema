# FRAME

## Platform
web

## Stack
Astro with React and TypeScript frontend, separate Fastify API, PostgreSQL. Astro requested by the user.

## Users and purpose
Cinema customers compare film information, choose a dated screening, select seats and confirm a simulated payment. Cinema staff manage films, shows and booking occupancy. The cinema has one screen and eighty seats. The user chose fake stub film data for this demo; film credits and release details are sample content.

## Constraints
Preserve all ten assignment flows in docs/ACCEPTANCE.md. Never double-book a seat; database transactions and constraints are authoritative. Five-minute holds, at most six seats per booking, cancellation at least two hours before start. All amounts INR; times displayed in Asia/Kolkata. Fictional film catalogue and demo payment must remain clear. No invented ratings, endorsements, customers or live deployment claims.

## Brand commitments
The user rejected the oversized editorial redesign and asked for direct study of real booking products. Prioritize compact film discovery, complete available movie facts, visible showtimes, a spatial seat map and a persistent booking summary. BookMyShow, District and Fandango supply observed usability references. Use restrained motion, opt-in sound, readable sans typography and responsive layouts.

## Operating context
Local review at http://127.0.0.1:4321. Desktop is required by the brief; mobile and keyboard access are part of the quality target. Demo seed records and backend tests are present.
