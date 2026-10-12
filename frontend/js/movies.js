const API_BASE = window.WEBFLIX_API_BASE ?? "https://inf2003-backend-161924392.asia-southeast1.run.app";
const PLACEHOLDER_CARD = "assets/poster-placeholder.svg";
const PLACEHOLDER_DETAIL = "assets/poster-placeholder.svg";

// tiny escape to avoid XSS when inserting strings into HTML
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])
  );

function formatRuntime(minutes) {
  const n = Number(minutes);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function formatCurrency(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatList(list) {
  if (!Array.isArray(list) || !list.length) return "";
  return list.join(", ");
}

// ---- pagination state ----
let currentPage = 1;
let currentQuery = "";

// ---------- HOME (catalog) ----------

function renderCard(m) {
  const img = m.poster_url || PLACEHOLDER_CARD;
  const year = m.year ? `(${m.year})` : "";
  const genres = formatList(m.genres);
  const rating =
    m.vote_average != null ? m.vote_average.toFixed(1) : "–";
  const overviewShort = m.overview
    ? m.overview.length > 110
      ? m.overview.slice(0, 110) + "…"
      : m.overview
    : "";

  return `
  <div class="col-12 col-sm-6 col-md-4 col-lg-3 mb-4">
    <div class="card h-100 shadow-sm">
      <img src="${esc(safeImage(img, PLACEHOLDER_CARD))}" loading="lazy" onerror="this.src='assets/poster-placeholder.svg'" class="card-img-top" alt="${esc(m.title)}">
      <div class="card-body d-flex flex-column">
      <button class="btn btn-outline-danger btn-sm mb-2 bookmark-btn"
              data-id="${esc(m._id)}"
              data-title="${esc(m.title)}">
        ❤️ Bookmark
      </button>

        <h5 class="card-title">${esc(m.title)} ${year}</h5>
        <p class="mb-1"><strong>Genres:</strong> ${esc(genres || "—")}</p>
        <p class="text-muted mb-1">⭐ ${esc(rating)}</p>
        ${
          overviewShort
            ? `<p class="small text-muted mb-2">${esc(overviewShort)}</p>`
            : ""
        }
        <a class="btn btn-primary mt-auto" href="movie.html?id=${encodeURIComponent(
          m._id
        )}">Details</a>
      </div>
    </div>
  </div>`;
}

function renderPagination(meta) {
  const container = document.getElementById("pagination");
  if (!container) return;

  const page = meta.page || 1;
  const totalPages = meta.totalPages || 1;

  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  container.innerHTML = `
    <div class="d-flex align-items-center justify-content-center gap-2">
      <button class="btn btn-outline-secondary btn-sm" data-role="prev" ${
        hasPrev ? "" : "disabled"
      }>
        &laquo; Prev
      </button>
      <span class="small text-muted">Page ${page} of ${totalPages}</span>
      <button class="btn btn-outline-secondary btn-sm" data-role="next" ${
        hasNext ? "" : "disabled"
      }>
        Next &raquo;
      </button>
    </div>
  `;

  const prevBtn = container.querySelector('button[data-role="prev"]');
  const nextBtn = container.querySelector('button[data-role="next"]');

  if (prevBtn && hasPrev) {
    prevBtn.addEventListener("click", () => {
      loadMovies(page - 1);
    });
  }
  if (nextBtn && hasNext) {
    nextBtn.addEventListener("click", () => {
      loadMovies(page + 1);
    });
  }
}

async function loadMovies(page = 1, q = null) {
  const list = document.getElementById("movies");
  const pager = document.getElementById("pagination");
  if (!list) return;

  if (q === null) q = currentQuery;
  currentQuery = q;
  currentPage = page;

  list.innerHTML = `<p class="text-muted">Loading…</p>`;
  if (pager) pager.innerHTML = "";

  try {
    const url = new URL(`${API_BASE}/api/movies`, window.location.origin);
    url.searchParams.set("limit", 24);
    url.searchParams.set("page", page);
    // only movies with rating > 0
    url.searchParams.set("minRating", 0);
    if (q) url.searchParams.set("q", q);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const docs = data.documents || [];
    if (!q && page === 1) {
      const featured = docs.find(m => m.poster_url);
      const cover = document.getElementById("catalog-cover");
      if (featured && cover) {
        cover.src = safeImage(featured.poster_url);
        cover.hidden = false;
      }
    }

    await loadSavedMovieIds();
    list.innerHTML =
      docs.map(renderCard).join("") ||
      `<p class="text-muted">No results.</p>`;

      document.querySelectorAll(".bookmark-btn").forEach(btn => {
      updateWatchlistButton(btn, btn.dataset.id);
      btn.addEventListener("click", () => {
        const movieId = btn.dataset.id;
        const title = btn.dataset.title;
        addToWatchlist(movieId, title, btn);
      });
    });

    if (pager) {
      renderPagination({
        page: data.page || page,
        totalPages: data.totalPages || page,
      });
    }
  } catch (err) {
    console.error(err);
    list.innerHTML = `<p class="text-danger">Failed to load movies.</p>`;
  }
}

// lets your inline button keep working: onclick="searchMovies()"
function searchMovies() {
  const input = document.getElementById("search");
  const q = input ? input.value.trim() : "";
  loadMovies(1, q); // reset to first page on new search
}

function hookSearch() {
  const input = document.getElementById("search");
  const btn = document.getElementById("searchBtn");
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") searchMovies();
    });
  }
  if (btn) {
    btn.addEventListener("click", () => searchMovies());
  }
}

