# Angaar Dhaba Print Agent (PHP)

A small script that runs on a computer **inside the restaurant**, on the
same network as the Kitchen, Bar, and Billing printers — the missing link
between the web backend and physical printers on a private `192.168.x.x`
network that the web host can't reach directly.

```
Customer places order
        ↓
Backend (PHP + MySQL) saves it, splits it into a Kitchen ticket + Bar ticket
        ↓
THIS AGENT polls the backend every few seconds and picks it up
        ↓
Sends the ticket as ESC/POS commands to the right printer's IP
        ↓
Reports back "printed" or "failed" so the backend/dashboard knows
```

Kitchen and Bar tickets never contain prices — that's decided once,
server-side, before the ticket is even sent here. This agent just prints
whatever text it's given.

There's no WebSocket push involved (shared/cPanel hosting can't run a
persistent socket server) — this agent just **checks in every few
seconds**. A few seconds of delay between an order landing and the kitchen
ticket printing is the tradeoff for the backend not needing a dedicated
always-on server process.

## Setup

### 1. Get PHP running on the restaurant's PC

If this PC doesn't already have PHP installed:
1. Download a PHP zip for Windows from https://windows.php.net/download/
   (pick a "Non Thread Safe" x64 zip — no installer needed)
2. Extract it anywhere, e.g. `C:\php`
3. That's it — no web server needed, this agent only uses the PHP command
   line (`php.exe`)

### 2. Find each printer's IP address

Most network-capable receipt printers can print a "self-test" page
showing their IP — usually by holding the feed button while powering on,
or through a small LCD/network menu. Give each printer a **static IP** on
the restaurant's router (usually in the router's DHCP reservation
settings) so it never changes.

### 3. Configure

```
cd print-agent-php
copy .env.example .env
```

Edit `.env`:
- `BACKEND_URL` — the deployed PHP backend URL (same one the website uses)
- `KITCHEN_PRINTER_IP`, `BAR_PRINTER_IP`, `BILLING_PRINTER_IP` — each printer's IP
- Leave `DRY_RUN=false` for real printing

### 4. Test before wiring up real printers

Set `DRY_RUN=true` in `.env` first. Every ticket will print to this
terminal window instead of a real printer — good for confirming orders
are reaching the agent correctly before anything physical is involved.

```
C:\php\php.exe agent.php
```

Place a test order from the website and watch it appear in this window
within a few seconds. Once you're confident it's working, set
`DRY_RUN=false` and restart.

### 5. Keep it running

This needs to run continuously during business hours — if it's not
running, kitchen/bar tickets simply won't print (the order itself is
still saved safely either way; nothing gets lost, it just won't print
until the agent is back up, and it will catch up on anything it missed
the moment it reconnects).

Simplest options for a restaurant PC:
- Leave the terminal window open, or
- Create a small `run.bat` file next to `agent.php`:
  ```bat
  :loop
  C:\php\php.exe agent.php
  timeout /t 5
  goto loop
  ```
  This restarts the agent automatically if it ever crashes. Put a shortcut
  to `run.bat` in Windows' Startup folder
  (`shell:startup` in the Run dialog) so it starts automatically when the
  PC boots.

## What it does NOT do

- It doesn't store any order data — it's stateless, just a relay
- It doesn't decide what goes on a ticket — that's already decided by
  the backend before the job reaches here
- If it's offline, orders keep working normally on every screen (kitchen
  display, waiter view, counter) — only the *physical printout* is delayed
  until the agent reconnects
