# WebFlix

WebFlix is an INF2003 movie catalog and review web application built with HTML, CSS, JavaScript, and an Express API. MongoDB stores movie metadata; PostgreSQL stores users, reviews, and watchlists.

## Features

- Browse and search movies with pagination.
- View movie details, posters, genres, and ratings.
- Register and log in with bcrypt password hashing and JWT authentication.
- Read reviews publicly; log in to post ratings from 1 to 5 and edit or delete your own reviews.
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
2. Generate private local credentials once, then start the containers from the project root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-docker.ps1
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

Compose requires credentials in the root `.env` file. The setup script generates
random values and preserves existing values. To configure them manually, supply:

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
- **Using Live Server instead of Docker:** local pages use `frontend/js/config.js`, which connects to the Docker API at port 5500. Keep Docker running.

## Run the frontend

Local pages connect to Docker at port 5500 by default. To use a deployed API,
set `window.WEBFLIX_API_BASE` in `frontend/js/config.js` to its public HTTPS URL.

To use the configured API, open the project in VS Code and use **Open with Live Server** on `frontend/index.html` if the Live Server extension is installed.

Alternatively, with Python 3 installed, run this from the project root:

```sh
python -m http.server 5501 --directory frontend
```

Open **http://localhost:5501**. On Windows, use `py -m http.server 5501 --directory frontend` if `python` is unavailable.

An HTTP server is needed because the frontend fetches shared navbar and footer files. Backend dependencies are not required for this option. Docker must be running for the default local API, or the configured cloud API must be available for data and login to work; Bootstrap and movie images also require internet access.

## Run the backend locally

### 1. Prerequisites

- Node.js 22 or newer and npm.
- A reachable MongoDB instance with movie data.
- A reachable PostgreSQL database (SSL enabled by default; disable it only for local development).
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
| `JWT_SECRET` | Secret for signing and verifying login tokens; at least 32 characters. |
| `PGSSL` | SSL enabled by default; set `false` only for local development PostgreSQL. |

Always set your own MongoDB URI. Keep credentials out of source control; `.env` and legacy `postgre.env` are ignored by this repository. Runtime and initialization now both read only the root `.env` file; move any legacy values from `postgre.env` into `.env`.

### 4. Prepare the databases

Create the PostgreSQL database named in `DATABASE_URL` first, then initialize its tables:

```sh
npm run db:init
```

This executes `database/create_table.sql`, creating `users`, `reviews`, and `watchlist` tables if they do not already exist.

The initializer and server share the same PostgreSQL options and load the same root `.env` file. Shell or deployment variables take precedence. SSL certificate verification is enabled by default; Compose explicitly sets `PGSSL=false` for its isolated local PostgreSQL network.

In MongoDB, create a `movies_metadata` collection in the database specified by `DB_NAME` and populate it with movie documents. The catalog expects fields such as `title`, `release_date`, `vote_average`, `overview`, `genres`, and `poster_path`. The Docker setup includes a fictional demo seed; no real movie-data import is included. The Python configuration files, Python requirements file, and JSON backup in this checkout are empty.

### 5. Start the API

Development mode with automatic restart:

```sh
npm run dev
```

Normal start:

```sh
npm start
```

All entry points automatically load the root `.env`; existing shell variables take precedence.

### 6. Connect the frontend

For a non-Docker local backend, change `frontend/js/config.js` to your local API address.

For the default port:

```js
window.WEBFLIX_API_BASE = "http://localhost:8080";
```

Start the frontend HTTP server in a separate terminal and open **http://localhost:5501**. Express serves the API only; it does not serve the frontend pages.

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
| `npm run db:init` | Initialize PostgreSQL tables using the same configuration as the server. |
| `npm test` | Run frontend behavior tests; no databases required. |
| `npm run test:integration` | Run backend tests against configured databases and a running API. |
| `npm run db:migrate` | Migrate unambiguous legacy title references to stable movie IDs. |

