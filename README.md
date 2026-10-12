# WebFlix

WebFlix is an INF2003 movie catalog and review web application built with HTML, CSS, JavaScript, and an Express API. MongoDB stores movie metadata; PostgreSQL stores users, reviews, and watchlists.

## Features

- Browse and search movies with pagination.
- View movie details, posters, genres, and ratings.
- Register and log in with bcrypt password hashing and JWT authentication.
- Read and submit reviews with ratings from 1 to 5.
- View a profile and add or remove movies from a personal watchlist.

Watchlists are linked to your account. Saved movie details appear on your profile, and save buttons reflect your persisted watchlist after refreshing. Entries whose movies were removed can still be deleted from your watchlist.

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | HTML, CSS, JavaScript, Bootstrap 5 |
| Backend | Node.js, Express 5 |
| Databases | MongoDB, PostgreSQL |
| Authentication | JWT, bcrypt |
| Development | npm, nodemon |

## Run everything with Docker (recommended for local development)

This runs the frontend, Express API, MongoDB, and PostgreSQL on your computer.
It does not depend on the existing cloud databases or migrate their data.

1. Install Docker Desktop and start it using Linux containers.
2. From the project root, run:

```sh
docker compose up --build -d
```

3. Open **http://127.0.0.1:5500**.
4. Check **http://127.0.0.1:5500/health**; expect `{"ok":1,"mongo":1,"postgres":1}`.

No local Node.js, Python, PostgreSQL, or MongoDB installation is needed.
The first build downloads images and dependencies and may take several minutes.
Stop Live Server first if it already uses port 5500.

Compose waits for the databases to become healthy, runs the PostgreSQL schema
initializer, and inserts six original fictional movie fixtures if MongoDB is empty.
The sample movies use placeholder posters and are intended only for development.
Existing movie data is left intact. Cloud movie data, users, and reviews are not copied.

The frontend is served by nginx, which forwards `/api/` and `/health` to the backend.
Docker supplies a same-origin API configuration automatically, so you do not need
to change frontend URLs. The database ports are not published to your computer.

### Everyday commands

```sh
# Check container status
docker compose ps

# Follow application and setup logs
docker compose logs -f backend setup

# Stop containers; database volumes remain
docker compose down

# Start again
docker compose up -d

# Rebuild after code changes
docker compose up --build -d
```

MongoDB and PostgreSQL data live in named Docker volumes and survive stopping
or recreating containers. `docker compose down -v` deletes those volumes and all
local accounts, reviews, watchlists, and movies; only use it for an intentional reset.

### Optional local configuration

Compose uses development defaults. To customize them, add these variables to
the root `.env` file before the first start:

```dotenv
WEBFLIX_POSTGRES_PASSWORD=your-local-database-password
WEBFLIX_JWT_SECRET=your-long-random-secret
```

Use these exact names; Compose does not use your cloud `DATABASE_URL` or
`MONGODB_URI`. Changing the PostgreSQL password in `.env` after a database volume
already exists does not change the stored database password.

Docker is a local development setup, not online hosting. Your laptop and Docker
must be running to use it. To make the application publicly available, deploy
the containers to a host and configure production credentials, TLS, and database access.

### Docker troubleshooting

- **Cannot connect to the Docker engine:** start Docker Desktop and wait until the Linux engine is ready.
- **Port 5500 is already allocated:** stop Live Server or change the host port in `compose.yaml`.
- **`localhost:5500` loads a page but movies fail:** a separate IPv6 server may be using that address. Open `http://127.0.0.1:5500` to reach Docker directly. Local API configuration also uses this explicit IPv4 address.
- **Setup or backend is unhealthy:** inspect `docker compose logs setup backend mongo postgres`.
- **Old code is showing:** rebuild with `docker compose up --build -d` and refresh the browser.
- **Movie fixtures are missing:** the seed intentionally skips nonempty collections; inspect the `setup` logs.
- **Using Live Server instead of Docker:** local pages use `js/config.js`, which connects to the Docker API at port 5500. Keep Docker running.

