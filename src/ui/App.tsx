import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SubmitEvent,
} from "react";
import { Home, MoviePage } from "./Editorial";
import { AuthPage } from "./AuthPage";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Film,
  LogOut,
  Menu,
  Minus,
  Plus,
  Ticket,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

type User = {
  id: number;
  name: string;
  email: string;
  role: "customer" | "admin";
};
type Movie = {
  id: number;
  title: string;
  description: string;
  language: string;
  duration_minutes: number;
  rating: "U" | "UA" | "A";
  poster_url: string;
  backdrop_url: string;
  genre: string;
  release_date?: string;
  certification?: string;
  credits?: { name: string; role: string; image_url: string }[];
  trailer_url?: string;
  source_url?: string;
};
type Show = {
  id: number;
  movie_id: number;
  starts_at: string;
  ends_at: string;
  price_paise: number;
  available_seats: number;
};
type Seat = {
  label: string;
  state: "available" | "held" | "booked";
  mine: boolean;
};
type Hold = {
  id: string;
  show_id: number;
  seats: string[];
  expires_at: string;
  amount_paise: number;
};
type Booking = {
  id: string;
  movie_title: string;
  starts_at: string;
  seats: string[];
  amount_paise: number;
  status: "confirmed" | "cancelled";
  created_at: string;
  poster_url: string;
};
type ShowDetail = {
  show: Show;
  movie: Movie;
  seats: Seat[];
  hold: Hold | null;
  server_now: string;
};
type AdminShow = Show & {
  movie_title: string;
  booked_seats: number;
  occupancy_percent: number;
  revenue_paise: number;
};
type AdminBooking = Booking & { customer_name: string };
type Route = {
  page:
    | "home"
    | "movie"
    | "seats"
    | "bookings"
    | "ticket"
    | "admin"
    | "login"
    | "signup";
  id?: string;
};
type ApiError = Error & { code?: string; seats?: string[]; status?: number };

