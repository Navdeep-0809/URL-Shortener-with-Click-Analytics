# Shortly — URL Shortener with Click Analytics

Shortly is a MERN application for creating and managing short links and viewing
their click analytics. Phases 1-5 establish the workspace, MongoDB-backed link
creator, secure redirects, accounts, owner-scoped link management, per-link
analytics, and downloadable QR codes. Phase 6 adds password-protected,
expiring, click-limited, and one-time-use links.

## Architecture

The project is a small npm-workspace monorepo. The browser application and API
run as separate processes in development, and Vite proxies `/api` requests to
Express. That keeps local frontend requests simple while retaining a separately
deployable API.

```text
backend/
  src/
    config/       Environment and database configuration
    controllers/  HTTP request handlers
    middleware/   Authentication, validation, and error handling
    models/       Mongoose User, Url, and Click schemas
    routes/       Express API and public redirect routes
    services/     Link, redirect, click logging, and analytics business logic
    utils/        Shared validation and helpers
  tests/
frontend/
  src/
    api/          Axios client and API functions
    components/   Reusable interface components
    context/      Shared application state
    hooks/        Reusable React hooks
    layouts/      Shared page layouts
    pages/        Landing, dashboard, and analytics pages
    styles.css    Tailwind entry point and global styles
```

### Technology choices

- Frontend: React 18, Vite 7, Tailwind CSS, Axios, Recharts, and
  `qrcode.react`.
- Backend: Node.js, Express, Helmet, CORS, Mongoose, MongoDB Atlas, `nanoid`,
  `ipaddr.js`, `express-rate-limit`, `bcryptjs`, and JWT authentication.
  `ua-parser-js` parses browser/device/OS metadata; `geoip-lite` supplies
  approximate country/city data when available.
- The core application will be completed and tested before considering optional
  Upstash Redis caching.

### Phase plan

1. Establish the workspace structure and development scaffold (complete).
2. Configure MongoDB and implement validated short-link creation (complete).
3. Implement secure, fast redirects and destination protections (complete).
4. Add authentication and owner-scoped link management (complete).
5. Add click analytics and QR generation (complete).
6. Add password protection, expiry, click limits, and one-time links (complete).
7. Add focused tests and deployment guidance; verify actual deployed behavior.
8. Consider Redis only after the core system works and baseline latency is
   measured.

## Prerequisites

- Node.js 20 LTS or newer and npm.
- MongoDB Atlas or a local MongoDB server.

## MongoDB setup (Windows PowerShell)

1. Choose MongoDB Atlas or a local MongoDB server. For Atlas, create a cluster
   and database user, then allow your current development IP in Network Access.
   Avoid allowing access from every IP for a local development setup.
2. Copy the example environment files from the project root:

   ```powershell
   Copy-Item backend\.env.example backend\.env
   Copy-Item frontend\.env.example frontend\.env.local
   ```

3. In `backend\.env`, set `MONGODB_URI` to your database connection string. For
   a local MongoDB server, use
   `mongodb://127.0.0.1:27017/shortly_dev`; for Atlas, use the connection string
   from **Connect → Drivers**. URL-encode special characters in the database
   username or password. Keep this value private and do not commit the `.env`
   file.
4. Generate a private JWT secret in PowerShell:

   ```powershell
   $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
   $bytes = New-Object byte[] 48
   $rng.GetBytes($bytes)
   $jwtSecret = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
   $rng.Dispose()
   $jwtSecret
   ```

   Copy the printed value into `JWT_SECRET` in `backend\.env`. Do not paste it
   into source code, commit it, or share it.
5. Install packages and start both development servers:

   ```powershell
   npm install
   npm run dev
   ```

The web app is served at `http://localhost:5173`; the API listens at
`http://localhost:5000`. The API requires both MongoDB and a valid JWT secret,
then verifies database indexes before it begins listening. The backend always
loads `backend\.env`, even when its start command is run from the project root
or another working directory. Check its health:

