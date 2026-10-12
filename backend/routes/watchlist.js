import express from "express";
import { ObjectId } from "mongodb";

export default function watchlistRoutes(pgQuery, Movies, normalizeMovie) {
  const router = express.Router();
  const validId = value => typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);

  router.post("/add", async (req, res) => {
    const movieId = req.body?.movie_id;
    if (!validId(movieId)) return res.status(400).json({ message: "A valid movie_id is required." });
    try {
      const movie = await Movies.findOne({ _id: new ObjectId(movieId) }, { projection: { _id: 1 } });
      if (!movie) return res.status(404).json({ message: "This movie is no longer available." });
      await pgQuery(
        "INSERT INTO watchlist (user_id, movie_id) VALUES ($1, $2) ON CONFLICT (user_id, movie_id) DO NOTHING",
        [req.user.id, movie._id.toString()]
      );
      res.status(201).json({ message: "Added to watchlist" });
    } catch (error) {
      console.error("Add watchlist error:", error);
      res.status(500).json({ message: "Could not save this movie." });
    }
  });

  router.delete("/remove", async (req, res) => {
    const movieId = req.body?.movie_id;
    // Allow removal of old references even when their movie has been deleted.
    if (typeof movieId !== "string" || !movieId.trim() || movieId.length > 128) {
      return res.status(400).json({ message: "movie_id is required." });
    }
    try {
      await pgQuery("DELETE FROM watchlist WHERE user_id = $1 AND movie_id = $2", [req.user.id, movieId]);
      res.json({ message: "Removed from watchlist" });
    } catch (error) {
      console.error("Remove watchlist error:", error);
      res.status(500).json({ message: "Could not remove this movie." });
    }
  });

  router.get("/", async (req, res) => {
    try {
      const result = await pgQuery(
        "SELECT movie_id, created_at FROM watchlist WHERE user_id = $1 ORDER BY created_at DESC, w_id DESC",
        [req.user.id]
      );
      if (!result.rows.length) return res.json([]);
      const ids = result.rows.filter(row => validId(row.movie_id)).map(row => new ObjectId(row.movie_id));
      const documents = ids.length ? await Movies.find({ _id: { $in: ids } }).toArray() : [];
      const byId = new Map(documents.map(movie => [movie._id.toString(), movie]));
      res.json(result.rows.map(row => {
        const movie = byId.get(row.movie_id);
        return {
          ...(movie ? normalizeMovie(movie) : {
            title: "Movie no longer available", poster_url: null, year: null, genres: [], overview: ""
          }),
          _id: row.movie_id,
          movie_id: row.movie_id,
          saved_at: row.created_at,
          unavailable: !movie
        };
      }));
    } catch (error) {
      console.error("Load watchlist error:", error);
      res.status(500).json({ message: "Could not load your watchlist." });
    }
  });
  return router;
}
