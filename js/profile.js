const API_BASE = window.WEBFLIX_API_BASE ?? "https://inf2003-backend-161924392.asia-southeast1.run.app";

document.addEventListener("DOMContentLoaded", () => {
  loadProfile();
  loadWatchlist();
});

function showWatchlistMessage(message, retry = false) {
  const container = document.getElementById("watchlist");
  const panel = document.createElement("div");
  panel.className = "col-12";
  const text = document.createElement("p");
  text.textContent = message;
  text.setAttribute("role", retry ? "alert" : "status");
  panel.append(text);
  if (retry) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-outline-secondary";
    button.textContent = "Try again";
    button.addEventListener("click", loadWatchlist);
    panel.append(button);
  }
  const token = localStorage.getItem("token");
  if (!token || message.includes("Log in again")) {
    const link = document.createElement("a");
    link.href = "login.html";
    link.className = "btn btn-primary";
    link.textContent = "Log in";
    panel.append(link);
  }
  container.replaceChildren(panel);
}

async function loadProfile() {
  const token = localStorage.getItem("token");
  const name = document.getElementById("profile-name");
  const email = document.getElementById("profile-email");
  if (!token) {
    name.textContent = "Log in to view your profile";
    email.textContent = "-";
    return;
  }
  try {
    const response = await fetch(`${API_BASE}/api/user/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(response.status === 401 ? "Log in again to view your profile." : "Profile unavailable.");
    const user = await response.json();
    name.textContent = user.name;
    email.textContent = user.email;
  } catch (error) {
    name.textContent = error.message;
    email.textContent = "-";
  }
}

function renderWatchlistCard(movie) {
  const column = document.createElement("div");
  column.className = "col-12 col-sm-6 col-md-4 col-lg-3 mb-4";
  const card = document.createElement("article");
  card.className = "card h-100";
  const image = document.createElement("img");
  image.className = "card-img-top";
  image.alt = movie.title + " poster";
  image.loading = "lazy";
  let poster = "assets/poster-placeholder.svg";
  try {
    const url = new URL(movie.poster_url);
    if (["http:", "https:"].includes(url.protocol)) poster = url.href;
  } catch {}
  image.src = poster;
  image.addEventListener("error", () => { image.src = "assets/poster-placeholder.svg"; }, { once: true });
  const body = document.createElement("div");
  body.className = "card-body d-flex flex-column";
  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = movie.title;
  const metadata = document.createElement("p");
  metadata.className = "small text-muted";
  metadata.textContent = [movie.year, (movie.genres || []).join(", ")].filter(Boolean).join(" / ");
  body.append(title, metadata);
  if (!movie.unavailable) {
    const details = document.createElement("a");
    details.href = "movie.html?t=" + encodeURIComponent(movie.title);
    details.className = "btn btn-outline-secondary mb-2";
    details.textContent = "View movie";
    body.append(details);
  } else {
    metadata.textContent = "You can remove this saved entry.";
  }
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "btn btn-danger mt-auto";
  remove.textContent = "Remove";
  remove.setAttribute("aria-label", "Remove " + movie.title + " from your watchlist");
  remove.addEventListener("click", () => removeFromWatchlist(movie.movie_id, remove));
  body.append(remove);
  card.append(image, body);
  column.append(card);
  return column;
}

async function loadWatchlist() {
  const token = localStorage.getItem("token");
  if (!token) return showWatchlistMessage("Log in to view your watchlist.");
  showWatchlistMessage("Loading your watchlist...");
  try {
    const response = await fetch(`${API_BASE}/api/watchlist`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(response.status === 401 ? "Log in again to view your watchlist." : "Your watchlist could not be loaded.");
    const movies = await response.json();
    if (!movies.length) {
      showWatchlistMessage("Your watchlist is empty. Save a movie from the collection to get started.");
      const link = document.createElement("a");
      link.href = "index.html#catalog";
      link.textContent = "Explore movies";
      link.className = "btn btn-primary";
      document.getElementById("watchlist").firstElementChild.append(link);
      return;
    }
    document.getElementById("watchlist").replaceChildren(...movies.map(renderWatchlistCard));
  } catch (error) {
    showWatchlistMessage(error.message === "Failed to fetch" ? "Your watchlist could not be loaded. Check that the server is running." : error.message, true);
  }
}

async function removeFromWatchlist(movieId, button) {
  if (button.disabled) return;
  button.disabled = true;
  button.textContent = "Removing...";
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE}/api/watchlist/remove`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ movie_id: movieId })
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(response.status === 401 ? "Your session expired. Log in again." : error.message || "Could not remove this movie.");
    }
    await loadWatchlist();
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Remove";
  }
}