```powershell
Invoke-RestMethod http://localhost:5000/api/health
```

The environment examples contain placeholders only. Never commit `.env` or
`.env.local` files.

## Creating a short link

Anonymous link creation is available at `POST /api/urls`. The request accepts
`longUrl` and an optional `customAlias`; extra fields are rejected so callers
cannot set internal fields such as click counts or ownership.

```powershell
$body = @{ longUrl = "https://example.com/article" } | ConvertTo-Json
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:5000/api/urls `
  -ContentType "application/json" `
  -Body $body
```

An alias can be supplied as `customAlias = "my-article"`. Aliases are normalized
to lowercase and must be 3-30 characters made of letters, numbers, and internal
hyphens. Application route names are reserved. A successful response has HTTP
status `201` and returns `id`, `code`, `longUrl`, `shortUrl`, and `createdAt`.
The generated short URL base defaults to `http://localhost:5000` and can be
changed with `PUBLIC_SHORT_URL_BASE`.
If a valid Bearer token is supplied, the new link is saved to that account;
without a token, shortening remains anonymous.

Only absolute HTTP and HTTPS destinations are accepted; embedded credentials
are rejected. Creation does not fetch destination content. It resolves DNS
records and rejects hostnames if any resolved address is not publicly
routable. Localhost names, internal-only suffixes, and private, loopback,
link-local, shared, reserved, and multicast IPv4/IPv6 ranges are also rejected.
DNS is checked during creation rather than on every redirect to keep the
redirect path fast. Because the redirect is sent to the visitor's browser, a
later DNS change can affect what that browser resolves; the API itself never
fetches the destination.

Generated codes use seven characters chosen from a 62-character alphabet
(uppercase letters, lowercase letters, and digits), giving `62^7` =
`3,521,614,606,208` possible codes. MongoDB enforces uniqueness with the
`url_code_unique` index. If a generated code collides, the API tries another
code, up to five insert attempts. A custom alias is checked before insert, and
the unique index handles the race where two requests choose the same alias at
once; that request receives HTTP `409`.

## Accounts and link management

Register with an email and a password of at least 12 characters. Passwords are
hashed with bcryptjs (12 rounds); the plaintext password is never stored.
Passwords are limited to 72 UTF-8 bytes to match bcrypt's input limit. Sign-in
returns a signed HS256 JWT that expires after one hour. Protected API calls
include the standard JWT authorization header. The React client keeps the token
in `sessionStorage` for the current browser tab. Sign out removes it.

The browser dashboard supports creating saved links, setting expiration dates,
click limits, one-time use, and link passwords, searching by short code or
destination, filtering active/disabled links, editing destinations and link
controls, copying short URLs, downloading a QR code, disabling/enabling,
deleting, and bulk actions. Each saved link opens an analytics page with a date filter,
clicks-over-time chart, referrer/device/browser/OS breakdowns, approximate
country/city breakdowns, and recent click events. The dashboard also shows
owner-scoped link totals, click totals, recent links, and top links.
Unauthenticated visitors can still shorten links, but cannot access saved-link
management endpoints.

The user-list query, every individual update/delete, summary aggregation, and
bulk mutation include the authenticated `userId` in the database filter. A
non-owner receives the same `404` as a missing link rather than link details.
Bulk operations accept up to 100 IDs and report only the number of links owned
by the current user that were affected.

## API examples

Register and retain the returned access token for authenticated requests:

```powershell
$credentials = @{
  email = "you@example.com"
  password = "a-long-demo-password-123"
} | ConvertTo-Json
$session = Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:5000/api/auth/register `
  -ContentType "application/json" `
  -Body $credentials
$scheme = "Be" + "arer"
$headers = @{}
$headers["Authorization"] = "$scheme $($session.token)"
```

List a user's links (20 per page), optionally searching/filtering:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:5000/api/urls?page=1&search=article&status=active" `
  -Headers $headers
