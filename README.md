# WebFlix – INF2003 Movie Review Web App
WebFlix is a movie-catalog and review web application

- **Frontend**: Static HTML/CSS/JS (runs locally in your browser)
- **Backend**: Node.js + Express (**deployed on Google Cloud Run**)
- **Databases**:  
  - **MongoDB Atlas** – movie metadata (titles, posters, genres, etc.)  
  - **PostgreSQL (cloud)** – users and their reviews


## 1. System Overview
**User flow:**

1. User opens the frontend (`index.html`) in a browser (via Live Server or any static server).
2. Frontend JavaScript sends API calls to our deployed backend:

   ```text
   https://inf2003-backend-161924392.asia-southeast1.run.app


## 2. Project Structure
INF2003-Project/
├─ backend/
│  ├─ server.js                # Main Express server (movies + reviews APIs)
│  ├─ config/
│  │  ├─ postgres.js           # Postgres connection pool & helpers (pgQuery, pgHealth)
│  │  ├─ mongo_config.py       # (legacy helper)
│  │  └─ tmdb_config.py        # (legacy helper)
│  ├─ routes/
│  │  └─ authenticate.js       # /api/register & /api/login routes
│  ├─ services/
│  │  └─ user_services.js      # User registration/login logic (Postgres)
│  └─ scripts/
│     └─ init_pgdb.js          # Initialises Postgres tables from SQL script
│
├─ database/
│  └─ create_table.sql         # SQL schema for `users` and `reviews`
│
├─ css/
│  └─ style.css                # Custom styling
│
├─ js/
│  ├─ main.js                  # Navbar/footer loading, shared helpers
│  ├─ movies.js                # Fetch & display movie list + details
│  ├─ auth.js                  # Register & login frontend logic
│  ├─ watchlist.js             # Prototype (points to localhost:5000)
│  └─ admin.js                 # Prototype admin helpers (localhost endpoints)
│
├─ index.html                  # Movie catalog homepage
├─ movie.html                  # Single movie details + reviews
├─ login.html                  # Login form
├─ register.html               # Registration form
├─ profile.html                # (Layout placeholder, not fully implemented)
├─ watchlist.html              # Watchlist prototype (not wired to cloud backend)
├─ navbar.html                 # Shared navbar fragment
├─ footer.html                 # Shared footer fragment
│
├─ .env                        # Example environment file (for local dev only)
├─ package.json
├─ package-lock.json
└─ README.md                   # This file

## Overview

WebFlix allows users to:

- Browse a catalog of movies (from MongoDB Atlas).
- View detailed information for each movie.
- Register and log in as a user.
- Submit and view reviews stored in a cloud PostgreSQL database.

The project demonstrates full-stack web development concepts taught in **INF2003**:
- RESTful APIs
- Authentication (JWT)
- Integration of two different database technologies
- Deployment to a cloud platform (Google Cloud Run)

---

## Architecture

**High-level flow:**

1. User opens the frontend (`index.html`) via a simple static server (Live Server / Python HTTP server).
2. Frontend JavaScript sends HTTP requests to the deployed backend API:

   ```text
   https://inf2003-backend-161924392.asia-southeast1.run.app