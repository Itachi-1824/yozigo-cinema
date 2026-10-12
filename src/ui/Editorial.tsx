import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Search } from 'lucide-react';

type Movie = { id: number; title: string; description: string; language: string; duration_minutes: number; rating: 'U' | 'UA' | 'A'; poster_url: string; backdrop_url: string; genre: string };
type Show = { id: number; movie_id: number; starts_at: string; ends_at: string; price_paise: number; available_seats: number };
const known = ['orbit', 'monsoon', 'neon', 'last-light'];
const slug = (url: string) => known.find(name => url.endsWith(`/${name}.svg`));
const art = (movie: Movie) => slug(movie.poster_url) ? `/art/${slug(movie.poster_url)}.jpg` : movie.backdrop_url;
const poster = (movie: Movie) => slug(movie.poster_url) ? `/posters/${slug(movie.poster_url)}-v2.webp` : movie.poster_url;
const fallback = (event: React.SyntheticEvent<HTMLImageElement>, url: string) => { if (event.currentTarget.src !== new URL(url, location.href).href) event.currentTarget.src = url; };
const money = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const time = (iso: string) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso));
const day = (iso: string) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));
const shortDay = (iso: string) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }).format(new Date(iso));
const key = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const duration = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin' });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Unable to load films.');
  return response.json();
}

