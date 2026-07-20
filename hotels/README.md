# Savory Restaurant Management System

A full-stack restaurant website with customer ordering, table booking, admin dashboard, and kitchen dashboard.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js, Express.js |
| Database | MongoDB (Mongoose) |

## Features

- **Customer orders** — Checkout form with validation, unique order IDs, payment & order status stored in MongoDB
- **Table booking** — Date, time, guests, customer details with confirmation
- **Admin dashboard** — Orders, kitchen board, payments, analytics, reservations
- **Kitchen dashboard** — Live orders with status buttons (Accepted → Preparing → Ready → Completed)
- **Dark mode** — Toggle with localStorage persistence
- **Modern UI** — Glassmorphism, animations, responsive layout

## Design System (2026 Premium UI)

- **Palette:** Matte black, charcoal, warm white, elegant gold (`#c9a962`)
- **Fonts:** Cormorant Garamond (display), Montserrat (headings), Inter (body)
- **CSS modules:** `css/design-system.css`, `components.css`, `animations.css`, page-specific styles
- **UX:** Sticky nav, back buttons, breadcrumbs, scroll reveals, page loader, glassmorphism

## Project Structure

```
hotels/
├── css/                    # Modular stylesheets
│   ├── design-system.css
│   ├── components.css
│   ├── home.css, booking.css, admin.css, kitchen.css
├── js/ui.js                # Shared navigation & animations
├── server/                 # Backend API
│   ├── config/database.js
│   ├── models/             # Order, Reservation schemas
│   ├── routes/             # orders, reservations, stats
│   └── server.js
├── api.js                  # Frontend API helper
├── theme.js                # Dark/light mode toggle
├── index.html              # Premium homepage
├── checkout.html           # Order checkout
├── booking.html            # Table reservation
├── admin-dashboard.html    # Admin panel
├── kitchen-dashboard.html  # Kitchen panel
└── README.md
```

## Setup

### 1. MongoDB (optional for quick start)

- **Quick start:** If MongoDB is not installed, the server automatically uses an in-memory database (data resets when the server stops).
- **Production:** Install [MongoDB](https://www.mongodb.com/try/download/community) locally or use [MongoDB Atlas](https://www.mongodb.com/atlas) and set `MONGODB_URI` in `server/.env`.

### 2. Backend

```bash
cd server
npm install
```

Copy environment file (optional):

```bash
copy .env.example .env
```

Edit `server/.env` if needed:

```
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/savory_restaurant
```

Start the server:

```bash
npm start
```

### 3. Open the website

**Always use the Express server URL** (not opening HTML files directly):

- Home: http://localhost:5000/index.html
- Menu & Cart: http://localhost:5000/restaurant-menu.html
- Checkout: http://localhost:5000/checkout.html
- Booking: http://localhost:5000/booking.html
- Counter: http://localhost:5000/counter-dashboard.html
- Admin: http://localhost:5000/admin-dashboard.html
- Kitchen: http://localhost:5000/kitchen-dashboard.html

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health check |
| GET | `/api/orders` | List all orders |
| GET | `/api/orders?kitchen=true` | Active kitchen orders |
| POST | `/api/orders` | Create new order |
| PATCH | `/api/orders/:orderId/status` | Update order status |
| GET | `/api/reservations` | List reservations |
| POST | `/api/reservations` | Create reservation |
| GET | `/api/stats` | Dashboard analytics |

## Restaurant POS Workflow

```
Menu → Cart Drawer → Place Order (Table + Name)
    ↓
Kitchen (real-time)          Counter (real-time bill)
    ↓                              ↓
Received → Preparing → Ready → Served    Take Payment (Cash/Card/UPI/Online)
```

1. **Menu** (`restaurant-menu.html`) — Premium cards with qty, Add to Cart, Order Now
2. **Cart drawer** — Floating cart icon, slide-out panel (no payment here)
3. **Place order** — Table number, guest name, special instructions → unique `ORD-*` ID
4. **Kitchen** — Live via Socket.io: Received → Preparing → Ready → Served
5. **Counter** — Bills, print, invoice, separate payment step
6. **Admin** — Overview analytics and legacy delivery orders support

## URLs

| Screen | URL |
|--------|-----|
| Menu & Ordering | `/restaurant-menu.html` |
| Kitchen | `/kitchen-dashboard.html` |
| Counter / Billing | `/counter-dashboard.html` |
| Admin | `/admin-dashboard.html` |

## Dark Mode

Click the floating moon/sun button on any page. Theme is saved in `localStorage` under `savory-theme`.

## License

MIT
