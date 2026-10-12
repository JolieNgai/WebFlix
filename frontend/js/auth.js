document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = window.WEBFLIX_API_BASE ?? "https://inf2003-backend-161924392.asia-southeast1.run.app";

  const registerForm = document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");

  const loginPassword = document.getElementById("loginPassword");
  const loginToggle = document.getElementById("toggleLoginPassword");
  if (loginPassword && loginToggle) {
    loginToggle.addEventListener("click", () => {
      const reveal = loginPassword.type === "password";
      loginPassword.type = reveal ? "text" : "password";
      loginToggle.textContent = reveal ? "Hide" : "Show";
      loginToggle.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
      loginToggle.setAttribute("aria-pressed", String(reveal));
    });
  }

  // ===== Password show/hide (used on both pages) =====
  const passwordInput = document.getElementById("registerPassword");
  const togglePasswordBtn = document.getElementById("toggleRegisterPassword");

  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener("click", () => {
      const reveal = passwordInput.type === "password";
      togglePasswordBtn.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
      togglePasswordBtn.setAttribute("aria-pressed", String(reveal));
      if (passwordInput.type === "password") {
        passwordInput.type = "text";
        togglePasswordBtn.textContent = "Hide";
      } else {
        passwordInput.type = "password";
        togglePasswordBtn.textContent = "Show";
      }
    });
  }

  // ================== REGISTER ==================
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = {
      name: document.getElementById("registerName").value.trim(),
      email: document.getElementById("registerEmail").value.trim(),
      password: document.getElementById("registerPassword").value,
    };

    try {
      const res = await fetch(`${API_BASE}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      // parse response safely
      let text = await res.text();
      let result = {};
      try {
        result = text ? JSON.parse(text) : {};
      } catch {
        // not JSON, just keep result as {}
      }

      if (res.ok) {
        alert(result.message || "Registration successful! Please log in.");
        window.location.href = "login.html";
      } else {
        alert(result.error || text || "Registration failed.");
      }
    } catch (err) {
      console.error("Register error:", err);
      alert("Registration unavailable (backend offline).");
    }
  });
}


  // ================== LOGIN ==================
  if (loginForm) {
    // on your login page the password input is still id="registerPassword"
    const loginPasswordInput =
      document.getElementById("loginPassword") ||
      document.getElementById("registerPassword");

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const data = {
        email: document.getElementById("loginEmail").value.trim(),
        password: loginPasswordInput.value,
      };

      try {
        const res = await fetch(`${API_BASE}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        const result = await res.json();

        if (res.ok && result.token) {
          localStorage.setItem("token", result.token);
          localStorage.setItem("user_id", result.user_id);
          window.location.href = "index.html";
        } else {
          alert(result.error || "Invalid credentials.");
        }
      } catch (err) {
        console.error("Login error:", err);
        alert("Login unavailable (backend offline).");
      }
    });
  }
});