All backend commands load the root `.env` automatically.

## API overview

Paths are relative to the API base URL.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | Check database connectivity. |
| GET | `/api/movies` | List movies; accepts `page`, `limit`, `q`, and `minRating`. |
| GET | `/api/movies/:id` | Get a movie by its stable MongoDB ObjectId. |
| GET | `/api/movies/by-title/:title` | Resolve an old title link; duplicate titles return 409. |
| GET | `/api/reviews` | List reviews; optionally filter by `movieId`. |
| POST | `/api/reviews` | Authenticated: submit `movieId`, `rating`, and `comment`. |
| PATCH | `/api/reviews/:id` | Owner only: update `rating` and `comment`. |
| DELETE | `/api/reviews/:id` | Owner only: delete a review. |
| POST | `/api/register` | Register with `name`, `email`, and `password`. |
| POST | `/api/login` | Log in with `email` and `password`. |
| GET | `/api/user/me` | Get the authenticated user's profile. |
| GET | `/api/watchlist` | Get the authenticated user's saved movie details and IDs. |
| POST | `/api/watchlist/add` | Save a movie using `movie_id`. |
| DELETE | `/api/watchlist/remove` | Remove a movie using `movie_id`. |

Profile and watchlist endpoints require `Authorization: Bearer <token>`. Login tokens expire after one hour. Review creation, editing, and deletion require a token. Reading reviews remains public. Ownership comes from the authenticated account, never the request body.

## Project structure

```text
WebFlix/
  frontend/                  # Static site; serve this directory over HTTP
    *.html                   # Pages and shared navbar/footer
    assets/                  # Images and placeholders
    css/style.css            # Shared styles
    js/                      # API configuration and page behavior
  backend/
    server.js                # Express entry point
    config/                  # Environment loading and database connections
    routes/                  # Authentication, reviews, watchlist handlers
    services/                # User queries and password hashing
    scripts/                 # Schema initialization, seed, ID migration
    tests/                   # API/database integration tests
  database/                  # PostgreSQL schema and legacy data placeholders
  docker/                    # Backend/frontend Dockerfiles and nginx config
  scripts/setup-docker.ps1   # Generate private Docker credentials
  tests/                     # Frontend behavior tests
  .editorconfig              # Shared whitespace and encoding conventions
  .env.example               # Configuration template; .env stays private
  compose.yaml               # Local application and database orchestration
  package.json               # Shared Node dependencies and commands
  package-lock.json          # Reproducible dependency versions
  README.md
```

Keep browser code in `frontend/`, request handlers in `backend/routes/`, shared
configuration in `backend/config/`, and operational scripts in the script folders.
Keep relative browser URLs rooted in the frontend directory so public URLs stay
unchanged in Docker. Follow `.editorconfig`, use ES modules in backend code, and
update relevant tests and documentation when changing behavior.

## Troubleshooting

- **Frontend still uses cloud data:** update `frontend/js/config.js` for non-Docker runs and refresh the browser. Docker configures the API automatically.
- **MongoDB connection fails:** check the URI, credentials, and network access rules. Movie routes require a connection; watchlist routes are registered only after MongoDB initialization succeeds.
- **PostgreSQL connection fails:** check `DATABASE_URL`, SSL support, and network access. Initialization and startup use the same root `.env`.
- **Tables do not exist:** initialize the same database used by the server.
- **Profile or watchlist returns 401:** log in again; the token may have expired.
- **Navbar or footer fails to load:** serve the frontend over HTTP.

## Contributing

Keep changes focused, describe how to run and verify them, and update this README when setup or API behavior changes. Follow `.editorconfig` and the folder responsibilities above. Never commit database passwords or JWT secrets.

## License

`package.json` declares ISC. No standalone license file is currently included.


## Testing

With Node.js installed, run the frontend tests from the project root. If Windows
PowerShell blocks `npm.ps1`, use `npm.cmd` in place of `npm` for these commands:

```sh
npm test
```

