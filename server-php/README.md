# Angaar Dhaba backend (PHP + MySQL)

Plain PHP + PDO/MySQL — no framework, no Node.js anywhere. Built to run on
ordinary cPanel/shared hosting (MilesWeb), where backend and database live
on the **same server**, so there's no remote-database networking to worry
about — just `localhost`.

This replaces an earlier Node.js + MongoDB + Socket.io version (the
`server/` folder, still present in this repo). The data model and API
behavior are the same; what changed is the language, the database, and how
devices stay in sync (polling here, instead of WebSocket push — shared
hosting can't run a persistent socket server).

## How it's structured

```
server-php/
├── db/schema.sql          # run this once to create the MySQL tables
├── config/
│   ├── config.php          # loads config/.env
│   └── .env.example        # copy to .env, fill in your MySQL credentials
├── includes/
│   ├── db.php               # PDO connection
│   ├── orders_repo.php      # reads orders+items from MySQL, maps to the JSON shape the frontend expects
│   ├── billing.php          # GST math (5%, split into CGST+SGST)
│   ├── billing_flow.php     # invoice generation (atomic numbering) + shared by 3 endpoints
│   ├── menu_lookup.php      # reads menu-data.json to find each item's printStation
│   ├── tickets.php          # formats kitchen/bar tickets (no prices) and the billing ticket (with prices)
│   ├── print_jobs_repo.php  # print job queries
│   ├── ids.php               # friendly order-id generator
│   └── response.php          # JSON output + CORS headers, shared by every endpoint
└── api/                    # one file per endpoint — see table below
```

There's also `print-agent-php/` alongside this folder (not deployed here —
it runs on a computer inside the restaurant instead, on the printers'
network). See `print-agent-php/README.md`.

## The API

| Method | Path | Same as the old Node route |
|---|---|---|
| GET | `/api/orders.php` | `GET /api/orders` |
| GET | `/api/orders.php?table=7` | `GET /api/orders/table/:table` |
| GET | `/api/orders.php?table=7&active=1` | `GET /api/orders/table/:table/active` |
| POST | `/api/orders.php` | `POST /api/orders` |
| PATCH | `/api/order_update.php?id=EP...` | `PATCH /api/orders/:id` |
| POST | `/api/request_bill.php?table=7` | `POST /api/orders/table/:table/request-bill` |
| POST | `/api/generate_invoice.php?table=7` | `POST /api/orders/table/:table/generate-invoice` |
| POST | `/api/confirm_payment.php?table=7` | `POST /api/orders/table/:table/confirm-payment` |
| POST | `/api/print_bill.php?table=7` | `POST /api/orders/table/:table/print-bill` |
| GET | `/api/print_jobs_pending.php` | used by the Print Agent |
| PATCH | `/api/print_job_update.php?id=42` | used by the Print Agent |
| POST | `/api/print_job_retry.php?id=42` | dashboard "reprint" action |
| GET | `/api/health.php` | uptime check |

Path segments became query params (`?table=7` instead of `/table/7`)
because plain PHP file routing on shared hosting doesn't need — and
often doesn't have configured — URL rewriting (`.htaccess` mod_rewrite).
Every file is just requested directly.

**No WebSockets.** `orders.js` polls `GET /api/orders.php` (and similar)
every few seconds instead of receiving an instant push. Every page's
own rendering logic already re-checks "is there anything new I haven't
seen" on each refresh, so a few seconds of lag is the only practical
difference from before.

## Verified before shipping

The whole pipeline was tested end-to-end locally — a temporary PHP
install running this exact code against a temporary database standing in
for MySQL, driven through the real HTTP API: an order created, split
correctly into a no-price Kitchen ticket, moved through
new→preparing→ready→delivered→bill_requested, invoice generated with
correct GST math (verified numerically), sequential invoice numbering
across multiple bills, and the real Print Agent (not a mock) picking up
jobs, "printing" them, and reporting status back — including a printer
failure being correctly recorded and surfaced, not silently lost. That
test setup is not part of what's shipped here.

## Deploying on MilesWeb (step by step)

### 1. Create the MySQL database

1. Log in to cPanel → **MySQL® Databases**
2. Create a database (e.g. `angaardhaba`) — cPanel will name it something
   like `yourcpaneluser_angaardhaba`
3. Create a database user with a password (save it somewhere safe — a
   password manager, not chat)
4. Add that user to that database with **ALL PRIVILEGES**

### 2. Load the schema

cPanel → **phpMyAdmin** → select your database → **Import** tab → choose
`server-php/db/schema.sql` → **Go**. This creates the `orders`,
`order_items`, `print_jobs`, and `invoice_seq` tables.

### 3. Upload the code

Upload the whole `server-php/` folder (and `menu-data.json`, which lives
one level up — `includes/menu_lookup.php` reads it directly, so keep that
relative position) to your hosting, e.g. as a subdomain like
`api.yourdomain.com` pointed at the `server-php` folder, or a subfolder
under your main domain. cPanel's File Manager or an FTP client both work.

### 4. Configure

On the server, copy `config/.env.example` to `config/.env` and fill in:
```
DB_HOST=localhost
DB_NAME=yourcpaneluser_angaardhaba
DB_USER=yourcpaneluser_angaardhaba
DB_PASSWORD=<the password from step 1>
ALLOWED_ORIGINS=https://hotel-rag-gen-glb.vercel.app
```

### 5. Test it

Visit `https://your-backend-url/api/health.php` — you should see
`{"ok":true,"message":"Angaar Dhaba API is running"}`. If you see a
database error instead, double check `config/.env`.

### 6. Point the frontend at it

In `orders.js`, `API_BASE` is currently a placeholder:
```js
const API_BASE = 'https://your-php-backend-url';
```
Replace it with your real backend URL from step 3, then commit and push —
Vercel redeploys the frontend automatically.

### 7. Set up printing (optional, once you have physical printers)

See `print-agent-php/README.md`.
