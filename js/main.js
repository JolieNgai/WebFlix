// ===============================
// WebFlix main.js (layout + nav/footer)
// ===============================

// --------- Navbar Loader (with fallback) ---------
async function loadNavbar() {
  const navPlaceholder = document.getElementById('navbar-placeholder');
  if (!navPlaceholder) return;

  try {
    const res = await fetch('navbar.html');
    navPlaceholder.innerHTML = await res.text();
    // Handle login/logout display
    const token = localStorage.getItem("token");
    const guestLinks = document.querySelectorAll(".auth-guest");
    const userLinks = document.querySelectorAll(".auth-user");

    if (token) {
      guestLinks.forEach(el => el.style.display = "none");
      userLinks.forEach(el => el.style.display = "block");
    } else {
      guestLinks.forEach(el => el.style.display = "block");
      userLinks.forEach(el => el.style.display = "none");
    }

    // Logout handler
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user_id");
        window.location.href = "login.html";
      });
    }

  } catch (err) {
    console.warn('Navbar fetch failed; using inline fallback.');
    navPlaceholder.innerHTML = `
      <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <div class="container">
          <a class="navbar-brand" href="index.html">WebFlix</a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav ms-auto">
              <li class="nav-item"><a class="nav-link" href="index.html">Catalog</a></li>
              <li class="nav-item"><a class="nav-link" href="login.html">Log in</a></li>
              <li class="nav-item"><a class="nav-link" href="register.html">Register</a></li>
              <li class="nav-item"><a class="nav-link" href="profile.html">Profile/Watchlist</a></li>
            </ul>
          </div>
        </div>
      </nav>`;
  }

  // Highlight current page
  const links = document.querySelectorAll('.navbar-nav .nav-link');
  const current = window.location.pathname.split('/').pop();
  links.forEach(link => {
    if (link.getAttribute('href') === current) link.classList.add('active');
  });
}

// --------- Footer Loader ---------
async function loadFooter() {
  const footerPlaceholder = document.getElementById('footer-placeholder');
  if (!footerPlaceholder) return;

  try {
    const res = await fetch('footer.html');
    footerPlaceholder.innerHTML = await res.text();
  } catch (err) {
    console.warn('Footer fetch failed; using inline fallback.');
    footerPlaceholder.innerHTML = `
      <footer class="bg-dark text-white py-4 mt-5">
        <div class="container text-center">
          <p>&copy; 2025 WebFlix. All rights reserved.</p>
          <p>
            <a href="index.html" class="text-white text-decoration-none me-3">Home</a>
            <a href="login.html" class="text-white text-decoration-none me-3">Login</a>
            <a href="register.html" class="text-white text-decoration-none me-3">Register</a>
            <a href="profile.html" class="text-white text-decoration-none">Profile</a>
          </p>
        </div>
      </footer>`;
  }
}

// --------- Page Initialization ---------
document.addEventListener('DOMContentLoaded', () => {
  loadNavbar();
  loadFooter();
});
