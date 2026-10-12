const API_BASE = window.WEBFLIX_API_BASE ?? "https://inf2003-backend-161924392.asia-southeast1.run.app";

document.addEventListener("DOMContentLoaded", () => {
  loadProfile();
  loadWatchlist();
});

// =============================
// 1. LOAD USER PROFILE
// =============================
async function loadProfile() {
  const token = localStorage.getItem("token");
  if (!token) return;

  const res = await fetch(`${API_BASE}/api/user/me`, {
    headers: { "Authorization": `Bearer ${token}` }
  });

  if (!res.ok) {
    console.error("failed to load profile");
    
    return;
  }

  const user = await res.json();

  document.getElementById("profile-name").textContent = user.name;
  document.getElementById("profile-email").textContent = user.email;
}

// =============================
// 2. LOAD WATCHLIST
// =============================
async function loadWatchlist() {
//   console.log("hello debugger");
  const token = localStorage.getItem("token");
  if (!token) return;

  const res = await fetch(`${API_BASE}/api/watchlist`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    console.error("failed to load profile");
    return;
  }
  
  const movies = await res.json();
  console.log(movies);
  
  
  const container = document.getElementById("watchlist");
  container.innerHTML = "";

  if (!movies.length) {
    container.innerHTML = `<p class="text-muted">No movies in watchlist yet.</p>`;
    return;
  }

  movies.forEach(m => {
    container.innerHTML += `
    <div class="col-md-3 mb-3">
      <div class="card h-100">
        <img src="${m.poster_url || 'https://via.placeholder.com/300'}" class="card-img-top" alt="${m.title}">
        <div class="card-body">
          <h5 class="card-title">${m.title}</h5>
          <button class="btn btn-danger btn-sm" onclick="removeFromWatchlist('${m.movie_id}')">Remove</button>
        </div>
      </div>
    </div>
    `;
  });
}

// =============================
// 3. REMOVE FROM WATCHLIST
// =============================
async function removeFromWatchlist(movie_id) {
  const token = localStorage.getItem("token");
  if (!token) return;

  await fetch(`${API_BASE}/api/watchlist/remove`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ movie_id }),
  });

  loadWatchlist();
}