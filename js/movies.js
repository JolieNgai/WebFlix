const API_BASE = "https://inf2003-backend-161924392.asia-southeast1.run.app";
const PLACEHOLDER_CARD = "https://via.placeholder.com/300x450?text=No+Poster";
const PLACEHOLDER_DETAIL = "https://via.placeholder.com/500x750?text=No+Poster";

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
      <img src="${img}" class="card-img-top" alt="${esc(m.title)}">
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
        <a class="btn btn-primary mt-auto" href="movie.html?t=${encodeURIComponent(
          m.title
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
    const url = new URL(`${API_BASE}/api/movies`);
    url.searchParams.set("limit", 24);
    url.searchParams.set("page", page);
    // only movies with rating > 0
    url.searchParams.set("minRating", 0);
    if (q) url.searchParams.set("q", q);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const docs = data.documents || [];

    list.innerHTML =
      docs.map(renderCard).join("") ||
      `<p class="text-muted">No results.</p>`;

      document.querySelectorAll(".bookmark-btn").forEach(btn => {
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

function renderDetails(m) {
  const img = m.poster_url || PLACEHOLDER_DETAIL;
  const year = m.year ? `(${m.year})` : "";
  const genres = formatList(m.genres) || "—";
  const languages = formatList(m.spoken_languages) || "—";
  const companies = formatList(m.production_companies) || "—";
  const countries = formatList(m.production_countries) || "—";
  const runtime = formatRuntime(m.runtime);

  const ratingValue = Number(m.vote_average);
  const ratingText =
    Number.isFinite(ratingValue) && ratingValue > 0
      ? `${ratingValue.toFixed(1)} / 10${
          m.vote_count ? ` (${m.vote_count} votes)` : ""
        }`
      : "Not rated yet";

  const budget = formatCurrency(m.budget);
  const revenue = formatCurrency(m.revenue);
  const profit =
    m.budget && m.revenue
      ? formatCurrency(Number(m.revenue) - Number(m.budget))
      : "";
  const release = m.release_date || "—";
  const popularity =
    m.popularity != null ? String(m.popularity) : "—";
  const language = m.original_language || "—";
  const collectionName = m.collection && m.collection.name;
  const homepage = m.homepage;
  const imdb = m.imdb_id
    ? `https://www.imdb.com/title/${encodeURIComponent(m.imdb_id)}`
    : null;

  const taglineHtml = m.tagline
    ? `<p class="text-muted fst-italic mb-2">${esc(m.tagline)}</p>`
    : "";
  const overviewHtml = m.overview
    ? `<p class="mb-3">${esc(m.overview)}</p>`
    : "";

  let linksHtml = "";
  if (homepage || imdb) {
    const parts = [];
    if (homepage) {
      parts.push(
        `<a href="${homepage}" target="_blank" rel="noopener">Official site</a>`
      );
    }
    if (imdb) {
      parts.push(
        `<a href="${imdb}" target="_blank" rel="noopener">IMDb</a>`
      );
    }
    linksHtml = parts.join(" • ");
  }

  return `
    <div class="card shadow-sm">
      <div class="row g-0">
        <div class="col-md-4">
          <img src="${img}" class="img-fluid rounded-start w-100" alt="${esc(
            m.title
          )}">
        </div>
        <div class="col-md-8">
          <div class="card-body">
            <h2 class="card-title" id="movie-title">${esc(m.title)} ${year}</h2>
            ${taglineHtml}
            ${overviewHtml}

            <dl class="row mb-0">
              <dt class="col-sm-4">Release date</dt><dd class="col-sm-8">${esc(
                release
              )}</dd>
              <dt class="col-sm-4">Runtime</dt><dd class="col-sm-8">${esc(
                runtime
              )}</dd>
              <dt class="col-sm-4">Genres</dt><dd class="col-sm-8">${esc(
                genres
              )}</dd>
              <dt class="col-sm-4">Spoken languages</dt><dd class="col-sm-8">${esc(
                languages
              )}</dd>
              <dt class="col-sm-4">Production companies</dt><dd class="col-sm-8">${esc(
                companies
              )}</dd>
              <dt class="col-sm-4">Production countries</dt><dd class="col-sm-8">${esc(
                countries
              )}</dd>
              <dt class="col-sm-4">Status</dt><dd class="col-sm-8">${esc(
                m.status || "—"
              )}</dd>
              <dt class="col-sm-4">Original language</dt><dd class="col-sm-8">${esc(
                language
              )}</dd>
              <dt class="col-sm-4">Popularity</dt><dd class="col-sm-8">${esc(
                popularity
              )}</dd>
              <dt class="col-sm-4">Rating</dt><dd class="col-sm-8">${esc(
                ratingText
              )}</dd>
              <dt class="col-sm-4">Budget</dt><dd class="col-sm-8">${esc(
                budget
              )}</dd>
              <dt class="col-sm-4">Revenue</dt><dd class="col-sm-8">${esc(
                revenue
              )}</dd>
              ${
                profit
                  ? `<dt class="col-sm-4">Approx. profit</dt><dd class="col-sm-8">${esc(
                      profit
                    )}</dd>`
                  : ""
              }
              ${
                collectionName
                  ? `<dt class="col-sm-4">Collection</dt><dd class="col-sm-8">${esc(
                      collectionName
                    )}</dd>`
                  : ""
              }
              ${
                linksHtml
                  ? `<dt class="col-sm-4">Links</dt><dd class="col-sm-8">${linksHtml}</dd>`
                  : ""
              }
            </dl>

            <a href="index.html" class="btn btn-outline-secondary mt-3">
              &larr; Back to catalog
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function loadDetails() {
  const target = document.getElementById("movieDetail");
  if (!target) return;

  const params = new URLSearchParams(location.search);
  const titleParam = params.get("t") || params.get("title");
  if (!titleParam) {
    target.innerHTML = `<p class="text-danger">Missing movie title.</p>`;
    return;
  }

  target.innerHTML = `<p class="text-muted">Loading movie details…</p>`;

  try {
    const res = await fetch(
      `${API_BASE}/api/movies/by-title/${encodeURIComponent(titleParam)}`
    );
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const movie = await res.json();
    target.innerHTML = renderDetails(movie);
  } catch (e) {
    console.error(e);
    target.innerHTML = `<p class="text-danger">Could not load details.</p>`;
  }
}

// ---------- REVIEWS ----------

function getMovieTitleFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("t") || params.get("title") || "";
}

async function loadReviews() {
  const movieTitle = getMovieTitleFromUrl();
  if (!movieTitle) return;

  try {
    const res = await fetch(
      `${API_BASE}/api/reviews?movieTitle=${encodeURIComponent(movieTitle)}`
    );
    if (!res.ok) throw new Error("Failed to fetch reviews");

    const reviews = await res.json();
    const list = document.getElementById("reviews-list");
    if (!list) return;

    list.innerHTML = "";

    if (!reviews.length) {
      list.innerHTML = "<li>No reviews yet. Be the first to review!</li>";
      return;
    }

    reviews.forEach((r) => {
      const li = document.createElement("li");
      li.textContent = `${r.rating}/5 – ${r.comment}`;
      list.appendChild(li);
    });
  } catch (err) {
    console.error(err);
  }
}

function hookReviewForm() {
  const form = document.getElementById("reviewForm");
  if (!form) return;

  const movieTitle = getMovieTitleFromUrl();
  const hidden = document.getElementById("movieIdInput");
  if (hidden) hidden.value = movieTitle;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const rating = Number(document.getElementById("rating").value);
    const comment = document.getElementById("comment").value.trim();

    if (!rating || !comment) {
      alert("Please select a rating and enter a comment.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieTitle, rating, comment }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert("Error submitting review: " + (err.message || res.statusText));
        return;
      }

      alert("Review submitted!");
      form.reset();
      await loadReviews(); // refresh list
    } catch (err) {
      console.error("Review submit failed:", err);
      alert("Network error submitting review.");
    }
  });
}

async function addToWatchlist(movieId, title, btn) {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Please log in to bookmark movies.");
    return;
  }

  // Toggle UI
  const active = btn.classList.toggle("active");

  if (active) {
    btn.style.backgroundColor = "#ffccd5";
    btn.style.borderColor = "#ff99aa";
    btn.textContent = "💖 Bookmarked";

    // Call backend
    await fetch(`${API_BASE}/api/watchlist/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ movie_id: movieId })
    });

  } else {
    btn.style.backgroundColor = "";
    btn.style.borderColor = "";
    btn.textContent = "❤️ Bookmark";

    await fetch(`${API_BASE}/api/watchlist/remove`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ movie_id: movieId })
    });
  }
}



// ---------- INIT ----------

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("movies")) {
    hookSearch();
    loadMovies(1, "");
  }
  if (document.getElementById("movieDetail")) {
    loadDetails().then(loadReviews); // show reviews for this movie
  }
  if (document.getElementById("reviewForm")) {
    hookReviewForm();
  }
});

