import express from "express";
import { ObjectId } from "mongodb";

const router = express.Router();
console.log("HELLO IM HERE");

export default function watchlistRoutes(pgQuery, Movies, normalizeMovie) {
  // ADD to watchlist --------------------------------------------------------
  router.post("/add", async (req, res) => {
    try {
      const userId = req.user.id;           // from verifyToken
      const { movie_id } = req.body;

      if (!movie_id) {
        return res
          .status(400)
          .json({ message: "movie_id is required" });
      }

      await pgQuery(
        `INSERT INTO watchlist (user_id, movie_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, movie_id) DO NOTHING`,
        [userId, movie_id]
      );

      res.status(201).json({ message: "Added to watchlist" });
    } catch (err) {
      console.error("❌ add watchlist error:", err);
      res.status(500).json({ message: "Server error adding to watchlist" });
    }
  });

  // REMOVE from watchlist ---------------------------------------------------
  router.delete("/remove", async (req, res) => {
    try {
      const userId = req.user.id;
      const { movie_id } = req.body;

      if (!movie_id) {
        return res
          .status(400)
          .json({ message: "movie_id is required" });
      }

      await pgQuery(
        `DELETE FROM watchlist
         WHERE user_id = $1 AND movie_id = $2`,
        [userId, movie_id]
      );

      res.json({ message: "Removed from watchlist" });
    } catch (err) {
      console.error("❌ remove watchlist error:", err);
      res.status(500).json({ message: "Server error removing from watchlist" });
    }
  });

  // GET watchlist for logged-in user ---------------------------------------
  router.get("/", async (req, res) => {
  const userId = req.user.id;   // user_id from JWT

  try {
    // 1. Fetch all watchlist rows for this user
    const result = await pgQuery( `SELECT movie_id FROM watchlist WHERE user_id = $1`, [userId]);

    // 2. If no rows, return empty array
    if (result.rowCount === 0) {
      return res.json([]);
    }

    // 3. Extract the rows cleanly
    const movies = result.rows.map(row => ({
      movie_id: row.movie_id,
    }));

    // 4. Return the list
    return res.json(movies);

  } catch (err) {
    console.error("Error loading watchlist:", err);
    return res.status(500).json({ error: "Failed to load watchlist" });
  }
});

  return router;
}
