-- Registry of valid tables + their QR secret. table-qr.html's "Generate" button
-- ensures a row (and a stable token) exists for each table in the range it's
-- asked for — regenerating the same range later reuses the existing token
-- rather than minting a new one, so already-printed QR codes stay valid.
-- "Takeaway" is deliberately never registered here — it's exempt from both
-- the token check and the occupied/free dropdown logic.
CREATE TABLE IF NOT EXISTS tables (
  table_no VARCHAR(50) NOT NULL PRIMARY KEY,
  token    VARCHAR(32) NOT NULL
) ENGINE=InnoDB;

-- One row per waiter/counter person. The PIN both authenticates them and
-- says which console they land on (staff_login.php looks this up before
-- falling back to the shared STAFF_PIN in .env, which still lands on the
-- staff.html hub for anything that isn't a per-person console, e.g. table-qr).
-- Plaintext PINs on purpose — same soft-gate threat model as STAFF_PIN
-- (see common.js), not a defense against a determined attacker.
CREATE TABLE IF NOT EXISTS staff_logins (
  pin        VARCHAR(20)  NOT NULL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  role       ENUM('waiter','counter') NOT NULL,
  active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at BIGINT       NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- table_no isn't part of the original 4-field spec, but Counter's Recent
-- Invoices list has to show which table an invoice belongs to — there's
-- nowhere else to get that from once orders/order_items are gone.
CREATE TABLE IF NOT EXISTS invoice_log (
  invoice_no     VARCHAR(30)   NOT NULL PRIMARY KEY,
  table_no       VARCHAR(50)   NOT NULL,
  amount         DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(20)   NOT NULL,
  paid_at        BIGINT        NOT NULL,

  INDEX idx_paid_at (paid_at)
) ENGINE=InnoDB;

-- One row per item on a paid bill — snapshotted at payment time so the
-- itemized receipt can still be reprinted/reviewed later without needing
-- the original orders/order_items rows to still exist.
CREATE TABLE IF NOT EXISTS invoice_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  invoice_no  VARCHAR(30)   NOT NULL,
  name        VARCHAR(200)  NOT NULL,
  category    VARCHAR(100)  DEFAULT NULL,
  price       DECIMAL(10,2) NOT NULL,
  qty         INT           NOT NULL DEFAULT 1,

  FOREIGN KEY (invoice_no) REFERENCES invoice_log(invoice_no) ON DELETE CASCADE,
  INDEX idx_invoice (invoice_no),
  INDEX idx_category (category)
) ENGINE=InnoDB;