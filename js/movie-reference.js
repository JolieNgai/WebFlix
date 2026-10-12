// Shared by movie details and reviews, so old title bookmarks resolve only once.
let movieReferencePromise;
function resolveMovieReference() {
  if (!movieReferencePromise) {
    movieReferencePromise = (async () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      const title = params.get("t") || params.get("title");
      if (id && !/^[a-f0-9]{24}$/i.test(id)) throw new Error("Invalid movie link. Choose a movie from the collection.");
      if (!id && !title) throw new Error("Choose a movie from the collection.");
      const api = window.WEBFLIX_API_BASE ?? "https://inf2003-backend-161924392.asia-southeast1.run.app";
      const response = await fetch(api + (id ? "/api/movies/" + encodeURIComponent(id) : "/api/movies/by-title/" + encodeURIComponent(title)));
      const movie = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(movie.error || "Movie details are unavailable.");
      if (!/^[a-f0-9]{24}$/i.test(movie._id || "")) throw new Error("This movie does not have a stable identifier.");
      // Canonicalize old bookmarks without navigating or losing other query fields.
      const canonical = new URL(window.location.href);
      canonical.searchParams.set("id", movie._id);
      canonical.searchParams.delete("t");
      canonical.searchParams.delete("title");
      window.history.replaceState(null, "", canonical);
      return movie;
    })();
  }
  return movieReferencePromise;
}