## Run the frontend

Local pages connect to Docker at port 5500 by default. For the cloud API, set `window.WEBFLIX_API_BASE` in `js/config.js` to this address:

```text
https://inf2003-backend-161924392.asia-southeast1.run.app
```

To use the configured API, open the project in VS Code and use **Open with Live Server** on `index.html` if the Live Server extension is installed.

Alternatively, with Python 3 installed, run this from the project root:

```sh
python -m http.server 5500
```

Open **http://localhost:5500**. On Windows, use `py -m http.server 5500` if `python` is unavailable.

An HTTP server is needed because the frontend fetches shared navbar and footer files. Backend dependencies are not required for this option. Docker must be running for the default local API, or the configured cloud API must be available for data and login to work; Bootstrap and movie images also require internet access.

## Run the backend locally

### 1. Prerequisites

- Node.js 22 or newer and npm for the environment-loading commands below.
- A reachable MongoDB instance with movie data.
- An existing PostgreSQL database with SSL enabled; the backend always enables SSL.
- A static HTTP server for the frontend.

Run all commands from the project root.

### 2. Install dependencies

```sh
npm ci
```

### 3. Configure the environment

Create `.env` in the project root with your own credentials:

```dotenv
PORT=8080
MONGODB_URI=mongodb://127.0.0.1:27017
DB_NAME=inf2003_db
DATABASE_URL=postgresql://USERNAME:PASSWORD@HOST:5432/DATABASE
JWT_SECRET=replace-with-a-long-random-secret
```

| Variable | Purpose |
| --- | --- |
| `PORT` | API port; defaults to `8080`. |
| `MONGODB_URI` | MongoDB connection string; `MONGO_URI` is also accepted as a fallback. |
| `DB_NAME` | MongoDB database name; defaults to `inf2003_db`. |
| `DATABASE_URL` | PostgreSQL connection string. URL-encode special characters in credentials. |
| `JWT_SECRET` | Secret for signing and verifying login tokens. |

Always set your own MongoDB URI. Keep credentials out of source control; `.env` and `postgre.env` are ignored by this repository.

### 4. Prepare the databases

Create the PostgreSQL database named in `DATABASE_URL` first, then initialize its tables:

```sh
node --env-file=.env --run=db:init
```

This executes `database/create_table.sql`, creating `users`, `reviews`, and `watchlist` tables if they do not already exist.

The initializer normally reads `postgre.env`, while the server reads `.env`. The command above explicitly loads `.env` so both use the same connection string. The initializer uses the connection string's SSL settings; include your provider's required SSL options in `DATABASE_URL`.

In MongoDB, create a `movies_metadata` collection in the database specified by `DB_NAME` and populate it with movie documents. The catalog expects fields such as `title`, `release_date`, `vote_average`, `overview`, `genres`, and `poster_path`. The Docker setup includes a fictional demo seed; no real movie-data import is included. The Python configuration files, Python requirements file, and JSON backup in this checkout are empty.

### 5. Start the API

Development mode with automatic restart:

```sh
node --env-file=.env --run=dev
```

Normal start:

```sh
node --env-file=.env --run=start
```

Loading the environment before startup ensures the PostgreSQL pool receives its settings before imported modules initialize. If variables are already set in your shell or deployment environment, use `npm run dev` or `npm start` directly.

### 6. Connect the frontend

For a non-Docker local backend, change `js/config.js` to your local API address.

For the default port:

```js
window.WEBFLIX_API_BASE = "http://localhost:8080";
```

Start the frontend HTTP server in a separate terminal and open **http://localhost:5500**. Express serves the API only; it does not serve the frontend pages.

## Verify the setup

Open **http://localhost:8080/health**. When both databases are connected, expect:

```json
{ "ok": 1, "mongo": 1, "postgres": 1 }
```

