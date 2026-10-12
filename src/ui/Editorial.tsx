import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, Search } from "lucide-react";

type Credit = { name: string; role: string; image_url: string };
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
  credits?: Credit[];
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
const known = ["orbit", "monsoon", "neon", "last-light"];
const localPoster = (url: string) => {
  const name = known.find((item) => url.endsWith(`/${item}.svg`));
  return name ? `/posters/${name}-v2.webp` : url;
};
const fallback = (
  event: React.SyntheticEvent<HTMLImageElement>,
  url: string,
) => {
  if (event.currentTarget.src !== new URL(url, location.href).href)
    event.currentTarget.src = url;
};
const money = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const time = (iso: string) =>
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
const key = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
const duration = (minutes: number) =>
  `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
async function get<T>(path: string): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok)
    throw new Error(
      (await response.json().catch(() => ({}))).error ||
        "Unable to load films.",
    );
  return response.json();
}

export function Home({
  onMovie,
  initialMovies,
  query,
  onQueryChange,
}: {
  onMovie: (id: number) => void;
  initialMovies: Movie[];
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const [movies, setMovies] = useState(initialMovies);
  const [next, setNext] = useState<Record<number, Show | null | undefined>>({});
  const [genre, setGenre] = useState("All");
  const [language, setLanguage] = useState("All");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(true);
  function load() {
    setError("");
    setNext({});
    setLoaded(false);
    get<Movie[]>("/movies")
      .then(async (list) => {
        setMovies(list);
        setLoaded(true);
        const shows = await Promise.allSettled(
          list.map((movie) => get<{ shows: Show[] }>(`/movies/${movie.id}`)),
        );
        setNext(
          Object.fromEntries(
            shows.map((result, index) => [
              list[index].id,
              result.status === "fulfilled"
                ? (result.value.shows[0] ?? null)
                : undefined,
            ]),
          ),
        );
        if (shows.some((result) => result.status === "rejected"))
          setError("Some showtimes could not be loaded. Please retry.");
      })
      .catch((failure) => {
        setError(failure.message);
        setLoaded(true);
      });
  }
  useEffect(() => {
    load();
  }, []);
  const genres = ["All", ...new Set(movies.map((movie) => movie.genre))];
  const languages = ["All", ...new Set(movies.map((movie) => movie.language))];
  const visible = movies.filter(
    (movie) =>
      (genre === "All" || movie.genre === genre) &&
      (language === "All" || movie.language === language) &&
      `${movie.title} ${movie.language} ${movie.genre}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <section className="catalogue wrap" id="films">
      <div className="catalogue-head">
        <div>
          <h1>Now showing</h1>
          <p>Choose a film, then a time that works for you.</p>
        </div>
        <label className="film-search">
          <Search size={18} />
          <span className="sr-only">Search films</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search films"
          />
        </label>
      </div>
      <div className="catalogue-filters">
        <div
          className="genre-controls"
          role="group"
          aria-label="Filter by genre"
        >
          {genres.map((value) => (
            <button
              key={value}
              className={genre === value ? "active" : ""}
              aria-pressed={genre === value}
              onClick={() => setGenre(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <div
          className="genre-controls language-controls"
          role="group"
          aria-label="Filter by language"
        >
          {languages.map((value) => (
            <button
              key={value}
              className={language === value ? "active" : ""}
              aria-pressed={language === value}
              onClick={() => setLanguage(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p className="error-line" role="alert">
          {error} <button onClick={load}>Try again</button>
        </p>
      )}
      {movies.length > 0 && !visible.length && (
        <p className="empty-state">No films found. Try another search.</p>
      )}
      <div className="editorial-grid">
        {visible.map((movie, index) => (
          <article className="editorial-film" key={movie.id}>
            <button
              className="film-card-open"
              onClick={() => onMovie(movie.id)}
              aria-label={`View ${movie.title} showtimes`}
            >
              <img
                className="editorial-poster"
                src={localPoster(movie.poster_url)}
                onError={(event) => fallback(event, movie.poster_url)}
                alt={`${movie.title} poster`}
                loading={index > 3 ? "lazy" : "eager"}
              />
            </button>
            <div className="film-card-copy">
              <h2>{movie.title}</h2>
              <p>
                {movie.genre} · {movie.language}
              </p>
              <p>
                {duration(movie.duration_minutes)} ·{" "}
                {movie.certification || movie.rating}
              </p>
              {next[movie.id] ? (
                <span className="next-show">
                  Next: {shortDay(next[movie.id]!.starts_at)} ·{" "}
                  {time(next[movie.id]!.starts_at)} ·{" "}
                  {money(next[movie.id]!.price_paise)}
                </span>
              ) : (
                <span className="next-show">
                  {!Object.hasOwn(next, movie.id)
                    ? "Loading showtimes…"
                    : next[movie.id] === null
                      ? "Showtimes coming soon"
                      : "Showtimes unavailable"}
                </span>
              )}
              <button className="text-arrow" onClick={() => onMovie(movie.id)}>
                View showtimes <ArrowRight size={16} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!movies.length && loaded && !error && (
        <p className="empty-state">No films are showing yet.</p>
      )}
    </section>
  );
}

export function MoviePage({
  id,
  onBook,
}: {
  id: number;
  onBook: (id: number) => void;
}) {
  const [data, setData] = useState<{ movie: Movie; shows: Show[] } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [chosenDay, setChosenDay] = useState("");
  const showtimesRef = useRef<HTMLElement>(null);
  useEffect(() => {
    setData(null);
    get<{ movie: Movie; shows: Show[] }>(`/movies/${id}`)
      .then((result) => {
        setData(result);
        setChosenDay(result.shows[0] ? key(result.shows[0].starts_at) : "");
      })
      .catch((failure) => setError(failure.message));
  }, [id]);
  if (error)
    return (
      <div className="wrap page-pad">
        <p className="error-line" role="alert">
          {error}
        </p>
        <a href="#">Back to films</a>
      </div>
    );
  if (!data)
    return (
      <div className="loading" role="status">
        Loading film details…
      </div>
    );
  const { movie, shows } = data;
  const dates = [...new Set(shows.map((show) => key(show.starts_at)))];
  const selectedShows = shows.filter(
    (show) => key(show.starts_at) === chosenDay,
  );
  return (
    <>
      <section className="movie-detail">
        <div className="wrap">
          <a className="back-link dark" href="#">
            <ArrowLeft size={17} /> Now showing
          </a>
          <div className="film-detail-layout">
            <img
              className="detail-poster"
              src={localPoster(movie.poster_url)}
              onError={(event) => fallback(event, movie.poster_url)}
              alt={`${movie.title} poster`}
            />
            <div className="detail-copy">
              <h1>{movie.title}</h1>
              <p className="film-facts">
                {movie.genre} <span>·</span> {movie.language} <span>·</span>{" "}
                {duration(movie.duration_minutes)} <span>·</span>{" "}
                {movie.certification || movie.rating}
                {movie.release_date && (
                  <>
                    <span>·</span>{" "}
                    {new Intl.DateTimeFormat("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(`${movie.release_date}T00:00:00`))}
                  </>
                )}
              </p>
              <p>{movie.description}</p>
              <button
                className="button button-primary"
                onClick={() => {
                  showtimesRef.current?.focus({ preventScroll: true });
                  showtimesRef.current?.scrollIntoView({
                    behavior: matchMedia("(prefers-reduced-motion: reduce)")
                      .matches
                      ? "auto"
                      : "smooth",
                    block: "start",
                  });
                }}
              >
                Book tickets <ArrowRight size={17} />
              </button>
              {movie.trailer_url && (
                <a
                  className="text-arrow external-link"
                  href={movie.trailer_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Watch trailer <ExternalLink size={15} />
                </a>
              )}
            </div>
          </div>
          {movie.credits?.length ? (
            <section className="credits">
              <h2>Cast &amp; crew</h2>
              <div>
                {movie.credits.map((credit) => (
                  <article
                    key={`${credit.name}-${credit.role}`}
                    className="credit"
                  >
                    <span className="credit-avatar">
                      {credit.image_url ? (
                        <img src={credit.image_url} alt="" />
                      ) : (
                        credit.name
                          .split(/\s+/)
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")
                      )}
                    </span>
                    <span>
                      <strong>{credit.name}</strong>
                      <small>{credit.role}</small>
                    </span>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          {movie.source_url && (
            <p className="source-attribution">
              Film information:{" "}
              <a
                href={movie.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                source
              </a>
            </p>
          )}
        </div>
      </section>
      <section
        ref={showtimesRef}
        tabIndex={-1}
        className="showtime-section wrap"
        id="showtimes"
      >
        <div className="showtime-intro">
          <h2>Showtimes</h2>
          <p>
            All times are India Standard Time. Select a screening to choose
            seats.
          </p>
        </div>
        {dates.length ? (
          <>
            <div
              className="date-strip"
              role="group"
              aria-label="Choose a show date"
            >
              {dates.map((date) => {
                const first = shows.find(
                  (show) => key(show.starts_at) === date,
                )!;
                return (
                  <button
                    key={date}
                    className={chosenDay === date ? "active" : ""}
                    aria-pressed={chosenDay === date}
                    onClick={() => setChosenDay(date)}
                  >
                    <strong>
                      {new Intl.DateTimeFormat("en-IN", {
                        timeZone: "Asia/Kolkata",
                        weekday: "short",
                      }).format(new Date(first.starts_at))}
                    </strong>
                    <span>{shortDay(first.starts_at)}</span>
                  </button>
                );
              })}
            </div>
            <div className="screenings">
              <h3>{day(selectedShows[0]?.starts_at || shows[0].starts_at)}</h3>
              {selectedShows.map((show) => (
                <button
                  className="screening"
                  key={show.id}
                  disabled={show.available_seats === 0}
                  onClick={() => onBook(show.id)}
                >
                  <span className="screening-time">{time(show.starts_at)}</span>
                  <span className="screening-availability">
                    {show.available_seats
                      ? `${show.available_seats} of 80 available`
                      : "Sold out"}
                  </span>
                  <span className="screening-price">
                    {money(show.price_paise)}
                  </span>
                  <ArrowRight size={18} />
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            No upcoming screenings yet. Check back soon.
          </div>
        )}
      </section>
    </>
  );
}
