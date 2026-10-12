// Local pages (including Live Server on another port) use the Docker API.
// Docker replaces this file with its same-origin configuration at build time.
(() => {
  const { hostname, protocol } = window.location;
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
  window.WEBFLIX_API_BASE = local || protocol === "file:"
    ? "http://127.0.0.1:5500"
    : "https://inf2003-backend-161924392.asia-southeast1.run.app";
})();
