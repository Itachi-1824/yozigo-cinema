# FRAME product UI

FRAME is a compact sample cinema booking product. The interface uses Manrope, a warm ivory canvas (`#FFFAF2`), white surfaces, restrained warm borders, and cinema red (`#B9233B`) for primary actions and selection. Green, amber, and slate remain reserved for seat availability, holds, and booked states. Movie art belongs on posters and the film-detail backdrop only.

Desktop content is capped at 1200px with 24px gutters; the header is 68px. The home screen opens directly to Now showing, filters, search, and a four-column poster grid. At tablet and mobile widths it uses two poster columns with 16px gutters.

Film details put a 220×330 poster beside actual film facts and synopsis, then show dates and screenings within the first viewport. Show cards show exact INR pricing and availability out of 80 seats. Optional release date, detailed certification, verified trailer and source link, and credits are shown only when supplied. Missing credit images use initials.

Seat selection retains an 8×10 map with 44px targets, an aisle, live held/booked states, polling and hold timer. On desktop the 320px order summary stays visible; on mobile it becomes a fixed booking bar and the map scrolls horizontally. Checkout is explicitly a demo payment with success and failure controls. Tickets expose their true ID, status and cancellation eligibility without fake QR codes.

Authentication is a centered 420px form. All requests preserve their loading, retry, CSRF, session, ownership, hold, payment and cancellation behavior. Motion is brief and optional; sound remains opt-in; reduced-motion disables transitions.