const money = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const clock = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
const day = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
const shortDay = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
const duration = (minutes: number) =>
  `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
const displayError = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
const posterSrc = (url: string) => {
  const name = ["orbit", "monsoon", "neon", "last-light"].find((slug) =>
    url.endsWith(`/${slug}.svg`),
  );
  return name ? `/posters/${name}-v2.webp` : url;
};
const posterFallback = (
  event: React.SyntheticEvent<HTMLImageElement>,
  url: string,
) => {
  if (event.currentTarget.src !== new URL(url, location.href).href)
    event.currentTarget.src = url;
};

async function api<T>(
  path: string,
  method = "GET",
  body?: object,
  csrf?: string,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    signal: AbortSignal.timeout(12000),
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(csrf ? { "x-csrf-token": csrf } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(
      data.error || `Request failed (${response.status})`,
    ) as ApiError;
    error.code = data.code;
    error.seats = data.seats;
    error.status = response.status;
    if (
      response.status === 401 &&
      path !== "/auth/me" &&
      typeof location !== "undefined"
    ) {
      go(authPath("login", location.hash.slice(1)));
    }
    throw error;
  }
  return response.json();
}

function routeFromHash(): Route {
  if (typeof location === "undefined") return { page: "home" };
  const [page, id] = location.hash.slice(1).split("/");
  if (page === "login" || page === "signup") {
    let next = "";
    try {
      next = decodeURIComponent(id || "");
    } catch {
      /* Invalid paths return to the catalogue. */
    }
    return { page, id: safeReturnPath(next) };
  }
  if (page === "movie" && /^\d+$/.test(id || "")) return { page, id };
  if (page === "seats" && /^\d+$/.test(id || "")) return { page, id };
  if (page === "ticket" && id) return { page, id };
  if (page === "bookings" || page === "admin") return { page };
  return { page: "home" };
}

function safeReturnPath(path: string) {
  return /^(?:seats\/\d+|bookings|admin|ticket\/[a-zA-Z0-9-]+)$/.test(path)
    ? path
    : "";
}
function authPath(mode: "login" | "signup", next = "") {
  const destination = safeReturnPath(next);
  return destination ? `${mode}/${encodeURIComponent(destination)}` : mode;
}

function go(path = "") {
  location.hash = path;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function Button({
  children,
  busy,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button {...props} disabled={props.disabled || busy}>
      {busy ? "One moment…" : children}
    </button>
  );
}

function ErrorLine({ children }: { children?: ReactNode }) {
  return children ? (
    <p className="error-line" role="alert">
      {children}
    </p>
  ) : null;
}

function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusable = () => [
      ...(ref.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
      ) || []),
    ];
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
      if (event.key !== "Tab") return;
      const nodes = focusable();
      if (!nodes.length) return;
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open]);
  return ref;
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => routeFromHash());
  const [user, setUser] = useState<User | null>(null);
  const [csrf, setCsrf] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [boot, setBoot] = useState<"loading" | "error" | "ready">("loading");
  const [bootError, setBootError] = useState("");
  const [initialMovies, setInitialMovies] = useState<Movie[]>([]);
  const [toast, setToast] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [globalQuery, setGlobalQuery] = useState("");

  useEffect(() => {
    const onHash = () => {
      setRoute(routeFromHash());
      setMenuOpen(false);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const loadApp = useCallback(async () => {
    setBoot("loading");
    setBootError("");
    try {
      const [movies, session] = await Promise.all([
        api<Movie[]>("/movies"),
        api<{ user: User; csrf_token: string }>("/auth/me").catch(
          (error: ApiError) => {
            if (error.status === 401) return null;
            throw error;
          },
        ),
      ]);
      setInitialMovies(movies);
      setUser(session?.user || null);
      setCsrf(session?.csrf_token || "");
      setAuthReady(true);
      setBoot("ready");
    } catch (error) {
      setBootError(displayError(error));
      setBoot("error");
    }
  }, []);
  useEffect(() => {
    void loadApp();
  }, [loadApp]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setSoundOn(localStorage.getItem("frame-sound") === "on");
  }, []);

  function toggleSound() {
    setSoundOn((current) => {
      localStorage.setItem("frame-sound", current ? "off" : "on");
      return !current;
    });
  }
  function submitGlobalSearch(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    go("");
  }
  function playSound(kind: "seat" | "confirm") {
    if (!soundOn) return;
    const Context = window.AudioContext;
    if (!Context) {
      setToast("Sound is unavailable in this browser.");
      return;
    }
    const audio = new Context();
    const frequencies = kind === "seat" ? [680] : [523, 659, 784];
    frequencies.forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const volume = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(0.0001, audio.currentTime + index * 0.11);
      volume.gain.exponentialRampToValueAtTime(
        kind === "seat" ? 0.035 : 0.026,
        audio.currentTime + index * 0.11 + 0.012,
      );
      volume.gain.exponentialRampToValueAtTime(
        0.0001,
        audio.currentTime + index * 0.11 + (kind === "seat" ? 0.08 : 0.31),
      );
      oscillator.connect(volume).connect(audio.destination);
      oscillator.start(audio.currentTime + index * 0.11);
      oscillator.stop(
        audio.currentTime + index * 0.11 + (kind === "seat" ? 0.09 : 0.32),
      );
    });
    window.setTimeout(() => void audio.close(), 900);
  }

  function requireAuth(destination: string) {
    go(user ? destination : authPath("login", destination));
  }
  async function logout() {
    try {
      await api("/auth/logout", "POST", undefined, csrf);
      setUser(null);
      setCsrf("");
      go("");
      setToast("You have signed out.");
    } catch (error) {
      setToast(displayError(error));
    }
  }

  if (boot !== "ready")
    return (
      <BootScreen
        error={boot === "error" ? bootError : ""}
        retry={() => void loadApp()}
      />
    );

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="header-inner">
          <a href="#" className="brand" aria-label="FRAME home">
            <span className="brand-mark">
              <span />
            </span>
            FRAME<span className="brand-dot">.</span>
          </a>
          <nav
            className={menuOpen ? "nav open" : "nav"}
            aria-label="Main navigation"
          >
            <a href="#" className={route.page === "home" ? "active" : ""}>
              Now showing
            </a>
            {user && (
              <a
                href="#bookings"
                className={route.page === "bookings" ? "active" : ""}
              >
                My bookings
              </a>
            )}
            {user?.role === "admin" && (
              <a
                href="#admin"
                className={route.page === "admin" ? "active" : ""}
              >
                Studio admin
              </a>
            )}
          </nav>
          <form
            className="global-search"
            role="search"
            onSubmit={submitGlobalSearch}
          >
            <span className="sr-only">Search all films</span>
            <input
              value={globalQuery}
              onChange={(event) => setGlobalQuery(event.target.value)}
              placeholder="Search films"
              aria-label="Search films"
            />
          </form>
          <div className="header-actions">
            <button
              className="icon-button sound-toggle"
              aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
              aria-pressed={soundOn}
              title={soundOn ? "Sound on" : "Sound off"}
              onClick={toggleSound}
            >
              {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            {user ? (
              <>
                <span className="user-name">{user.name.split(" ")[0]}</span>
                <button
                  className="icon-button"
                  title="Sign out"
                  aria-label="Sign out"
                  onClick={logout}
                >
                  <LogOut size={17} />
                </button>
              </>
            ) : (
              authReady && (
                <button className="header-signin" onClick={() => go("login")}>
                  Sign in <ArrowRight size={15} />
                </button>
              )
            )}
            <button
              className="menu-button icon-button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={23} /> : <Menu size={23} />}
            </button>
          </div>
        </div>
      </header>
      <main>
        {route.page === "home" && (
          <Home
            initialMovies={initialMovies}
            onMovie={(id) => go(`movie/${id}`)}
            query={globalQuery}
            onQueryChange={setGlobalQuery}
          />
        )}
        {route.page === "movie" && (
          <MoviePage
            id={Number(route.id)}
            onBook={(id) => requireAuth(`seats/${id}`)}
          />
        )}
        {(route.page === "login" || route.page === "signup") && (
          <AuthPage
            mode={route.page}
            next={route.id || ""}
            onSwitch={(mode, next) => go(authPath(mode, next))}
            onComplete={(account, token, next) => {
              setUser(account);
              setCsrf(token);
              setToast(`Welcome, ${account.name.split(" ")[0]}.`);
              go(next || "");
            }}
          />
        )}
        {route.page === "seats" &&
          (user ? (
            <SeatsPage
              key={route.id}
              id={Number(route.id)}
              csrf={csrf}
              onBooked={(id) => {
                playSound("confirm");
                go(`ticket/${id}`);
              }}
              onSelect={() => playSound("seat")}
            />
          ) : (
            <Gate
              title="Your seat is waiting"
              onOpen={() => go(authPath("login", `seats/${route.id}`))}
            />
          ))}
        {route.page === "bookings" &&
          (user ? (
            <BookingsPage csrf={csrf} onTicket={(id) => go(`ticket/${id}`)} />
          ) : (
            <Gate
              title="Your story, all in one place"
              onOpen={() => go(authPath("login", "bookings"))}
            />
          ))}
        {route.page === "ticket" &&
          (user ? (
            <TicketPage id={route.id!} csrf={csrf} />
          ) : (
            <Gate
              title="Sign in to see your ticket"
              onOpen={() => go(authPath("login", `ticket/${route.id}`))}
            />
          ))}
        {route.page === "admin" &&
          (user?.role === "admin" ? (
            <AdminPage csrf={csrf} />
          ) : (
            <Gate
              title="Studio access only"
              onOpen={() => go(authPath("login", "admin"))}
            />
          ))}
      </main>
      <footer className="site-footer">
        <div className="footer-inner">
          <div>
            <span className="footer-brand">
              FRAME<span>.</span>
            </span>
            <p>For the love of the big screen.</p>
          </div>
          <span>Made for movie nights worth remembering.</span>
          <span>© {new Date().getFullYear()} FRAME CINEMA</span>
          <span>Sample films · Demo payments</span>
        </div>
      </footer>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button onClick={() => setToast("")} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="loading" role="status">
      Finding your next moment…
    </div>
  );
}
function BootScreen({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div
      className="boot-screen"
      role={error ? "alert" : "status"}
      aria-live="polite"
      aria-busy={!error}
    >
      <div className="boot-top">
        <span className="brand-mark">
          <span />
        </span>
        FRAME<span className="brand-dot">.</span>
      </div>
      <div className="boot-centre">
        <div className="boot-aperture" aria-hidden="true">
          <span />
        </div>
        <p className="boot-kicker">THE CINEMA IS ALMOST YOURS</p>
        <h1>{error ? "A brief intermission." : "Setting the scene."}</h1>
        <p>
          {error
            ? "We could not load the cinema right now. Check your connection and try again."
            : "Finding your next great night at the movies."}
        </p>
        {error && (
          <>
            <p className="error-line">{error}</p>
            <button className="signal-button" onClick={retry}>
              Try again <ArrowRight size={18} />
            </button>
          </>
        )}
      </div>
      <div className="boot-bottom">
        <span>FRAME CINEMA</span>
        <span>FOR THE LOVE OF THE BIG SCREEN</span>
      </div>
    </div>
  );
}
function Gate({ title, onOpen }: { title: string; onOpen: () => void }) {
  return (
    <section className="gate wrap">
      <h1>
        {title}
        <span className="coral">.</span>
      </h1>
      <p>Sign in to continue.</p>
      <button className="button button-primary" onClick={onOpen}>
        Sign in <ArrowRight size={18} />
      </button>
    </section>
  );
}

function SeatsPage({
  id,
  csrf,
  onBooked,
  onSelect,
}: {
  id: number;
  csrf: string;
  onBooked: (id: string) => void;
  onSelect: () => void;
}) {
  const [data, setData] = useState<ShowDetail | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [hold, setHold] = useState<Hold | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [networkError, setNetworkError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const offset = useRef(0);
  const selectedRef = useRef<string[]>([]);
  const holdRef = useRef<Hold | null>(null);
  const initialized = useRef(false);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  useEffect(() => {
    holdRef.current = hold;
  }, [hold]);
  const refresh = useCallback(async () => {
    try {
      const result = await api<ShowDetail>(`/shows/${id}`);
      offset.current = new Date(result.server_now).getTime() - Date.now();
      setNow(Date.now() + offset.current);
      const incomingHold =
        result.hold &&
        new Date(result.hold.expires_at).getTime() > Date.now() + offset.current
          ? result.hold
          : null;
      setData(result);
      setHold(incomingHold);
      setNetworkError(false);
      if (!initialized.current) {
        setError("");
        initialized.current = true;
      }
      if (incomingHold) {
        setSelected(incomingHold.seats);
      } else {
        if (holdRef.current) {
          setNotice("Your hold has expired. Choose your seats again.");
          setPaymentOpen(false);
        }
        const unavailable = selectedRef.current.filter((label) => {
          const seat = result.seats.find((item) => item.label === label);
          return !seat || seat.state !== "available";
        });
        if (unavailable.length) {
          setSelected((current) =>
            current.filter((label) => !unavailable.includes(label)),
          );
          setNotice(
            `${unavailable.join(", ")} ${unavailable.length === 1 ? "is" : "are"} no longer available. Your selection has been updated.`,
          );
        }
      }
    } catch (failure) {
      setNetworkError(true);
      if (!initialized.current) setError(displayError(failure));
    }
  }, [id]);
  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => void refresh(), 3000);
    const tick = window.setInterval(
      () => setNow(Date.now() + offset.current),
      1000,
    );
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [refresh]);
  const paymentDialog = useDialog(paymentOpen, () => setPaymentOpen(false));
  const remaining = hold
    ? Math.max(0, Math.ceil((new Date(hold.expires_at).getTime() - now) / 1000))
    : 0;
  useEffect(() => {
    if (hold && remaining === 0) {
      setHold(null);
      setPaymentOpen(false);
      setNotice("Your hold has expired. Choose your seats again.");
      void refresh();
    }
  }, [remaining, hold, refresh]);
  function toggleSeat(label: string) {
    setError("");
    setNotice("");
    if (hold) return;
    if (!selected.includes(label) && selected.length < 6) onSelect();
    setSelected((current) => {
      if (current.includes(label))
        return current.filter((item) => item !== label);
      if (current.length >= 6) {
        setError("You can book up to 6 seats at a time.");
        return current;
      }
      return [...current, label].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      );
    });
  }
  async function continueBooking() {
    if (!selected.length || !data || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<Hold>(
        `/shows/${id}/holds`,
        "POST",
        { seats: selected },
        csrf,
      );
      setHold(result);
      setPaymentFailed(false);
      setPaymentOpen(true);
      await refresh();
    } catch (failure) {
      const unavailable = (failure as ApiError).seats;
      setError(
        unavailable?.length
          ? `${unavailable.join(", ")} ${unavailable.length === 1 ? "is" : "are"} no longer available. Choose another seat.`
          : displayError(failure),
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  async function pay(outcome: "success" | "failure") {
    if (!hold || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ booking: Booking }>(
        `/holds/${hold.id}/pay`,
        "POST",
        { outcome },
        csrf,
      );
      onBooked(result.booking.id);
    } catch (failure) {
      setError(displayError(failure));
      setPaymentFailed((failure as ApiError).code === "PAYMENT_FAILED");
      if ((failure as ApiError).code !== "PAYMENT_FAILED") {
        setPaymentOpen(false);
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }
  if (error && !data)
    return (
      <div className="wrap page-pad">
        <ErrorLine>{error}</ErrorLine>
        <button
          className="button button-outline"
          onClick={() => void refresh()}
        >
          Try again
        </button>
      </div>
    );
  if (!data) return <Loading />;
  const { show, movie, seats } = data;
  const chosen = hold?.seats || selected;
  return (
    <>
      <div className="booking-head">
        <div className="wrap">
          <a className="back-link" href={`#movie/${movie.id}`}>
            <ArrowLeft size={16} /> Back to showtimes
          </a>
          <div className="booking-head-row">
            <div>
              <h1>
                {movie.title}
                <span className="coral">.</span>
              </h1>
              <p>
                {day(show.starts_at)} <span>·</span> {clock(show.starts_at)}{" "}
                <span>·</span> {movie.language}
              </p>
            </div>
            <span className="booking-step">
              01 <span>/ 03</span> SEATS
            </span>
          </div>
        </div>
      </div>
      <div className="wrap booking-layout">
        <div className="seat-panel">
          <div className="seat-panel-top">
            <div>
              <h2>Pick your seats</h2>
            </div>
            <span className="seat-count">{show.available_seats} available</span>
          </div>
          {networkError && (
            <p className="network-warning" role="alert">
              Connection interrupted. Seat availability may be out of date.{" "}
              <button onClick={() => void refresh()}>Retry now</button>
            </p>
          )}
          <ErrorLine>{notice}</ErrorLine>
          <div className="seat-legend">
            <span>
              <i className="legend-seat available" /> Available
            </span>
            <span>
              <i className="legend-seat selected" /> Your selection
            </span>
            <span>
              <i className="legend-seat held" /> On hold
            </span>
            <span>
              <i className="legend-seat booked" /> Booked
            </span>
          </div>
          <p className="seat-scroll-hint">
            Swipe sideways to see all seats, or focus the map and use the arrow
            keys.
          </p>
          <div
            className="seat-stage"
            tabIndex={0}
            aria-label="Seat map, scroll horizontally to see all seats"
            onKeyDown={(event) => {
              if (
                event.target === event.currentTarget &&
                (event.key === "ArrowRight" || event.key === "ArrowLeft")
              ) {
                event.preventDefault();
                event.currentTarget.scrollBy({
                  left: event.key === "ArrowRight" ? 180 : -180,
                  behavior: "smooth",
                });
              }
            }}
          >
            <div className="screen-glow" />
            <div className="screen-line" />
            <span className="screen-label">SCREEN THIS WAY</span>
            <div className="seat-map" role="group" aria-label="Cinema seats">
              <div className="seat-row">
                <span className="row-label" />
                {Array.from({ length: 10 }, (_, index) => (
                  <span
                    className={
                      index === 5 ? "column-label aisle-start" : "column-label"
                    }
                    key={index}
                  >
                    {index + 1}
                  </span>
                ))}
                <span className="row-label" />
              </div>
              {"ABCDEFGH".split("").map((row) => (
                <div className="seat-row" key={row}>
                  <span className="row-label">{row}</span>
                  {Array.from({ length: 10 }, (_, index) => {
                    const label = `${row}${index + 1}`;
                    const seat = seats.find((item) => item.label === label);
                    const isSelected = chosen.includes(label);
                    const status = isSelected
                      ? "selected"
                      : seat?.state || "booked";
                    return (
                      <button
                        key={label}
                        className={`seat ${status} ${index === 5 ? "aisle-start" : ""}`}
                        aria-label={`${label}, ${isSelected ? "selected" : status === "held" ? "on hold" : status}`}
                        aria-pressed={isSelected}
                        disabled={
                          !!hold || status === "booked" || status === "held"
                        }
                        onClick={() => toggleSeat(label)}
                      >
                        {status === "booked" ? (
                          <X size={15} aria-hidden />
                        ) : status === "held" ? (
                          <Minus size={15} aria-hidden />
                        ) : isSelected ? (
                          <Check size={15} aria-hidden />
                        ) : (
                          index + 1
                        )}
                      </button>
                    );
                  })}
                  <span className="row-label">{row}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="seat-hint">
            Select up to 6 seats. Your reservation is held for 5 minutes after
            continuing.
          </p>
        </div>
        <aside className="summary-panel">
          <h2>Booking summary</h2>
          <div className="summary-film">
            <img
              src={posterSrc(movie.poster_url)}
              onError={(event) => posterFallback(event, movie.poster_url)}
              alt=""
            />
            <div>
              <strong>{movie.title}</strong>
              <span>
                {movie.genre} · {movie.rating}
              </span>
            </div>
          </div>
          <div className="summary-line">
            <span>Date</span>
            <strong>{shortDay(show.starts_at)}</strong>
          </div>
          <div className="summary-line">
            <span>Time</span>
            <strong>{clock(show.starts_at)}</strong>
          </div>
          <div className="summary-line summary-seats">
            <span>Seats</span>
            <strong>
              {chosen.length ? chosen.join(", ") : "Choose seats"}
            </strong>
          </div>
          {hold && (
            <div className="hold-clock">
              <Clock3 size={17} /> Held for {Math.floor(remaining / 60)}:
              {String(remaining % 60).padStart(2, "0")}
            </div>
          )}
          <div className="summary-total">
            <span>Total</span>
            <strong>
              {money(hold?.amount_paise ?? chosen.length * show.price_paise)}
            </strong>
          </div>
          <ErrorLine>{error}</ErrorLine>
          {hold ? (
            <button
              className="button button-coral full"
              onClick={() => setPaymentOpen(true)}
            >
              Continue to payment <ArrowRight size={17} />
            </button>
          ) : (
            <Button
              className="button button-coral full"
              disabled={!selected.length || networkError}
              busy={busy}
              onClick={continueBooking}
            >
              Continue <ArrowRight size={17} />
            </Button>
          )}
          <p className="summary-note">Demo payment · No real charge.</p>
        </aside>
      </div>
      {paymentOpen && hold && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPaymentOpen(false);
          }}
        >
          <section
            ref={paymentDialog}
            className="payment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-title"
          >
            <button
              className="modal-close icon-button"
              onClick={() => setPaymentOpen(false)}
              aria-label="Close payment"
            >
              <X size={20} />
            </button>
            <h2 id="payment-title">Review booking</h2>
            <div className="payment-details">
              <strong>{movie.title}</strong>
              <p>
                {day(show.starts_at)} · {clock(show.starts_at)} IST
              </p>
              <p>{movie.language} · Screen 1</p>
            </div>
            <p>
              Your seats <strong>{hold.seats.join(", ")}</strong> are held until
              the timer runs out.
            </p>
            <div className="hold-clock" role="timer" aria-live="off">
              <Clock3 size={17} /> Hold expires in {Math.floor(remaining / 60)}:
              {String(remaining % 60).padStart(2, "0")}
            </div>
            <div className="payment-amount">
              <span>Amount due</span>
              <strong>{money(hold.amount_paise)}</strong>
            </div>
            <ErrorLine>{error}</ErrorLine>
            <Button
              className="button button-primary full"
              busy={busy}
              onClick={() => void pay("success")}
            >
              {paymentFailed ? "Try again" : "Complete demo payment"}{" "}
              <ArrowRight size={17} />
            </Button>
            <Button
              className="button button-outline full"
              busy={busy}
              onClick={() => void pay("failure")}
            >
              Simulate failed payment
            </Button>
            <p className="payment-note">
              This is a demo checkout. No real payment is taken.
              <br />
              Cancellation available until 2 hours before the show.
            </p>
          </section>
        </div>
      )}
    </>
  );
}

