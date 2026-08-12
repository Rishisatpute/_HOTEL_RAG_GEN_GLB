# Running this locally (Docker)

Requires only [Docker Desktop](https://www.docker.com/products/docker-desktop/) — no need to install PHP or MySQL yourself.

## 1. Create the backend config file

Copy `server-php/config/.env.example` to `server-php/config/.env` and fill it in with:

```
DB_HOST=mysql
DB_NAME=angaardhaba
DB_USER=angaardhaba
DB_PASSWORD=angaardhaba
ALLOWED_ORIGINS=http://localhost:5000
```

(This file is gitignored on purpose — every dev makes their own.)

## 2. Start everything

From this folder (`_HOTEL_RAG_GEN_GLB/`), with Docker Desktop running:

```
docker compose up -d
```

First run takes a couple of minutes (it compiles a PHP extension inside the container). This starts 4 containers:

| Service | URL | What it is |
|---|---|---|
| frontend | http://localhost:5000 | the static site (index.html, menu.html, etc.) |
| php | http://localhost:8000 | the PHP API (`server-php/`) |
| mysql | localhost:3307 | the database (schema.sql auto-loaded on first start) |
| phpmyadmin | http://localhost:8081 | DB browser (login: root / root) |

## 3. Check it worked

```
curl http://localhost:8000/api/health.php
```
Should print `{"ok":true,"message":"Angaar Dhaba API is running"}`.

Then open **http://localhost:5000/index.html** in a browser.

## 4. Making changes

Just edit files normally — both the `php` and `frontend` containers mount this folder live, so PHP/HTML/JS edits show up on refresh, no rebuild needed.

`orders.js` (`API_BASE`) is already pointed at `http://localhost:8000` for local dev. **Before deploying to MilesWeb**, change it to your real hosted backend URL — see `server-php/README.md` for the full deploy steps.

## 5. Stop it

```
docker compose down
```
Keeps your local DB data. Add `-v` to also wipe the database and start fresh next time.