// ---------- DETAILS (movie.html) ----------

function safeImage(value, fallback = PLACEHOLDER_DETAIL) {
  try {
    const url = new URL(value, location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : fallback;
  } catch { return fallback; }
}

function renderDetails(m) {
  const poster = safeImage(m.poster_url);
  const backdrop = safeImage(m.backdrop_url || m.poster_url);
  const rating = Number(m.vote_average);
  const stars = Number.isFinite(rating) && rating > 0
    ? "&#9733;".repeat(Math.max(1, Math.min(5, Math.round(rating / 2))))
    : "";
  const facts = [
    ["Running time", formatRuntime(m.runtime)],
    ["Budget", formatCurrency(m.budget)],
    ["Release date", m.release_date || "Not available"],
    ["Rating", rating > 0 ? rating.toFixed(1) + " / 10" : "Not rated"]
  ];
  let official = "";
  try {
    const url = new URL(m.homepage);
    if (["http:", "https:"].includes(url.protocol)) {
      official = '<a href="' + esc(url.href) + '" target="_blank" rel="noopener noreferrer">Official website &#8599;</a>';
    }
  } catch {}
  const imdb = m.imdb_id ? '<a href="https://www.imdb.com/title/' + encodeURIComponent(m.imdb_id) + '" target="_blank" rel="noopener noreferrer">IMDb &#8599;</a>' : "";
  return `
    <div class="movie-cover"><img src="${esc(backdrop)}" alt="" onerror="this.src='assets/poster-placeholder.svg'"><div class="cover-shade"></div><div class="cover-caption"><span>WEBFLIX / MOVIE PROFILE</span><p>Every frame tells a story.</p></div></div>
    <article class="movie-profile">
      <header class="movie-heading">
        <div><h1 id="movie-title">${esc(m.title)} <small>${m.year ? "(" + esc(m.year) + ")" : ""}</small></h1><p class="movie-genres">${esc(formatList(m.genres) || "Genres unavailable")}</p><span class="movie-stars" aria-label="${rating > 0 ? esc(rating.toFixed(1)) + ' out of 10' : 'Not rated'}">${stars}</span></div>
        <div class="movie-links">${official}${imdb}<a href="index.html#catalog">Back to collection &#8592;</a></div>
      </header>
      <dl class="movie-metrics">${facts.map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>
      <nav class="movie-section-nav" aria-label="Movie sections"><a href="#plot"><span aria-hidden="true">&#9636;</span>Plot</a><a href="#film-facts"><span aria-hidden="true">&#9432;</span>Film facts</a><a href="#reviews"><span aria-hidden="true">&#9733;</span>Reviews</a><a href="#related-section"><span aria-hidden="true">&#9654;</span>More movies</a></nav>
      <div class="movie-editorial">
        <img class="detail-poster" src="${esc(poster)}" alt="${esc(m.title)} poster" onerror="this.src='assets/poster-placeholder.svg'">
        <section id="plot"><span class="section-kicker">THE STORY</span><h2>Plot</h2><p>${esc(m.overview || "A synopsis is not available for this movie.")}</p><a class="btn btn-dark" href="#reviews">Read the reviews &#8594;</a></section>
        <section id="film-facts"><span class="section-kicker">BEHIND THE FILM</span><h2>Film facts</h2><dl class="film-facts">${[
          ["Production", formatList(m.production_companies)],
          ["Countries", formatList(m.production_countries)],
          ["Languages", formatList(m.spoken_languages)],
          ["Status", m.status],
          ["Revenue", formatCurrency(m.revenue)],
          ...(m.collection?.name ? [["Collection", m.collection.name]] : [])
        ].map(([label,value]) => `<dt>${label}</dt><dd>${esc(value || "Not available")}</dd>`).join("")}</dl></section>
      </div>
    </article>
    ${m.tagline ? `<aside class="movie-tagline"><p>&ldquo;${esc(m.tagline)}&rdquo;</p><span>${esc(m.title)}</span></aside>` : ""}
  `;
}

async function loadRelatedMovies(movie) {
  const target = document.getElementById("related-movies");
  const heading = document.getElementById("related-heading");
  if (!target) return;
  try {
    const response = await fetch(API_BASE + "/api/movies?limit=36&minRating=0");
    if (!response.ok) throw new Error("Could not load more movies");
    const data = await response.json();
    const candidates = (data.documents || []).filter(m => m._id !== movie._id);
    const genres = new Set(movie.genres || []);
    const matching = candidates.filter(m => (m.genres || []).some(g => genres.has(g)));
    const related = matching.length ? matching.slice(0,6) : candidates.slice(0,6);
    heading.textContent = matching.length ? "Related movies" : "More to discover";
    target.innerHTML = related.map(m => `<a class="related-card" href="movie.html?id=${encodeURIComponent(m._id)}"><img src="${esc(safeImage(m.poster_url, PLACEHOLDER_CARD))}" alt="${esc(m.title)} poster" loading="lazy" onerror="this.src='assets/poster-placeholder.svg'"><span class="related-rating">${Number(m.vote_average) > 0 ? "&#9733; " + Number(m.vote_average).toFixed(1) + " / 10" : "Not rated"}</span><h3>${esc(m.title)}</h3><p>${esc(m.year || "")}</p></a>`).join("") || '<p>No other movies are available yet.</p>';
  } catch {
    target.innerHTML = '<p>More movies are unavailable right now. <a href="index.html">Browse the collection</a></p>';
  }
}

async function loadDetails() {
  const target = document.getElementById("movieDetail");
  if (!target) return;

  target.innerHTML = `<p class="text-muted">Loading movie details...</p>`;
  try {
    const movie = await resolveMovieReference();
    target.innerHTML = renderDetails(movie);
    document.title = movie.title + " | WebFlix";
    loadRelatedMovies(movie);
  } catch (e) {
    console.error(e);
    target.innerHTML = `<p class="text-danger">${esc(e.message || "Could not load details.")}</p><a href="index.html#catalog">Back to collection</a>`;
  }
}

const savedMovieIds = new Set();
let watchlistReady = false;

function updateWatchlistButton(button, movieId) {
  const saved = savedMovieIds.has(movieId);
  button.classList.toggle("active", saved);
  button.setAttribute("aria-pressed", String(saved));
  button.textContent = saved ? "Saved to watchlist" : "Save to watchlist";
  button.disabled = !!localStorage.getItem("token") && !watchlistReady;
  button.title = button.disabled ? "Refresh to retry loading your watchlist." : "";
}

async function loadSavedMovieIds() {
  savedMovieIds.clear();
  watchlistReady = false;
  const status = document.getElementById("watchlist-status");
  if (status) status.textContent = "";
  const token = localStorage.getItem("token");
  if (!token) { watchlistReady = true; return; }
  try {
    const response = await fetch(`${API_BASE}/api/watchlist`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(response.status === 401 ? "Your session expired. Log in again to save movies." : "Saved movies could not be loaded. Refresh to retry.");
    const movies = await response.json();
    movies.forEach(movie => savedMovieIds.add(movie.movie_id));
    watchlistReady = true;
  } catch (error) {
    if (status) status.textContent = error.message === "Failed to fetch" ? "Saved movies could not be loaded. Refresh to retry." : error.message;
  }
}

async function addToWatchlist(movieId, title, button) {
  const token = localStorage.getItem("token");
  if (!token) { alert("Please log in to save movies."); return; }
  if (button.disabled || !watchlistReady) return;
  const saved = savedMovieIds.has(movieId);
  button.disabled = true;
  button.textContent = saved ? "Removing..." : "Saving...";
  try {
    const response = await fetch(`${API_BASE}/api/watchlist/${saved ? "remove" : "add"}`, {
      method: saved ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ movie_id: movieId })
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(response.status === 401 ? "Your session expired. Log in again." : error.message || "Could not update your watchlist.");
    }
    if (saved) savedMovieIds.delete(movieId);
    else savedMovieIds.add(movieId);
  } catch (error) {
    alert(error.message);
  } finally {
    updateWatchlistButton(button, movieId);
  }
}

// ---------- INIT ----------

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("movies")) {
    hookSearch();
    loadMovies(1, "");
  }
  if (document.getElementById("movieDetail")) {
    loadDetails();
  }
});

