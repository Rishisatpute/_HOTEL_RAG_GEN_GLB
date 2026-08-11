# Angaar Dhaba backend

Express + MongoDB (Mongoose) + Socket.io. Replaces what used to be
`localStorage` + `BroadcastChannel` in the frontend's `orders.js` — the
data now lives in one shared database instead of each browser's own
storage, and Socket.io pushes live updates to every connected device
(a customer's phone, the kitchen tablet, a waiter's phone, the counter
PC) instead of only other tabs on the same browser.

## How it's structured

```
server/
├── server.js            # entry point: wires Express + Socket.io + MongoDB together
├── socket.js             # broadcasts order_created/updated/bill_requested/... to everyone
├── config/database.js    # connects to MongoDB Atlas via MONGODB_URI
├── models/
│   ├── Order.js           # one document per order — same shape orders.js has always used
│   └── Counter.js         # atomic sequence for invoice numbers (INV-EKP-000001, ...)
├── routes/orders.js      # one REST endpoint per OrderStore function
└── utils/
    ├── generateId.js      # same friendly order-id format the frontend used to generate itself
    └── billing.js          # GST math (5%, split into CGST+SGST) — server is now the source of truth
```

## The API

Every endpoint is a direct translation of a function `orders.js` already had —
if you know what `OrderStore.createOrder()` did before, you know what
`POST /api/orders` does now.

| Method | Path | Old OrderStore function |
|---|---|---|
| GET | `/api/orders` | `getAll()` |
| GET | `/api/orders/table/:table` | `getByTable(table)` |
| GET | `/api/orders/table/:table/active` | `getActiveByTable(table)` |
| POST | `/api/orders` | `createOrder({table, items, notes, placedBy, waiterName})` |
| PATCH | `/api/orders/:id` | `updateOrder(id, patch)` — used for status moves |
| POST | `/api/orders/table/:table/request-bill` | `requestBill(table, method)` |
| POST | `/api/orders/table/:table/generate-invoice` | `generateInvoice(table)` |
| POST | `/api/orders/table/:table/confirm-payment` | `confirmPayment(table)` |
| GET | `/api/health` | — (uptime check) |

Every write also broadcasts a Socket.io event with the same name the old
`emit()` calls used (`order_created`, `order_updated`, `bill_requested`,
`invoice_generated`, `order_paid`) — that's what makes every open page
update live without polling.

## What changed vs. the old localStorage version

- **Invoice numbers are now atomic** (`models/Counter.js`, a MongoDB
  `$inc`). The old version just read-incremented-wrote a number in
  `localStorage`, which only worked because one browser can't race
  itself — now that real staff on different devices can both click
  "Generate Invoice" at nearly the same moment, this needed a proper
  atomic counter.
- **GST math moved server-side** (`utils/billing.js`) — the frontend still
  has a copy of the same pure math functions for showing a *live preview*
  before an invoice is generated, but the numbers that actually get
  saved and printed now come from the server, once.
- **Order/bill ids are minted server-side** (`utils/generateId.js`)
  instead of client-side, for the same reason as the invoice counter.

## Deploying this (step by step)

### 1. MongoDB Atlas (the database)

1. Go to https://www.mongodb.com/cloud/atlas/register and create a free account.
2. Create a new project, then a free **M0** cluster (any region close to you).
3. Under **Database Access**, add a database user with a password (save it somewhere safe — a password manager, not this chat).
4. Under **Network Access**, add `0.0.0.0/0` (allow access from anywhere) — Render's servers don't have a fixed IP on the free tier, so this is the standard approach for this kind of setup.
5. Click **Connect** on your cluster → **Drivers** → copy the connection string. It looks like:
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority`
6. Add a database name to the path so orders land in a named database, e.g.:
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/angaar-dhaba?retryWrites=true&w=majority`

Keep this connection string private — don't paste it into chat, commit it, or put it anywhere but the Render dashboard (next step).

### 2. Render (hosts the backend)

1. Go to https://render.com and sign up (GitHub login is easiest since this repo is already on GitHub).
2. **New +** → **Web Service** → connect the `Rishisatpute/_HOTEL_RAG_GEN_GLB` repo, branch `ek-punjab`.
3. Set:
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Under **Environment**, add:
   - `MONGODB_URI` = the connection string from step 1
   - `ALLOWED_ORIGINS` = `https://hotel-rag-gen-glb.vercel.app` (your Vercel frontend URL; add `http://localhost:5000` too, comma-separated, if you also test locally)
5. Deploy. Render will give you a URL like `https://angaar-dhaba-api.onrender.com`.
6. Visit `<that-url>/api/health` — you should see `{"ok":true,"message":"Angaar Dhaba API is running"}`.

Note: Render's free tier spins the service down after 15 minutes of no traffic, and the next request takes ~30-50s to wake it back up. Fine for testing; if that cold-start delay is a problem in real service, Render's cheapest paid tier keeps it always-on.

### 3. Point the frontend at it

In `orders.js`, `API_BASE` is currently a placeholder:

```js
const API_BASE = 'https://angaar-dhaba-api.onrender.com';
```

Replace it with your actual Render URL from step 2, then commit and push —
Vercel will redeploy the frontend automatically.

### 4. Test the real thing

Open the Vercel site on your phone and on a laptop at the same time (or two
different phones). Place an order from one, and watch it appear on Kitchen /
Waiter / Counter open on the other, live. That's the part that never worked
before this backend existed.