```

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Register and return a one-hour JWT |
| POST | `/api/auth/login` | Sign in and return a one-hour JWT |
| GET | `/api/auth/me` | Return the authenticated user's profile |
| GET | `/api/urls?page=&search=&status=` | Paginated, owner-scoped link list |
| GET | `/api/urls/summary` | Owner-scoped total, recent, and top-link summary |
| PATCH | `/api/urls/:id` | Update destination, alias, active state, expiry, limits, or password |
| DELETE | `/api/urls/:id` | Delete one owned link |
| POST | `/api/urls/bulk` | Enable, disable, or delete up to 100 owned links |
| GET | `/api/urls/:id/analytics?from=&to=` | Owner-scoped click breakdowns for an inclusive date range (maximum 366 days) |
| POST | `/api/urls/:code/verify` | Verify a password-protected link and redirect after success |

`POST /api/urls` accepts optional `expiresAt` (ISO date or timestamp),
`clickLimit` (positive integer), `oneTimeUse` (boolean), and `password`
(8-72 UTF-8 bytes). A date-only expiry includes the full UTC day. One-time use
is represented by a click limit of one. `PATCH /api/urls/:id` accepts these
options too; use `expiresAt: null` or `clickLimit: null` to remove those
limits, `oneTimeUse: false` to clear one-time mode, and `password: null` to
remove password protection. An empty password is not accepted as a password
change.

`customAlias: null` removes a custom alias and assigns a new generated code.
Account creation is limited to five attempts per IP per 15 minutes; sign-in is
limited to ten attempts per IP per 15 minutes.

## Data model and indexes

The `User` Mongoose model stores a unique normalized email, a password hash
excluded from ordinary query results, and `createdAt`. The `Url` Mongoose model
stores `code`, `longUrl`, optional `userId`,
`customAlias`, `expiresAt`, `passwordHash`, `clickLimit`, `clicks`, `isActive`,
and `createdAt`. Link passwords use bcryptjs with 12 rounds and are excluded
from ordinary queries; account owners can replace or remove them without
retrieving the hash. Expiry is enforced on each redirect. The `Click` model stores `urlId`, timestamp, origin-only
referrer, bounded user-agent, parsed device/browser/OS, approximate country and
city, and an HMAC-hashed IP; raw IP addresses are never saved. Hashed IP values
are excluded from ordinary queries. Clicks have a compound `{ urlId: 1,
timestamp: -1 }` index for analytics ranges. Password hashes are excluded from
query results by default. Unique email and code indexes plus an
owner/creation-time index are created before the API starts accepting requests.

## Redirects, click counts, and rate limits

For an ordinary link, `GET /:code` performs a single indexed lookup by the
unique code, then responds with HTTP `302` and the saved destination. A `302`
is temporary and generally avoids the long-lived browser caching associated
with `301`; a cached `301` could bypass the application on later visits and
undercount clicks. Missing codes return `404`; disabled, expired, and exhausted
links return `410`. Password-protected links show a small no-store password
form; the form submits to `POST /api/urls/:code/verify` and redirects only
after bcrypt verification. Verification is rate-limited to 10 attempts per IP
per 15 minutes.

Click-limited links are consumed by a conditional atomic MongoDB update that
checks the active state, expiry, current click count, and limit while
incrementing the count. Concurrent requests therefore cannot exceed the
configured limit; the same operation makes one-time links safe under
concurrent requests. Password checks happen before the atomic reservation, so
incorrect attempts do not consume clicks. For unlimited links, click counters
remain asynchronous to keep the normal redirect path fast. For capped links,
the counter is committed before the redirect so the cap is reliable; only the
detailed Click event remains asynchronous and may be lost if the process exits.

After sending the redirect, the API schedules the Click event insert and an
atomic MongoDB `$inc` of the URL's `clicks` counter without waiting for either
write. Concurrent increments are safe, but a process crash can lose a
scheduled event or count; because the writes are independent, a failure can
also make the aggregate counter differ from the event-based analytics. Failed
metadata preparation and both writes are logged explicitly. Fire-and-forget
logging keeps database write latency off the redirect response, but it does
not guarantee delivery. A durable queue/outbox would improve delivery
reliability at the cost of extra infrastructure and redirect-path complexity;
it is not added until reliability needs justify it.

The authenticated analytics endpoint verifies link ownership before querying
clicks. `from` and `to` accept ISO dates; date-only `to` values include the
entire UTC day. The range is inclusive and capped at 366 days; omitted values
default to the most recent 366 days. Missing daily counts are returned as
zeroes. Referrer values are reduced to origin only to avoid retaining paths or
query strings. GeoIP results are approximate, can be missing or outdated, and
are not precise user locations. IP hashes are for privacy-conscious event
storage and are not displayed in analytics. QR codes encode the link's
short URL and can be downloaded from the dashboard as PNG files.

The API currently limits requests to 100 per IP per 15 minutes, link creation
to 20 per IP per 15 minutes, password verification to 10 per IP per 15
minutes, and redirects to 300 per IP per 15 minutes. These in-memory limits
reset on process restart. Before proxy-backed deployment,
configure Express to trust only the actual hosting proxy chain so rate limits
use the visitor address rather than a shared proxy address.

## Environment variables

| Variable | Location | Purpose |
| --- | --- | --- |
| `PORT` | `backend/.env` | Express listening port (defaults to `5000`) |
| `CLIENT_ORIGIN` | `backend/.env` | Allowed browser origin (defaults to Vite's local URL) |
| `PUBLIC_SHORT_URL_BASE` | `backend/.env` | Public origin used to construct returned short URLs |
| `MONGODB_URI` | `backend/.env` | MongoDB Atlas connection string; required to start the API |
| `JWT_SECRET` | `backend/.env` | Private random signing secret; required to start the API |
| `VITE_API_BASE_URL` | `frontend/.env.local` | API base path (defaults to `/api`) |

## Scripts and current API

| Command or method | Purpose |
| --- | --- |
| `npm run dev` | Run the frontend and API together |
| `npm run build` | Build the frontend for production |
| `npm run start` | Start the API (requires a valid `MONGODB_URI` and `JWT_SECRET`) |
| `npm run test --workspace backend` | Run backend unit tests |
| GET `/api/health` | Health endpoint, available after the database connection succeeds |
| POST `/api/urls` | Create an anonymous or account-owned short link |
| POST `/api/auth/register`, `/api/auth/login` | Register or sign in |
| POST `/api/urls` | Create anonymous or account-owned links with optional expiry/limit/password controls |
| POST `/api/urls/:code/verify` | Verify a protected link password and redirect |
| GET `/api/urls?page=&search=&status=` | List the signed-in user's links |
| GET `/api/urls/summary` | Return the signed-in user's dashboard summary |
| GET `/api/urls/:id/analytics?from=&to=` | Return owner-scoped click analytics |
| PATCH/DELETE `/api/urls/:id` | Update or remove an owned link |
| POST `/api/urls/bulk` | Bulk enable, disable, or delete owned links |
| GET `/:code` | Redirect to a saved destination with HTTP `302` |
| POST `/api/urls/:code/verify` | Verify a password-protected link before redirecting |

Tests cover API input validation, URL and alias validation, public/private
address checks, short-link creation, code-collision retries, redirects, expiry,
click limits, concurrent one-time use, password verification and hashing,
verification rate limiting, JWT authentication, owner-scoped management, click
metadata privacy, asynchronous click-log failures, and owner-scoped
analytics/date aggregation. Database integration still needs to be verified
with a configured Atlas cluster.

## Deployment status

Nothing has been deployed or configured with DNS. The intended deployment
blueprint is MongoDB Atlas for the database, Render or Railway for the API, and
Vercel for the frontend. Production deployment, HTTPS, custom domains, redirect
latency, and persisted analytics must be verified before they can be described
as complete.
