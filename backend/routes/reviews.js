import express from "express";
import { ObjectId } from "mongodb";

export default function reviewRoutes(pgQuery, verifyToken, getMovies) {
  const router = express.Router();
  const fields = "r.r_id, r.user_id, r.movie_id, r.movie_title, r.rating, r.comment, r.created_at, r.updated_at, u.u_name AS author_name";
  const movieIdValid = value => typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);
  const reviewId = value => /^[1-9]\d*$/.test(value) && Number(value) <= 2147483647;
  const validContent = body => Number.isInteger(body?.rating) && body.rating >= 1 && body.rating <= 5 &&
    typeof body.comment === "string" && body.comment.trim().length > 0 && body.comment.trim().length <= 5000;

  router.get("/", async (req, res) => {
    const movieId = req.query.movieId;
    if (req.query.movieTitle !== undefined) return res.status(400).json({ message: "Filter reviews using movieId, not movieTitle." });
    if (movieId !== undefined && !movieIdValid(movieId)) return res.status(400).json({ message: "Invalid movie ID." });
    try {
      const result = await pgQuery(
        `SELECT ${fields} FROM reviews r LEFT JOIN users u ON u.u_id = r.user_id
         ${movieId ? "WHERE r.movie_id = $1" : ""}
         ORDER BY r.created_at DESC, r.r_id DESC`,
        movieId ? [new ObjectId(movieId).toString()] : []
      );
      const ids = [...new Set(result.rows.map(row => row.movie_id).filter(movieIdValid))];
      const Movies = getMovies();
      if (ids.length && !Movies) return res.status(503).json({ message: "Movie database is unavailable." });
      const movies = ids.length ? await Movies.find({ _id: { $in: ids.map(id => new ObjectId(id)) } }, { projection: { title: 1 } }).toArray() : [];
      const byId = new Map(movies.map(movie => [movie._id.toString(), movie]));
      res.json(result.rows.map(row => ({
        ...row,
        movie_title: byId.get(row.movie_id)?.title || row.movie_title,
        movie_unavailable: !!row.movie_id && !byId.has(row.movie_id)
      })));
    } catch (error) {
      console.error("Load reviews error:", error);
      res.status(500).json({ message: "Could not load reviews." });
    }
  });

  router.post("/", verifyToken, async (req, res) => {
    const body = req.body;
    if (!validContent(body) || !movieIdValid(body?.movieId)) {
      return res.status(400).json({ message: "Provide a valid movie ID, an integer rating from 1 to 5, and a comment of 1 to 5000 characters." });
    }
    try {
      const Movies = getMovies();
      if (!Movies) return res.status(503).json({ message: "Movie database is unavailable." });
      const movie = await Movies.findOne({ _id: new ObjectId(body.movieId) }, { projection: { title: 1 } });
      if (!movie) return res.status(404).json({ message: "Movie not found." });
      // Both ownership and movie identity come from validated references.
      const result = await pgQuery(
        `INSERT INTO reviews (user_id, movie_id, movie_title, rating, comment)
         VALUES ($1, $2, $3, $4, $5) RETURNING r_id, user_id, movie_id, movie_title, rating, comment, created_at, updated_at`,
        [req.user.id, movie._id.toString(), movie.title, body.rating, body.comment.trim()]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error.code === "23503") return res.status(401).json({ message: "Your account is no longer available. Log in again." });
      console.error("Create review error:", error);
      res.status(500).json({ message: "Could not save your review." });
    }
  });

  router.patch("/:id", verifyToken, async (req, res) => {
    if (!reviewId(req.params.id) || !validContent(req.body)) {
      return res.status(400).json({ message: "Provide a valid review ID, an integer rating from 1 to 5, and a comment of 1 to 5000 characters." });
    }
    try {
      const result = await pgQuery(
        `UPDATE reviews SET rating = $1, comment = $2, updated_at = NOW()
         WHERE r_id = $3 AND user_id = $4
         RETURNING r_id, user_id, movie_id, movie_title, rating, comment, created_at, updated_at`,
        [req.body.rating, req.body.comment.trim(), Number(req.params.id), req.user.id]
      );
      if (!result.rowCount) return res.status(404).json({ message: "Review not found or you do not own it." });
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Update review error:", error);
      res.status(500).json({ message: "Could not update your review." });
    }
  });

  router.delete("/:id", verifyToken, async (req, res) => {
    if (!reviewId(req.params.id)) return res.status(400).json({ message: "Invalid review ID." });
    try {
      const result = await pgQuery("DELETE FROM reviews WHERE r_id = $1 AND user_id = $2 RETURNING r_id", [Number(req.params.id), req.user.id]);
      if (!result.rowCount) return res.status(404).json({ message: "Review not found or you do not own it." });
      res.json({ message: "Review deleted." });
    } catch (error) {
      console.error("Delete review error:", error);
      res.status(500).json({ message: "Could not delete your review." });
    }
  });
  return router;
}