export function Home({ onMovie }: { onMovie: (id: number) => void }) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [next, setNext] = useState<Record<number, Show | undefined>>({});
  const [featured, setFeatured] = useState(0);
  const [genre, setGenre] = useState('All');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  function load() {
    setError('');
    get<Movie[]>('/movies').then(async list => {
      setMovies(list);
      const shows = await Promise.allSettled(list.map(movie => get<{ shows: Show[] }>(`/movies/${movie.id}`)));
      setNext(Object.fromEntries(shows.map((result, index) => [list[index].id, result.status === 'fulfilled' ? result.value.shows[0] : undefined])));
    }).catch(failure => setError(failure.message));
  }
  useEffect(() => { load(); }, []);
  const film = movies[featured];
  const genres = ['All', ...new Set(movies.map(movie => movie.genre))];
  const visible = movies.filter(movie => (genre === 'All' || movie.genre === genre) && `${movie.title} ${movie.language} ${movie.genre}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <div className="home-feature"><section className="edition-head wrap"><div className="edition-top"><span>NOW SHOWING</span><span>{movies.length ? `${String(movies.length).padStart(2, '0')} FILMS` : ''}</span></div><h1>A good film.<br /><em>A great night.</em></h1><p>The lights go down. Everything else can wait.</p></section>
    <section className={film ? 'featured-film' : 'featured-film is-loading'} aria-label="Featured films">
      {film ? <><div className="feature-image" key={film.id}><img src={art(film)} onError={event => fallback(event, film.backdrop_url)} alt="" /><div className="feature-shade" /></div><div className="wrap feature-inner"><div className="feature-copy"><span className="feature-index">NOW SHOWING</span><h2>{film.title}</h2><p>{film.genre} <b>·</b> {film.language} <b>·</b> {duration(film.duration_minutes)} <b>·</b> {film.rating}</p><button className="signal-button" onClick={() => onMovie(film.id)}>Book tickets <ArrowRight size={19} /></button></div></div></> : <div className="wrap feature-loading">{error ? <div role="alert"><p>{error}</p><button className="button" onClick={load}>Try loading films again</button></div> : 'Preparing the screen…'}</div>}
    </section>
    {movies.length > 0 && <div className="feature-selector wrap" role="group" aria-label="Choose featured film">{movies.map((movie, index) => <button key={movie.id} aria-current={featured === index ? 'true' : undefined} className={featured === index ? 'active' : ''} onClick={() => setFeatured(index)}><img src={art(movie)} alt="" onError={event => fallback(event, movie.backdrop_url)} /><span><strong>{movie.title}</strong><small>{movie.genre}</small></span></button>)}</div>}</div>
    <section className="film-list wrap" id="films"><div className="film-list-intro"><h2>On the screen<span>.</span></h2><p>Find a story, then find your seat.</p></div><div className="film-tools"><div className="genre-controls" role="group" aria-label="Filter by genre">{genres.map(value => <button key={value} className={genre === value ? 'active' : ''} aria-pressed={genre === value} onClick={() => setGenre(value)}>{value}</button>)}</div><label className="film-search"><Search size={18} /><span className="sr-only">Search films</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search films" /></label></div>{error && <p className="error-line" role="alert">{error}</p>}{movies.length > 0 && !visible.length && <p className="empty-state">No films found. Try another search.</p>}<div className="editorial-grid">{visible.map((movie, index) => <button key={movie.id} className="editorial-film" onClick={() => onMovie(movie.id)}><span className="editorial-poster"><img src={poster(movie)} onError={event => fallback(event, movie.poster_url)} alt="" loading={index > 1 ? 'lazy' : 'eager'} /><span className="poster-number">{String(index + 1).padStart(2, '0')}</span></span><span className="editorial-film-line"><span>{movie.genre} / {movie.language} / {duration(movie.duration_minutes)}</span><span>{movie.rating}</span></span><strong>{movie.title}</strong><span className="next-show">{next[movie.id] ? `Next · ${shortDay(next[movie.id]!.starts_at)} ${time(next[movie.id]!.starts_at)} · ${money(next[movie.id]!.price_paise)}` : 'View film & showtimes'}<ArrowRight size={17} /></span></button>)}</div></section>
  </>;
}

export function MoviePage({ id, onBook }: { id: number; onBook: (id: number) => void }) {
  const [data, setData] = useState<{ movie: Movie; shows: Show[] } | null>(null);
  const [error, setError] = useState('');
  const [chosenDay, setChosenDay] = useState('');
  const showtimesRef = useRef<HTMLElement>(null);
  useEffect(() => { setData(null); get<{ movie: Movie; shows: Show[] }>(`/movies/${id}`).then(result => { setData(result); setChosenDay(result.shows[0] ? key(result.shows[0].starts_at) : ''); }).catch(failure => setError(failure.message)); }, [id]);
  if (error) return <div className="wrap page-pad"><p className="error-line" role="alert">{error}</p><a href="#">Back to films</a></div>;
  if (!data) return <div className="loading">Preparing the screen…</div>;
  const { movie, shows } = data;
  const dates = [...new Set(shows.map(show => key(show.starts_at)))];
  return <>
    <section className="film-detail wrap"><a className="back-link dark" href="#"><ArrowLeft size={17} /> All films</a><div className="film-detail-layout"><div className="detail-art"><img src={art(movie)} onError={event => fallback(event, movie.backdrop_url)} alt="" /></div><div className="detail-editorial"><span className="detail-category">{movie.genre} <span>/</span> Now showing</span><h1>{movie.title}</h1><div className="film-facts"><span>{movie.language}</span><span>{duration(movie.duration_minutes)}</span><span>{movie.rating}</span></div><p>{movie.description}</p><button className="underlined-action" onClick={() => { showtimesRef.current?.focus({ preventScroll: true }); showtimesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>See showtimes <ArrowRight size={18} /></button></div></div></section>
    <section ref={showtimesRef} tabIndex={-1} className="showtime-section wrap" id="showtimes"><div className="showtime-intro"><h2>Choose a show.</h2><p>All times are India Standard Time. Select a screening to choose your seats.</p></div>{dates.length ? <><div className="date-strip" role="group" aria-label="Choose a show date">{dates.map(date => { const first = shows.find(show => key(show.starts_at) === date)!; return <button key={date} className={chosenDay === date ? 'active' : ''} aria-pressed={chosenDay === date} onClick={() => setChosenDay(date)}><strong>{new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(new Date(first.starts_at))}</strong><span>{new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }).format(new Date(first.starts_at))}</span></button>; })}</div><div className="screenings"><div className="screening-header"><span>{day(shows.find(show => key(show.starts_at) === chosenDay)?.starts_at || shows[0].starts_at)}</span><span>{shows.filter(show => key(show.starts_at) === chosenDay).length} screenings</span></div>{shows.filter(show => key(show.starts_at) === chosenDay).map(show => <button className="screening" key={show.id} disabled={show.available_seats === 0} onClick={() => onBook(show.id)}><span className="screening-time">{time(show.starts_at)}</span><span className="screening-availability">{show.available_seats ? `${show.available_seats} seats left` : 'Sold out'}<small>ONE SCREEN</small></span><span className="screening-price">{money(show.price_paise)}</span><ArrowRight size={21} /></button>)}</div></> : <div className="empty-state">No upcoming screenings yet. Check back soon.</div>}</section>
  </>;
}