function BookingsPage({
  csrf,
  onTicket,
}: {
  csrf: string;
  onTicket: (id: string) => void;
}) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const load = useCallback(() => {
    setLoading(true);
    api<Booking[]>("/bookings")
      .then(setBookings)
      .catch((error) => setError(displayError(error)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  async function cancel(id: string) {
    if (!confirm("Cancel this booking? Your seats will be released.")) return;
    setBusy(id);
    setError("");
    try {
      await api(`/bookings/${id}/cancel`, "POST", undefined, csrf);
      load();
    } catch (failure) {
      setError(displayError(failure));
    } finally {
      setBusy("");
    }
  }
  const upcoming = bookings.filter(
    (booking) =>
      booking.status === "confirmed" &&
      new Date(booking.starts_at).getTime() > Date.now(),
  );
  const past = bookings.filter((booking) => !upcoming.includes(booking));
  return (
    <section className="wrap page-pad bookings-page">
      <a className="back-link dark" href="#">
        <ArrowLeft size={16} /> Back to films
      </a>
      <div className="section-top">
        <div>
          <h1>
            My bookings<span className="coral">.</span>
          </h1>
          <p>Every story you’ve made time for.</p>
        </div>
        <Ticket size={35} strokeWidth={1.3} />
      </div>
      <ErrorLine>{error}</ErrorLine>
      {loading ? (
        <Loading />
      ) : !bookings.length ? (
        <div className="empty-bookings">
          <Film size={42} />
          <h2>Your story starts here.</h2>
          <p>No bookings yet. There’s a seat waiting for you.</p>
          <a className="button button-primary" href="#">
            Explore films <ArrowRight size={16} />
          </a>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <BookingSection
              title="Coming up"
              bookings={upcoming}
              onTicket={onTicket}
              onCancel={cancel}
              busy={busy}
            />
          )}
          {past.length > 0 && (
            <BookingSection
              title="Past & cancelled"
              bookings={past}
              onTicket={onTicket}
              onCancel={cancel}
              busy={busy}
            />
          )}
        </>
      )}
    </section>
  );
}
function BookingSection({
  title,
  bookings,
  onTicket,
  onCancel,
  busy,
}: {
  title: string;
  bookings: Booking[];
  onTicket: (id: string) => void;
  onCancel: (id: string) => void;
  busy: string;
}) {
  return (
    <div className="booking-section">
      <h2>
        {title} <span>{bookings.length}</span>
      </h2>
      <div className="booking-list">
        {bookings.map((booking) => (
          <article className="booking-item" key={booking.id}>
            <img
              src={posterSrc(booking.poster_url)}
              onError={(event) => posterFallback(event, booking.poster_url)}
              alt=""
            />
            <div className="booking-item-main">
              <span className={`status-tag ${booking.status}`}>
                {booking.status}
              </span>
              <h3>{booking.movie_title}</h3>
              <p>
                {day(booking.starts_at)} · {clock(booking.starts_at)}
              </p>
              <span>
                Seats {booking.seats.join(", ")}{" "}
                <span className="meta-dot">·</span>{" "}
                {money(booking.amount_paise)}
              </span>
            </div>
            <div className="booking-item-actions">
              <button
                className="text-arrow"
                onClick={() => onTicket(booking.id)}
              >
                View ticket <ArrowRight size={16} />
              </button>
              {booking.status === "confirmed" &&
                new Date(booking.starts_at).getTime() - Date.now() >=
                  7200000 && (
                  <Button
                    busy={busy === booking.id}
                    className="cancel-link"
                    onClick={() => void onCancel(booking.id)}
                  >
                    Cancel booking
                  </Button>
                )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function TicketPage({ id, csrf }: { id: string; csrf: string }) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Booking>(`/bookings/${id}`)
      .then(setBooking)
      .catch((error) => setError(displayError(error)));
  }, [id]);
  async function cancel() {
    if (
      !booking ||
      !confirm("Cancel this booking? Your seats will be released.")
    )
      return;
    setBusy(true);
    try {
      setBooking(
        await api<Booking>(`/bookings/${id}/cancel`, "POST", undefined, csrf),
      );
      setError("");
    } catch (failure) {
      setError(displayError(failure));
    } finally {
      setBusy(false);
    }
  }
  if (error && !booking)
    return (
      <div className="wrap page-pad">
        <ErrorLine>{error}</ErrorLine>
        <a href="#bookings">← My bookings</a>
      </div>
    );
  if (!booking) return <Loading />;
  return (
    <section className="ticket-page wrap page-pad">
      <a className="back-link dark" href="#bookings">
        <ArrowLeft size={16} /> My bookings
      </a>
      <div className="ticket-intro">
        <span className="ticket-status">
          {booking.status === "confirmed"
            ? "YOU’RE ALL SET"
            : "BOOKING CANCELLED"}
        </span>
        <h1>
          {booking.status === "confirmed"
            ? "See you at the movies"
            : "Until next time"}
          <span className="coral">.</span>
        </h1>
        <p>
          {booking.status === "confirmed"
            ? "Your seat is reserved. Let the anticipation begin."
            : "This reservation has been cancelled."}
        </p>
      </div>
      <div className="ticket-card">
        <div className="ticket-card-main">
          <img
            src={posterSrc(booking.poster_url)}
            onError={(event) => posterFallback(event, booking.poster_url)}
            alt=""
          />
          <div>
            <span className={`status-tag ${booking.status}`}>
              {booking.status}
            </span>
            <h2>{booking.movie_title}</h2>
            <p>
              {day(booking.starts_at)}
              <br />
              {clock(booking.starts_at)} IST
            </p>
          </div>
        </div>
        <div className="ticket-divider" />
        <div className="ticket-details">
          <div>
            <span>SEATS</span>
            <strong>{booking.seats.join(", ")}</strong>
          </div>
          <div>
            <span>AMOUNT PAID</span>
            <strong>{money(booking.amount_paise)}</strong>
          </div>
          <div>
            <span>BOOKING ID</span>
            <strong className="ticket-id">{booking.id}</strong>
          </div>
        </div>
      </div>
      <ErrorLine>{error}</ErrorLine>
      {booking.status === "confirmed" &&
        new Date(booking.starts_at).getTime() - Date.now() >= 7200000 && (
          <Button
            className="cancel-link ticket-cancel"
            busy={busy}
            onClick={() => void cancel()}
          >
            Cancel this booking
          </Button>
        )}
      <a className="text-arrow" href="#">
        Explore more films <ArrowRight size={16} />
      </a>
    </section>
  );
}

function AdminPage({ csrf }: { csrf: string }) {
  const [tab, setTab] = useState<"shows" | "films">("shows");
  const [movies, setMovies] = useState<Movie[]>([]);
  const [shows, setShows] = useState<AdminShow[]>([]);
  const [inspected, setInspected] = useState<number | null>(null);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [seatData, setSeatData] = useState<ShowDetail | null>(null);
  const [editing, setEditing] = useState<Movie | null>(null);
  const [movieFormOpen, setMovieFormOpen] = useState(false);
  const [creditFields, setCreditFields] = useState<
    NonNullable<Movie["credits"]>
  >([]);
  const [showFormOpen, setShowFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setCreditFields(editing?.credits || []);
  }, [editing, movieFormOpen]);
  const load = useCallback(async () => {
    try {
      const [movieData, showData] = await Promise.all([
        api<Movie[]>("/admin/movies"),
        api<AdminShow[]>("/admin/shows"),
      ]);
      setMovies(movieData);
      setShows(showData);
      setError("");
    } catch (failure) {
      setError(displayError(failure));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (inspected == null) return;
    Promise.all([
      api<AdminBooking[]>(`/admin/shows/${inspected}/bookings`),
      api<ShowDetail>(`/shows/${inspected}`),
    ])
      .then(([b, s]) => {
        setBookings(b);
        setSeatData(s);
      })
      .catch((error) => setError(displayError(error)));
  }, [inspected]);
  async function saveMovie(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = new FormData(event.currentTarget);
    const credits = creditFields.map((credit) => ({
      ...credit,
      name: credit.name.trim(),
      role: credit.role.trim(),
      image_url: credit.image_url.trim(),
    }));
    if (credits.some((credit) => !credit.name || !credit.role)) {
      setError(
        "Enter a name and role for each credit, or remove the empty row.",
      );
      setBusy(false);
      return;
    }
    const body = {
      title: String(fields.get("title")),
      description: String(fields.get("description")),
      genre: String(fields.get("genre")),
      language: String(fields.get("language")),
      duration_minutes: Number(fields.get("duration_minutes")),
      rating: String(fields.get("rating")),
      poster_url: String(fields.get("poster_url")),
      backdrop_url: String(fields.get("backdrop_url")),
      release_date: String(fields.get("release_date") || ""),
      certification: String(fields.get("certification") || ""),
      trailer_url: String(fields.get("trailer_url") || ""),
      source_url: String(fields.get("source_url") || ""),
      credits,
    };
    try {
      await api(
        editing ? `/admin/movies/${editing.id}` : "/admin/movies",
        editing ? "PATCH" : "POST",
        body,
        csrf,
      );
      setMovieFormOpen(false);
      setEditing(null);
      await load();
    } catch (failure) {
      setError(displayError(failure));
    } finally {
      setBusy(false);
    }
  }
  async function deleteMovie(id: number) {
    if (!confirm("Delete this film and its empty shows?")) return;
    try {
      await api(`/admin/movies/${id}`, "DELETE", undefined, csrf);
      await load();
    } catch (failure) {
      setError(displayError(failure));
    }
  }
  async function saveShow(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = new FormData(event.currentTarget);
    try {
      await api(
        "/admin/shows",
        "POST",
        {
          movie_id: Number(fields.get("movie_id")),
          starts_at: new Date(String(fields.get("starts_at"))).toISOString(),
          price_paise: Math.round(Number(fields.get("price_rupees")) * 100),
        },
        csrf,
      );
      setShowFormOpen(false);
      await load();
    } catch (failure) {
      setError(displayError(failure));
    } finally {
      setBusy(false);
    }
  }
  async function deleteShow(id: number) {
    if (
      !confirm(
        "Delete this show? Shows with booking history cannot be deleted.",
      )
    )
      return;
    try {
      await api(`/admin/shows/${id}`, "DELETE", undefined, csrf);
      if (inspected === id) setInspected(null);
      await load();
    } catch (failure) {
      setError(displayError(failure));
    }
  }
  const adminDialog = useDialog(
    movieFormOpen || showFormOpen || inspected !== null,
    () => {
      setMovieFormOpen(false);
      setShowFormOpen(false);
      setInspected(null);
    },
  );
  const totalRevenue = shows.reduce((sum, show) => sum + show.revenue_paise, 0);
  const totalBooked = shows.reduce((sum, show) => sum + show.booked_seats, 0);
  return (
    <section className="admin-page wrap page-pad">
      <div className="admin-heading">
        <div>
          <h1>
            Studio admin<span className="coral">.</span>
          </h1>
          <p>A clear view of what’s playing and who’s coming.</p>
        </div>
        <span className="admin-badge">FRAME OPERATIONS</span>
      </div>
      <ErrorLine>{error}</ErrorLine>
      <div className="admin-stats">
        <div>
          <span>UPCOMING SHOWS</span>
          <strong>
            {
              shows.filter(
                (show) => new Date(show.starts_at).getTime() > Date.now(),
              ).length
            }
          </strong>
        </div>
        <div>
          <span>SEATS BOOKED</span>
          <strong>{totalBooked}</strong>
        </div>
        <div>
          <span>TOTAL REVENUE</span>
          <strong>{money(totalRevenue)}</strong>
        </div>
      </div>
      <div className="admin-tabs">
        <button
          className={tab === "shows" ? "selected" : ""}
          onClick={() => setTab("shows")}
        >
          Showtimes
        </button>
        <button
          className={tab === "films" ? "selected" : ""}
          onClick={() => setTab("films")}
        >
          Films
        </button>
      </div>
      {tab === "shows" ? (
        <>
          <div className="admin-section-title">
            <h2>
              Screenings <span>{shows.length}</span>
            </h2>
            <button
              className="button button-primary"
              onClick={() => setShowFormOpen(true)}
            >
              <Plus size={17} /> Add show
            </button>
          </div>
          <div className="admin-show-list">
            {shows.map((show) => (
              <article
                className="admin-show"
                key={show.id}
                data-show-id={show.id}
              >
                <div>
                  <strong>{show.movie_title}</strong>
                  <span>
                    {day(show.starts_at)} · {clock(show.starts_at)}
                  </span>
                </div>
                <div className="admin-show-numbers">
                  <span>
                    <strong>{show.booked_seats}/80</strong> booked
                  </span>
                  <span>
                    <strong>{show.occupancy_percent}%</strong> occupancy
                  </span>
                  <span>
                    <strong>{money(show.revenue_paise)}</strong> revenue
                  </span>
                </div>
                <div className="admin-show-actions">
                  <button
                    className="text-arrow"
                    onClick={() => setInspected(show.id)}
                  >
                    View details <ArrowRight size={15} />
                  </button>
                  <button
                    className="delete-link"
                    onClick={() => void deleteShow(show.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
            {!shows.length && (
              <div className="empty-state">No shows scheduled yet.</div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="admin-section-title">
            <h2>
              Film library <span>{movies.length}</span>
            </h2>
            <button
              className="button button-primary"
              onClick={() => {
                setEditing(null);
                setMovieFormOpen(true);
              }}
            >
              <Plus size={17} /> Add film
            </button>
          </div>
          <div className="admin-film-list">
            {movies.map((movie) => (
              <article className="admin-film" key={movie.id}>
                <img
                  src={posterSrc(movie.poster_url)}
                  onError={(event) => posterFallback(event, movie.poster_url)}
                  alt=""
                />
                <div>
                  <h3>{movie.title}</h3>
                  <span>
                    {movie.genre} · {movie.language} ·{" "}
                    {duration(movie.duration_minutes)} · {movie.rating}
                  </span>
                </div>
                <button
                  className="text-arrow"
                  onClick={() => {
                    setEditing(movie);
                    setMovieFormOpen(true);
                  }}
                >
                  Edit
                </button>
                <button
                  className="delete-link"
                  onClick={() => void deleteMovie(movie.id)}
                >
                  Delete
                </button>
              </article>
            ))}
            {!movies.length && (
              <div className="empty-state">No films in the library.</div>
            )}
          </div>
        </>
      )}
      {showFormOpen && (
        <div className="modal-backdrop">
          <section
            ref={adminDialog}
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="show-form-title"
          >
            <button
              className="modal-close icon-button"
              onClick={() => setShowFormOpen(false)}
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <h2 id="show-form-title">Add a show</h2>
            <form onSubmit={saveShow}>
              <label>
                Film
                <select name="movie_id" required>
                  {movies.map((movie) => (
                    <option key={movie.id} value={movie.id}>
                      {movie.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Start time (your local time)
                <input name="starts_at" type="datetime-local" required />
              </label>
              <label>
                Ticket price (₹)
                <input
                  name="price_rupees"
                  type="number"
                  min="1"
                  step="0.01"
                  required
                />
              </label>
              <ErrorLine>{error}</ErrorLine>
              <Button
                className="button button-primary full"
                type="submit"
                busy={busy}
              >
                Create show
              </Button>
            </form>
          </section>
        </div>
      )}
      {movieFormOpen && (
        <div className="modal-backdrop">
          <section
            ref={adminDialog}
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="movie-form-title"
          >
            <button
              className="modal-close icon-button"
              onClick={() => {
                setMovieFormOpen(false);
                setEditing(null);
              }}
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <h2 id="movie-form-title">
              {editing ? "Edit film" : "Add a film"}
            </h2>
            <form onSubmit={saveMovie}>
              <label>
                Title
                <input name="title" defaultValue={editing?.title} required />
              </label>
              <label>
                Description
                <textarea
                  name="description"
                  defaultValue={editing?.description}
                  required
                  rows={3}
                />
              </label>
              <div className="form-grid">
                <label>
                  Genre
                  <input name="genre" defaultValue={editing?.genre} required />
                </label>
                <label>
                  Language
                  <input
                    name="language"
                    defaultValue={editing?.language}
                    required
                  />
                </label>
                <label>
                  Duration (minutes)
                  <input
                    name="duration_minutes"
                    type="number"
                    min="1"
                    defaultValue={editing?.duration_minutes}
                    required
                  />
                </label>
                <label>
                  Rating
                  <select name="rating" defaultValue={editing?.rating || "UA"}>
                    <option>U</option>
                    <option>UA</option>
                    <option>A</option>
                  </select>
                </label>
              </div>
              <label>
                Poster URL
                <input
                  name="poster_url"
                  defaultValue={editing?.poster_url}
                  required
                />
              </label>
              <label>
                Backdrop URL
                <input
                  name="backdrop_url"
                  defaultValue={editing?.backdrop_url}
                  required
                />
              </label>
              <div className="form-grid">
                <label>
                  Release date
                  <input
                    name="release_date"
                    type="date"
                    defaultValue={editing?.release_date}
                  />
                </label>
                <label>
                  Certification
                  <input
                    name="certification"
                    defaultValue={editing?.certification}
                  />
                </label>
              </div>
              <label>
                Trailer URL
                <input
                  name="trailer_url"
                  type="url"
                  defaultValue={editing?.trailer_url}
                />
              </label>
              <label>
                Source URL
                <input
                  name="source_url"
                  type="url"
                  defaultValue={editing?.source_url}
                />
              </label>
              <fieldset className="credits-editor">
                <legend>Cast &amp; crew</legend>
                {creditFields.map((credit, index) => (
                  <div className="credit-fields" key={index}>
                    {(["name", "role", "image_url"] as const).map((field) => (
                      <label key={field}>
                        {field === "image_url"
                          ? "Photo URL (optional)"
                          : field === "name"
                            ? "Name"
                            : "Role"}
                        <input
                          aria-label={`Credit ${index + 1} ${field === "image_url" ? "photo URL" : field}`}
                          value={credit[field]}
                          maxLength={
                            field === "image_url"
                              ? 2048
                              : field === "name"
                                ? 100
                                : 80
                          }
                          onChange={(event) =>
                            setCreditFields((current) =>
                              current.map((item, row) =>
                                row === index
                                  ? { ...item, [field]: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>
                    ))}
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove credit ${index + 1}`}
                      onClick={() =>
                        setCreditFields((current) =>
                          current.filter((_, row) => row !== index),
                        )
                      }
                    >
                      <X size={17} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="button button-outline"
                  disabled={creditFields.length >= 24}
                  onClick={() =>
                    setCreditFields((current) => [
                      ...current,
                      { name: "", role: "", image_url: "" },
                    ])
                  }
                >
                  Add credit
                </button>
              </fieldset>
              <ErrorLine>{error}</ErrorLine>
              <Button
                className="button button-primary full"
                type="submit"
                busy={busy}
              >
                {editing ? "Save changes" : "Add film"}
              </Button>
            </form>
          </section>
        </div>
      )}
      {inspected !== null && (
        <div className="modal-backdrop">
          <section
            ref={adminDialog}
            className="admin-modal inspector"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inspect-title"
          >
            <button
              className="modal-close icon-button"
              onClick={() => {
                setInspected(null);
                setSeatData(null);
              }}
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <h2 id="inspect-title">
              {shows.find((show) => show.id === inspected)?.movie_title}
            </h2>
            <p>
              {shows.find((show) => show.id === inspected) &&
                day(
                  shows.find((show) => show.id === inspected)!.starts_at,
                )}{" "}
              ·{" "}
              {shows.find((show) => show.id === inspected) &&
                clock(shows.find((show) => show.id === inspected)!.starts_at)}
            </p>
            {seatData && (
              <>
                <div className="inspector-legend">
                  <span>
                    <i className="legend-seat available" /> Available
                  </span>
                  <span>
                    <i className="legend-seat held" /> Held
                  </span>
                  <span>
                    <i className="legend-seat booked" /> Booked
                  </span>
                </div>
                <div className="mini-seat-map">
                  <div aria-hidden="true">
                    <span />
                    {Array.from({ length: 10 }, (_, index) => (
                      <span className="mini-row-label" key={index}>{index + 1}</span>
                    ))}
                  </div>
                  {"ABCDEFGH".split("").map((row) => (
                    <div key={row}>
                      <span className="mini-row-label">{row}</span>
                      {Array.from({ length: 10 }, (_, index) => {
                        const seat = seatData.seats.find(
                          (s) => s.label === `${row}${index + 1}`,
                        );
                        return (
                          <span
                            key={index}
                            className={`mini-seat ${seat?.state}`}
                            title={`${row}${index + 1}: ${seat?.state}`}
                          >
                            {seat?.state === "booked" ? <X size={10} aria-hidden /> :
                              seat?.state === "held" ? <Minus size={10} aria-hidden /> : null}
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </>
            )}
            <h3>Customer bookings</h3>
            {bookings.length ? (
              <div className="inspector-bookings">
                {bookings.map((booking) => (
                  <div key={booking.id}>
                    <strong>{booking.customer_name}</strong>
                    <span>
                      {booking.seats.join(", ")} · {money(booking.amount_paise)}{" "}
                      · {booking.status}
                    </span>
                    <span>
                      Booking ID: {booking.id} · Booked: {day(booking.created_at)} {clock(booking.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No bookings for this show.</p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
