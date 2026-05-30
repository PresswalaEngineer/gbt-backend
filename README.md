# Global Bus Tour API

Express + Prisma + PostgreSQL backend for the GBT admin panel.

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Copy env, then fill in real secrets
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"   # JWT secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # ENCRYPTION_KEY

# 3. Start Postgres locally (or point DATABASE_URL at a managed DB)

# 4. Generate client + run migrations
npm run prisma:generate
npm run prisma:migrate

# 5. Seed root admin + sample countries/cities
npm run db:seed

# 6. Run dev server (auto-restarts on file changes)
npm run dev
```

The API mounts everything under `API_PREFIX` (default `/api/v1`).

## API surface

| Method | Path                       | Auth        | Notes                                                            |
| ------ | -------------------------- | ----------- | ---------------------------------------------------------------- |
| GET    | `/health`                  | public      | Liveness probe                                                   |
| POST   | `/auth/login`              | public      | `{ email, password }` → `{ accessToken, staff }` + refresh cookie |
| POST   | `/auth/signup`             | admin only  | Create staff (role admin/staff) — used to invite teammates       |
| POST   | `/auth/refresh`            | refresh cookie | Rotates refresh, returns new access token                     |
| POST   | `/auth/logout`             | any         | Revokes refresh token + clears cookie                            |
| GET    | `/auth/me`                 | bearer      | Current staff profile                                            |
| GET    | `/staff`                   | admin       | List staff, paginated                                            |
| GET    | `/staff/:id`               | bearer      | Get staff by id (self or admin)                                  |
| PATCH  | `/staff/:id`               | bearer      | Update name / password (self), role / status (admin only)        |
| DELETE | `/staff/:id`               | admin       | Delete staff                                                     |
| GET    | `/countries`               | bearer      | List countries (`?search=&status=&page=&limit=`)                |
| GET    | `/countries/:id`           | bearer      |                                                                  |
| POST   | `/countries`               | admin       |                                                                  |
| PATCH  | `/countries/:id`           | admin       |                                                                  |
| DELETE | `/countries/:id`           | admin       |                                                                  |
| GET    | `/cities`                  | bearer      | `?search=&countryId=&status=&page=&limit=`                      |
| GET    | `/cities/:id`              | bearer      |                                                                  |
| POST   | `/cities`                  | admin       |                                                                  |
| PATCH  | `/cities/:id`              | admin       |                                                                  |
| DELETE | `/cities/:id`              | admin       |                                                                  |
| GET    | `/categories`              | bearer      | `?search=&status=&page=&limit=`                                  |
| GET    | `/categories/:id`          | bearer      |                                                                  |
| POST   | `/categories`              | admin       | `{ name, status }` — `name` unique                              |
| PATCH  | `/categories/:id`          | admin       |                                                                  |
| DELETE | `/categories/:id`          | admin       | Linked attractions keep running with `categoryId = null`        |
| GET    | `/attractions`             | bearer      | `?search=&cityId=&categoryId=&status=&page=&limit=`             |
| GET    | `/attractions/:id`         | bearer      | Embeds `city.country` and `category`                             |
| POST   | `/attractions`             | admin       | Required: `cityId`, `name`, `bannerHeading`; `categoryId` optional |
| PATCH  | `/attractions/:id`         | admin       |                                                                  |
| DELETE | `/attractions/:id`         | admin       |                                                                  |
| GET    | `/tours`                   | bearer      | `?search=&cityId=&countryId=&categoryId=&attractionId=&apiType=&status=&page=&limit=` |
| GET    | `/tours/:id`               | bearer      | Embeds `country`, `city`, `category`, `attraction`, `options[]`  |
| POST   | `/tours`                   | admin       | Required: `name`, `productId`, `countryId`, `cityId`, `meetingPoint`, `endingPoint`, `startTime`, `bookingWindow`. Accepts nested `options: [{ name, code?, externalId }]` and `priceTiers: [{ tier, nettPrice?, grossPrice, originalPrice?, notes? }]`. Pricing fields: `tourType`, `durationDays?`, `pricingMode`, `marginPercent?`, `commissionPercent?`, `currency?` (3-letter ISO). |
| PATCH  | `/tours/:id`               | admin       | If `options` is present, replaces options atomically. If `priceTiers` is present, replaces the price tiers atomically. Tier validity is enforced against `tourType` (`ADULT/CHILD/INFANT/SENIOR` for SINGLE_DAY; `PAX_1/PAX_2/PAX_3/CHILD_WITH_BED/CHILD_WITHOUT_BED` for MULTI_DAY). |
| DELETE | `/tours/:id`               | admin       |                                                                  |
| POST   | `/uploads/presign`         | bearer      | `{ filename, contentType, size, folder? }` → `{ uploadUrl, publicUrl, key, headers }`. Caller PUTs the file directly to `uploadUrl`. |
| GET    | `/integrations/tourcms/ping` | admin     | Calls `listChannels` on TourCMS — credential sanity check. Returns `{ ok, marketplaceId, channels }`. |
| GET    | `/integrations/tourcms/tours/search` | admin | `?channelId=&q=&perPage=` → `{ totalCount, tours[] }`. Powers the autosuggest in tour-management/manage. |
| GET    | `/integrations/tourcms/tours/:tourId` | admin | `?channelId=` → normalized `tour_show` (no image mirroring). |
| POST   | `/integrations/tourcms/tours/:tourId/import` | admin | `?channelId=` → fetches `tour_show`, mirrors thumbnail + gallery to your R2/local bucket, returns the form-ready payload with rewritten URLs. |
| GET    | `/integrations/ventrata/ping` | admin    | Calls `GET /products` on Ventrata — credential sanity check. Returns `{ ok, productCount, sample[] }`. |
| GET    | `/integrations/ventrata/products/search` | admin | `?q=&perPage=` → `{ totalCount, products[] }`. Server-side filter over the full product list (OCTO has no native keyword search). |
| GET    | `/integrations/ventrata/products/:productId` | admin | Normalized OCTO product (no image mirroring). |
| POST   | `/integrations/ventrata/products/:productId/import` | admin | Fetches the product, mirrors `coverImageUrl` + `galleryImages[]` to your R2/local bucket, returns the form-ready payload with rewritten URLs and mapped `options[]`. |

All responses follow:
```json
{ "success": true, "message": "...", "data": ..., "meta": ... }
```
or on error:
```json
{ "success": false, "message": "...", "code": "...", "details": ... }
```

## Cloudflare R2 setup

All admin-panel images (attraction banners, tour thumbnails, blog covers, homepage banners…) are uploaded **directly from the browser to a Cloudflare R2 bucket** using a presigned PUT URL. The API never proxies the file bytes — it only signs the request.

1. **Create the bucket** on the [R2 dashboard](https://dash.cloudflare.com/?to=/:account/r2). Suggested name: `gbt-assets`.
2. **Generate an R2 API token** (Object → Read & Write) and copy the access key + secret.
3. **Find the account ID** in the R2 sidebar.
4. **Make the bucket publicly readable** — either:
   - Connect a custom domain (recommended for production), e.g. `cdn.gbt.example.com`, or
   - Enable the auto-generated `pub-*.r2.dev` public URL.
   Whichever you pick, paste the resulting base URL into `R2_PUBLIC_BASE_URL`.
5. **Add a CORS policy** on the bucket so the browser can PUT from the admin panel origin. From the bucket → *Settings* → *CORS Policy*:
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000", "https://your-admin-domain.example.com"],
       "AllowedMethods": ["GET", "PUT"],
       "AllowedHeaders": ["Content-Type"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
6. **Fill the env vars** in `.env`:
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`
   - `R2_PRESIGN_EXPIRES_IN` (default 300s) — how long the upload URL stays valid
   - `UPLOAD_MAX_SIZE_BYTES` (default 5MB), `UPLOAD_ALLOWED_MIME` (image/* by default)

Frontend note: if you serve assets from a custom domain, also add it to `next.config.mjs` `images.remotePatterns`.

## TourCMS integration

Wires the [TourCMS Marketplace API](https://www.tourcms.com/support/api/mp/) so admins can create a Tour by searching the supplier’s catalogue instead of copy-pasting fields.

### Env vars

| Var | Required? | Default | Notes |
| --- | --- | --- | --- |
| `TOURCMS_BASE_URL` | no | `https://api.tourcms.com` | Override only for staging mocks. |
| `TOURCMS_API_KEY` | yes (to use the integration) | _empty_ | Per-vendor API key issued by TourCMS — different key per supplier channel. |
| `TOURCMS_MARKETPLACE_ID` | yes (to use the integration) | `0` | Your marketplace account id. |
| `TOURCMS_DEFAULT_CHANNEL_ID` | no | `3930` | Default supplier channel; `3930` is the public *TourCMS Example Tour Operator* sandbox. |

If `TOURCMS_API_KEY` or `TOURCMS_MARKETPLACE_ID` is blank the API still boots — calls to `/integrations/tourcms/*` respond `503 TOURCMS_NOT_CONFIGURED` instead.

### Authentication (HMAC) — for reference

Each request signs a string composed of `<channelId>/<marketplaceId>/<verb>/<unixTimestamp><path?qs>` with HMAC-SHA256, base64-encodes it, then PHP-style `rawurlencode`s the result. Headers:

```
x-tourcms-date: <unix-seconds>
Authorization: TourCMS <channelId>:<marketplaceId>:<signature>
```

See `src/services/integrations/tourcms/client.js`. Cross-check against [the official Node wrapper](https://github.com/TourCMS/node-tourcms/blob/master/node-tourcms.js#L1299-L1306) if signatures ever drift.

### Quick verification (after filling env)

```bash
# Credential sanity check
curl -H "Authorization: Bearer <admin-jwt>" \
  http://localhost:4000/api/v1/integrations/tourcms/ping

# Search the sandbox channel
curl -H "Authorization: Bearer <admin-jwt>" \
  'http://localhost:4000/api/v1/integrations/tourcms/tours/search?channelId=3930&q=tour'

# Import (mirrors images to R2/local, returns form-ready payload)
curl -X POST -H "Authorization: Bearer <admin-jwt>" \
  'http://localhost:4000/api/v1/integrations/tourcms/tours/<tourId>/import?channelId=3930'
```

The `/import` response’s `data.tour.thumbnail` and `data.tour.images[]` should all be URLs on your R2 bucket / local-uploads path — never `tourcms.com`. If they’re not, check that `STORAGE_DRIVER` is set and (for `r2`) the R2 vars are populated.

## Ventrata integration

Wires the [Ventrata OCTO API](https://docs.ventrata.com/) (which implements the [OCTO spec](https://docs.octo.travel/)) so admins can create a Tour by searching the supplier's catalogue instead of copy-pasting fields. Same flow as TourCMS — only the wire protocol differs (REST + JSON, Bearer auth).

### Env vars

| Var | Required? | Default | Notes |
| --- | --- | --- | --- |
| `VENTRATA_BASE_URL` | no | `https://api.ventrata.com/octo` | Override only for staging mocks. |
| `VENTRATA_API_KEY` | yes (to use the integration) | _empty_ | Per-vendor Bearer token issued by Ventrata — different key per supplier (Tootbus, Big Bus, etc.). |
| `VENTRATA_OCTO_ENV` | no | `test` | Sent as the `Octo-Env` header. Use `test` for sandbox (no availability consumption / barcode activation), `live` for real bookings. |
| `VENTRATA_OCTO_CAPABILITIES` | no | `octo/content,octo/pricing,octo/pickups` | Comma-separated capability flags sent as the `Octo-Capabilities` header. The default enables product content (description, images), pricing, and pickup/dropoff fields. |

If `VENTRATA_API_KEY` is blank the API still boots — calls to `/integrations/ventrata/*` respond `503 VENTRATA_NOT_CONFIGURED` instead.

### Authentication — for reference

```
Authorization: Bearer <VENTRATA_API_KEY>
Octo-Capabilities: octo/content, octo/pricing, octo/pickups
Octo-Env: test
```

OCTO requires the `Octo-Capabilities` header on every product call (omitting it returns 400). Available capability identifiers: `octo/content` (adds description / images / FAQs), `octo/pricing` (adds default currency / pricing fields), `octo/pickups` (adds pickup/dropoff fields on options).

### Search behaviour

OCTO's `GET /products` returns the **full** product catalogue — there's no `?q=` query parameter. The search endpoint (`/integrations/ventrata/products/search`) fetches the list and filters server-side by case-insensitive substring match on `name`, `internalName`, `reference`, `productId`, and `location`. For sandbox vendors with hundreds of products this is fine; if a future vendor exposes thousands, add a 5-minute in-memory cache before the filter.

### Quick verification (after filling env)

```bash
# Credential sanity check (with the bearer token from your Ventrata vendor)
curl -H "Authorization: Bearer <admin-jwt>" \
  http://localhost:4000/api/v1/integrations/ventrata/ping

# Search the configured vendor's catalogue
curl -H "Authorization: Bearer <admin-jwt>" \
  'http://localhost:4000/api/v1/integrations/ventrata/products/search?q=tour'

# Import (mirrors images to R2/local, returns form-ready payload)
curl -X POST -H "Authorization: Bearer <admin-jwt>" \
  'http://localhost:4000/api/v1/integrations/ventrata/products/<productId>/import'
```

The `/import` response's `data.product.thumbnail` and `data.product.images[]` should all be URLs on your R2 bucket / local-uploads path — never `ventrata.com` or the supplier's CDN.

The `/import` response also surfaces best-effort pricing for the admin to review:
- `data.product.currency` — extracted from `product.defaultCurrency` (with fallbacks to `availableCurrencies[0]` and the first option/unit `pricingFrom[0].currency`).
- `data.product.priceTiers[]` — one row per OCTO unit type that maps cleanly to our `PriceTier` enum (`ADULT/CHILD/INFANT/SENIOR`, with `YOUTH/STUDENT` bucketed into `CHILD`). `grossPrice` is read from `unit.pricingFrom[0].original ?? unit.pricingFrom[0].retail` and converted from OCTO minor units (cents) to a major-unit decimal.

The same shape (`currency` + `priceTiers[]`) is returned by `POST /integrations/tourcms/tours/:id/import` for TourCMS — `from_price` / `from_price_display` populates an `ADULT` tier with `currency` from the tour. The admin form merges both vendors' output into the manage screen and the admin tweaks values before saving.

### Adding the next vendor

The integration layout is intentionally split so adding e.g. GetYourGuide or Bokun is parallel work, not a refactor:

- `src/services/integrations/<vendor>/` — wire client + response normalizer.
- `src/modules/integrations/<vendor>/` — Express routes/controller/service/validation.
- Reuse `src/services/integrations/image-mirror.js` — don't fork it.

Mount in `src/routes.js` under `/integrations/<vendor>` and require `requireAuth + requireRole('ADMIN')`.

## Architecture

See `CLAUDE.md` at the monorepo root.