Browse the catalog, search for a movie, register an account, log in, and submit a review. A healthy but empty MongoDB collection produces an empty catalog.

## npm scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the API with nodemon. |
| `npm start` | Start the API with Node.js. |
| `npm run db:init` | Initialize PostgreSQL tables; reads `postgre.env` by default. |
| `npm test` | Placeholder that exits with an error; no automated test suite is configured. |

For local environment loading, use the `node --env-file=.env --run=...` commands above.

## API overview

Paths are relative to the API base URL.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | Check database connectivity. |
| GET | `/api/movies` | List movies; accepts `page`, `limit`, `q`, and `minRating`. |
| GET | `/api/movies/by-title/:title` | Get a movie by its URL-encoded title. |
| GET | `/api/reviews` | List reviews; optionally filter by `movieTitle`. |
| POST | `/api/reviews` | Submit `movieTitle`, `rating`, and `comment`. |
| POST | `/api/register` | Register with `name`, `email`, and `password`. |
| POST | `/api/login` | Log in with `email` and `password`. |
| GET | `/api/user/me` | Get the authenticated user's profile. |
| GET | `/api/watchlist` | Get the authenticated user's saved movie details and IDs. |
| POST | `/api/watchlist/add` | Save a movie using `movie_id`. |
| DELETE | `/api/watchlist/remove` | Remove a movie using `movie_id`. |

Profile and watchlist endpoints require `Authorization: Bearer <token>`. Login tokens expire after one hour. The current review endpoints do not require authentication.

## Project structure

```text
WebFlix/
  backend/
    server.js                 # Express API and MongoDB connection
    config/postgres.js        # PostgreSQL connection pool
    config/*.py               # Empty legacy configuration files
    routes/authenticate.js    # Registration, login, and profile
    routes/watchlist.js       # Authenticated watchlist routes
    services/user_services.js # User queries and password hashing
    scripts/init_pgdb.js      # PostgreSQL schema initializer
  database/
    create_table.sql          # Users, reviews, and watchlist schema
    tmdb_raw_data.json        # Empty movie-data backup placeholder
  css/style.css               # Shared styling
  js/
    main.js                   # Shared navbar and footer
    movies.js                 # Catalog, details, reviews, watchlist actions
    auth.js                   # Registration and login UI
    profile.js                # Profile and watchlist UI
  index.html                  # Movie catalog
  movie.html                  # Movie details and reviews
  login.html
  register.html
  profile.html
  navbar.html
  footer.html
  compose.yaml                # Local frontend, API, and databases
  Dockerfile                  # Backend image
  docker/                     # nginx frontend image and configuration
  package.json
  package-lock.json
  README.md
```

## Troubleshooting

- **Frontend still uses cloud data:** update `js/config.js` for non-Docker runs and refresh the browser. Docker configures the API automatically.
- **MongoDB connection fails:** check the URI, credentials, and network access rules. Movie routes require a connection; watchlist routes are registered only after MongoDB initialization succeeds.
- **PostgreSQL connection fails:** check `DATABASE_URL`, SSL support, and network access. Use the explicit environment-loading command above.
- **Tables do not exist:** initialize the same database used by the server.
- **Profile or watchlist returns 401:** log in again; the token may have expired.
- **Navbar or footer fails to load:** serve the frontend over HTTP.

## Contributing

Keep changes focused, describe how to run and verify them, and update this README when setup or API behavior changes. Never commit database passwords or JWT secrets.

## License

`package.json` declares ISC. No standalone license file is currently included.


## Watchlist verification

Run the frontend state and profile rendering tests with Node.js:

```sh
node --test tests/watchlist-ui.test.mjs
```

With Docker running, test the API against both databases:

```sh
docker compose exec -T backend node --test backend/tests/watchlist.test.js
```

The integration test creates temporary accounts and one movie, then removes them.
It checks saved movie details, duplicate saves, account isolation, malformed IDs,
and removal of references to deleted movies.