With Docker running, run the API/database suite:

```sh
docker compose exec -T backend npm run test:integration
```

Integration tests create and remove temporary accounts, reviews, watchlist entries,
and movies. Run them against a development database. They check configuration,
authentication, ownership, account isolation, stable IDs, migrations, and watchlist
behavior. Frontend tests cover saved state, review controls, and movie links.

## Review ownership

Each new review stores the authenticated user's ID in `reviews.user_id`, which
references `users.u_id`. Public review responses include `user_id`, `author_name`,
and `updated_at`. Users can edit their rating/comment or delete their own reviews;
the server includes the owner in each update/delete query.

The schema initializer upgrades existing tables without dropping data. Reviews
created before ownership was added retain a null owner and appear as **Legacy review**.
They remain publicly readable and cannot be claimed, edited, or deleted through
the review API. The owner column stays nullable to preserve these historical rows
and reviews from deleted accounts (`ON DELETE SET NULL`); all new API submissions
require a valid authenticated owner.

Docker applies this upgrade when the `setup` service runs during
`docker compose up --build -d`. For a non-Docker setup, run the documented database
initialization command before starting the new backend. Comments must contain
1 to 5000 characters and ratings must be integers from 1 to 5.

## Stable movie references

MongoDB `_id` is the canonical movie identifier. Its 24-character ObjectId string
is stored in PostgreSQL `reviews.movie_id` and `watchlist.movie_id`. Movie links use
`movie.html?id=<movie-id>`, and the movie API returns `_id` in list/detail responses.
Duplicate titles are separate movies. Renaming a movie keeps its existing ID,
reviews, and watchlist entries intact.

New review requests must provide `movieId`. The server validates that the movie
exists in MongoDB and derives its title itself. `movie_title` remains a historical
label; review matching uses `movie_id`. Review reads show the current movie title
when the movie is available. The index on `(movie_id, created_at DESC)` supports
per-movie review queries. MongoDB references cannot have a PostgreSQL foreign key,
so the API validates them and preserves references if a movie is later removed.

Existing title-based bookmarks resolve to an ID only when the title is unambiguous.
If several movies have the same title, select the intended movie from the catalog.

Docker runs the review ID migration after initializing the schema and seeding movies.
The migration updates only reviews with no ID and an exact title matching one movie.
It never changes an existing ID, deletes a review, or chooses among duplicate titles.
Unmatched or ambiguous reviews keep a null `movie_id` and require manual reconciliation;
they remain accessible through the unfiltered review endpoint. Preserve MongoDB `_id`
values when importing or restoring movie data.

For non-Docker databases, initialize the schema, then run:

```sh
npm run db:migrate
```

To inspect unresolved references in PostgreSQL:

```sql
SELECT r_id, movie_title, user_id
FROM reviews
WHERE movie_id IS NULL
ORDER BY r_id;
```

## Configuration and credential rotation

All backend entry points load the project-root `.env` through `backend/config/env.js`.
Existing environment variables take precedence. PostgreSQL connections share
`getPgOptions()` for server startup, schema initialization, and ID migration.
MongoDB setup uses `getMongoOptions()`. No database password or JWT secret has a
fallback value. Missing configuration produces a clear startup error.

`.env.example` contains variable names and placeholders only. `.env` is ignored by
Git and excluded from Docker build contexts. Never run `docker compose config`
without `--quiet` when sharing diagnostics because resolved environment values
include secrets.

Rotating the JWT signing secret invalidates existing login tokens; log in again afterward.
The setup script preserves an existing `.env` and is not a rotation command. For an
existing PostgreSQL volume, changing a file or container variable alone does not
change its stored password; update the database role password and application
configuration together.

Previously exposed cloud credentials must also be changed in MongoDB Atlas and the
PostgreSQL provider's dashboard, then updated in the hosted backend's secret settings.
Removing a secret from source does not invalidate a copy in Git history. Those cloud
credentials cannot be rotated through the local Docker database.
